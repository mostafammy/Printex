// cancelOrder.ts — changeOrderPriority (US3), cancelWorkItem, cancelOrder
// (US6). contracts/order-entry.md.

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { transitionWorkItem, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

/**
 * Surfaces `transitionWorkItem`'s own `Result` error unchanged — see
 * contracts/order-entry.md's `cancelWorkItem`: this is NOT wrapped in
 * `DomainOrderError`, since `transitionWorkItem` already owns the audit
 * write for the transition itself.
 */
export class WorkItemTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemTransitionError";
    this.error = error;
  }
}

// ── changeOrderPriority (US3) ───────────────────────────────────────────────

const priorityValues = ["NORMAL", "URGENT"] as const;

export async function changeOrderPriority(
  actor: Actor,
  orderId: string,
  priority: (typeof priorityValues)[number],
): Promise<void> {
  authorize(actor, "order.edit");
  const parsedPriority = z.enum(priorityValues).parse(priority);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { priority: true },
    });

    // No-op change is not an event (contracts/order-entry.md).
    if (existing.priority === parsedPriority) return;

    await tx.order.update({ where: { id: orderId }, data: { priority: parsedPriority } });

    await audit.record(tx, {
      action: "order.priority_changed",
      entityType: "Order",
      entityId: orderId,
      actorId: actor.userId,
      before: { priority: existing.priority },
      after: { priority: parsedPriority },
    });
  });
}

// ── cancelWorkItem (US6) ────────────────────────────────────────────────────

export async function cancelWorkItem(actor: Actor, workItemId: string, reason: string): Promise<void> {
  authorize(actor, "order.cancel");
  const parsedReason = z.string().trim().min(1).parse(reason);

  const result = await db.$transaction((tx: Prisma.TransactionClient) =>
    transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "CANCELLED",
      actor: toCoreActor(actor),
      reason: parsedReason,
    }),
  );

  if (!result.ok) {
    throw new WorkItemTransitionError(result.error);
  }
}

// ── cancelOrder (US6) ───────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(["DELIVERED", "COMPLETED", "CANCELLED"]);

export async function cancelOrder(
  actor: Actor,
  orderId: string,
  reason: string,
): Promise<{
  cancelledWorkItemIds: string[];
  failedWorkItemIds: { id: string; reason: string }[];
}> {
  authorize(actor, "order.cancel");
  const parsedReason = z.string().trim().min(1).parse(reason);

  const cancelledWorkItemIds: string[] = [];
  const failedWorkItemIds: { id: string; reason: string }[] = [];

  await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const workItems = await tx.workItem.findMany({
        where: { orderId },
        select: { id: true, state: true },
      });
      const nonTerminal = workItems.filter((wi) => !TERMINAL_STATES.has(wi.state));

      for (const wi of nonTerminal) {
        // Cancelling "the order" is best-effort across its items, not an
        // all-or-nothing atomic unit — a single item's INVALID_TRANSITION
        // (e.g. it turned terminal between the read above and this write) is
        // skipped, not thrown, so the rest of the batch still lands
        // (contracts/order-entry.md's `cancelOrder`).
        const result = await transitionWorkItem(tx, {
          workItemId: asWorkItemId(wi.id),
          to: "CANCELLED",
          actor: toCoreActor(actor),
          reason: parsedReason,
        });
        if (result.ok) {
          cancelledWorkItemIds.push(wi.id);
        } else {
          failedWorkItemIds.push({ id: wi.id, reason: result.error.message });
        }
      }
    },
    { timeout: 20000, maxWait: 10000 },
  );

  return { cancelledWorkItemIds, failedWorkItemIds };
}
