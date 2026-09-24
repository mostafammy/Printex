// workItems.ts — addWorkItem (US7), editWorkItem (US8). contracts/order-entry.md.

import { z } from "zod";
import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { DomainOrderError } from "./errors";
import { isOrderFinished, PRE_DESIGN_EDITABLE_STATES } from "./completeness";
import { workItemCreateSchema, dimensionUnitValues } from "./validation";
import type { WorkItemCreateInput } from "./validation";
import {
  createInitialSpecVersionInTx,
  ensureCurrentSpecVersionInTx,
  applySpecChangeInTx,
} from "~/server/changes";
import type { TxScope } from "~/server/core";

// ── addWorkItem (US7) ───────────────────────────────────────────────────────

export async function addWorkItem(
  actor: Actor,
  orderId: string,
  input: WorkItemCreateInput,
): Promise<{ workItemId: string }> {
  authorize(actor, "order.create");
  const parsed = workItemCreateSchema.parse(input);

  let workItemId!: string;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.workItem.findMany({ where: { orderId }, select: { state: true } });

    // Refused BEFORE any write when every sibling Work Item is finished
    // (FR-011b) — nothing has been written at this point.
    if (isOrderFinished(existing)) {
      throw new DomainOrderError("ORDER_FINISHED", "Order is fully finished; create a new order instead.");
    }

    const workItem = await tx.workItem.create({ data: { orderId, state: "NEW", ...parsed } });
    workItemId = workItem.id;

    const scope: TxScope = { tx, afterCommit: (fn) => void fn() };
    await createInitialSpecVersionInTx(scope, {
      workItemId: workItem.id,
      actorId: actor.userId,
    });


    await audit.record(tx, {
      action: "workitem.created",
      entityType: "WorkItem",
      entityId: workItem.id,
      actorId: actor.userId,
      after: { ...parsed, dueDate: parsed.dueDate?.toISOString(), orderId, addedToExistingOrder: true },
    });
  });

  return { workItemId };
}

// ── editWorkItem (US8) ──────────────────────────────────────────────────────

const editWorkItemSchema = z
  .object({
    quantity: z.number().int().positive(),
    widthValue: z.number().positive(),
    heightValue: z.number().positive(),
    dimensionUnit: z.enum(dimensionUnitValues),
    material: z.string(),
    finishNotes: z.string(),
    dueDate: z.date().nullable(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "editWorkItem requires at least one field to change.",
  });

export type EditWorkItemPatch = z.input<typeof editWorkItemSchema>;

export async function editWorkItem(actor: Actor, workItemId: string, patch: EditWorkItemPatch): Promise<void> {
  authorize(actor, "order.edit");
  const parsed = editWorkItemSchema.parse(patch);

  const afterCommitHooks: (() => Promise<void>)[] = [];
  let closed = false;

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT 1 FROM "WorkItem" WHERE id = ${workItemId} FOR UPDATE`;
      const existing = await tx.workItem.findUniqueOrThrow({ where: { id: workItemId } });

      if (!PRE_DESIGN_EDITABLE_STATES.has(existing.state)) {
        throw new DomainOrderError(
          "PAST_EDIT_WINDOW",
          "This item has entered design; use 016's change process instead.",
        );
      }

      const scope: TxScope = {
        tx,
        afterCommit: (hook) => {
          if (closed) {
            throw new Error("Cannot register afterCommit hook after transaction has settled");
          }
          afterCommitHooks.push(hook);
        },
      };

      const { dueDate, ...specPatch } = parsed;

      if (Object.keys(specPatch).length > 0) {
        const currentVersion = await ensureCurrentSpecVersionInTx(
          scope,
          workItemId,
        );
        await applySpecChangeInTx(
          scope,
          {
            workItemId,
            actorId: actor.userId,
            origin: "DIRECT_EDIT",
            patch: specPatch,
            expected: { version: currentVersion.version },
            reason: null,
            ifUnchanged: "skip",
          },
        );
      }

      if (dueDate !== undefined) {
        await tx.workItem.update({
          where: { id: workItemId },
          data: { dueDate },
        });
      }

      const patchKeys = Object.keys(parsed) as Array<keyof typeof parsed>;
      const before: Record<string, unknown> = {};
      for (const key of patchKeys) {
        const value = existing[key as keyof typeof existing];
        before[key] = value instanceof Prisma.Decimal ? value.toNumber() : value instanceof Date ? value.toISOString() : value;
      }

      await audit.record(tx, {
        action: "workitem.edited",
        entityType: "WorkItem",
        entityId: workItemId,
        actorId: actor.userId,
        before,
        after: { ...parsed, dueDate: parsed.dueDate === undefined ? undefined : parsed.dueDate?.toISOString() ?? null },
      });
    });
  } finally {
    closed = true;
  }

  for (const hook of afterCommitHooks) {
    try {
      await hook();
    } catch (err) {
      console.error("[editWorkItem] afterCommit hook failed", err);
    }
  }
}

