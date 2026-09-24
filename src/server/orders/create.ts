// create.ts — quickCreateOrder (US1) and createOrder (US2).
// contracts/order-entry.md, plan.md §5.3.

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  orderPriorityValues,
  orderChannelValues,
  orderModeValues,
  workItemCreateSchema,
} from "./validation";
import { createInitialSpecVersionInTx } from "~/server/changes";
import type { TxScope } from "~/server/core";
export type { WorkItemCreateInput } from "./validation";


// ── quickCreateOrder (US1) ─────────────────────────────────────────────────

const quickCreateSchema = z.object({
  customerId: z.string().min(1),
  description: z.string().trim().min(1).max(500),
  priority: z.enum(orderPriorityValues),
  channel: z.enum(orderChannelValues).default("WALK_IN"),
});

export type QuickCreateOrderInput = z.input<typeof quickCreateSchema>;

export async function quickCreateOrder(
  actor: Actor,
  input: QuickCreateOrderInput,
): Promise<{ orderId: string; orderNumber: number; workItemId: string }> {
  authorize(actor, "order.create");
  const parsed = quickCreateSchema.parse(input);

  let orderId!: string;
  let orderNumber!: number;
  let workItemId!: string;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.create({
      data: {
        customerId: parsed.customerId,
        channel: parsed.channel,
        priority: parsed.priority,
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });
    orderId = order.id;
    orderNumber = order.number;

    const workItem = await tx.workItem.create({
      data: {
        orderId: order.id,
        description: parsed.description,
        state: "NEW",
        requiresDesign: true,
        requiresReview: true,
      },
    });
    workItemId = workItem.id;

    const scope: TxScope = { tx, afterCommit: (fn) => void fn() };
    await createInitialSpecVersionInTx(scope, {
      workItemId: workItem.id,
      actorId: actor.userId,
    });


    await audit.record(tx, {
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      actorId: actor.userId,
      after: {
        customerId: parsed.customerId,
        channel: parsed.channel,
        priority: parsed.priority,
        source: "quick_create",
      },
    });

    await audit.record(tx, {
      action: "workitem.created",
      entityType: "WorkItem",
      entityId: workItem.id,
      actorId: actor.userId,
      after: { description: parsed.description, orderId: order.id },
    });
  });

  return { orderId, orderNumber, workItemId };
}

// ── createOrder (US2) ───────────────────────────────────────────────────────

const createOrderSchema = z.object({
  customerId: z.string().min(1),
  channel: z.enum(orderChannelValues),
  priority: z.enum(orderPriorityValues),
  mode: z.enum(orderModeValues),
  dueDate: z.date().optional(),
  workItems: z.array(workItemCreateSchema).min(1),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;

export async function createOrder(
  actor: Actor,
  input: CreateOrderInput,
): Promise<{ orderId: string; orderNumber: number; workItemIds: string[] }> {
  authorize(actor, "order.create");
  const parsed = createOrderSchema.parse(input);

  let orderId!: string;
  let orderNumber!: number;
  const workItemIds: string[] = [];

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.create({
      data: {
        customerId: parsed.customerId,
        channel: parsed.channel,
        priority: parsed.priority,
        mode: parsed.mode,
        dueDate: parsed.dueDate,
        createdById: actor.userId,
      },
    });
    orderId = order.id;
    orderNumber = order.number;

    await audit.record(tx, {
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      actorId: actor.userId,
      after: {
        customerId: parsed.customerId,
        channel: parsed.channel,
        priority: parsed.priority,
        mode: parsed.mode,
        source: "full_form",
      },
    });

    const itemScope: TxScope = { tx, afterCommit: (fn) => void fn() };
    for (const item of parsed.workItems) {
      const workItem = await tx.workItem.create({
        data: { orderId: order.id, state: "NEW", ...item },
      });
      workItemIds.push(workItem.id);

      await createInitialSpecVersionInTx(itemScope, {
        workItemId: workItem.id,
        actorId: actor.userId,
      });


      await audit.record(tx, {
        action: "workitem.created",
        entityType: "WorkItem",
        entityId: workItem.id,
        actorId: actor.userId,
        after: { ...item, dueDate: item.dueDate?.toISOString(), orderId: order.id },
      });
    }
  });

  return { orderId, orderNumber, workItemIds };
}
