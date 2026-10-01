// create.ts — quickCreateOrder (US1) and createOrder (US2).
// contracts/order-entry.md, plan.md §5.3.

import { z } from "zod";
import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  orderPriorityValues,
  orderChannelValues,
  orderModeValues,
  workItemCreateSchema,
} from "./validation";
import {
  createInitialSpecVersionInTx,
  runInTxScope,
} from "~/server/changes";
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

  return await runInTxScope(db, async (scope) => {
    const tx = scope.tx;
    const order = await tx.order.create({
      data: {
        customerId: parsed.customerId,
        channel: parsed.channel,
        priority: parsed.priority,
        mode: "SEPARATE",
        createdById: actor.userId,
      },
    });

    const workItem = await tx.workItem.create({
      data: {
        orderId: order.id,
        description: parsed.description,
        state: "NEW",
        requiresDesign: true,
        requiresReview: true,
      },
    });

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

    return { orderId: order.id, orderNumber: order.number, workItemId: workItem.id };
  });
}

// ── createOrder (US2) ───────────────────────────────────────────────────────

const createOrderSchema = z.object({
  customerId: z.string().min(1),
  channel: z.enum(orderChannelValues),
  priority: z.enum(orderPriorityValues),
  mode: z.enum(orderModeValues),
  dueDate: z.date().optional(),
  /**
   * Order-level discount and tax agreed at the desk. Stored on the Order, not
   * derived: the TOTAL is derived (from each work item's frozen
   * `productionTotal` → `WorkItemPrice` → `computeOrderSummary`), but a discount
   * the customer was given is a decision that has to outlive the conversation.
   *
   * Both are `>= 0` here. "Discount larger than the subtotal" is a *cross-field*
   * rule and lives in the caller that can see the work items — refusing it with
   * the subtotal in the message beats clamping it silently. `computeOrderSummary`
   * clamps again at the floor, because by then the subtotal is the accountant's
   * priced figure rather than the client's quote.
   */
  discountAmount: z.number().min(0).max(9_999_999.99).optional(),
  taxAmount: z.number().min(0).max(9_999_999.99).optional(),
  /**
   * Whether each amount was entered flat or as a percentage. Free-form strings,
   * not an enum, because this is a record of what was decided rather than a
   * control that drives arithmetic — the arithmetic is already resolved into
   * `discountAmount`/`taxAmount` by the caller.
   */
  discountNote: z.string().trim().max(120).optional(),
  taxNote: z.string().trim().max(120).optional(),
  workItems: z.array(workItemCreateSchema).min(1),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;

export async function createOrder(
  actor: Actor,
  input: CreateOrderInput,
): Promise<{ orderId: string; orderNumber: number; workItemIds: string[] }> {
  authorize(actor, "order.create");
  const parsed = createOrderSchema.parse(input);

  return await runInTxScope(db, async (scope) => {
    const tx = scope.tx;
    const order = await tx.order.create({
      data: {
        customerId: parsed.customerId,
        channel: parsed.channel,
        priority: parsed.priority,
        mode: parsed.mode,
        dueDate: parsed.dueDate,
        discountAmount: new Prisma.Decimal(parsed.discountAmount ?? 0),
        taxAmount: new Prisma.Decimal(parsed.taxAmount ?? 0),
        discountNote: parsed.discountNote,
        taxNote: parsed.taxNote,
        createdById: actor.userId,
      },
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
        mode: parsed.mode,
        // Recorded because a discount is money given away: "who let them have
        // 200 off, and when" is the first question anyone asks afterwards.
        discountAmount: (parsed.discountAmount ?? 0).toFixed(2),
        taxAmount: (parsed.taxAmount ?? 0).toFixed(2),
        source: "full_form",
      },
    });

    const workItemIds: string[] = [];
    // A work item's department comes from its product type: reception picks the
    // product and nothing else, and every other read path already falls back to
    // `productType.defaultDepartmentId` (production/department.ts,
    // board/projection.ts). Resolving it HERE rather than in the form means the
    // column is still written, so `isOrderComplete` and the order page's
    // "missing fields" list keep meaning what they say — an explicit
    // `departmentId` from a programmatic caller still wins.
    const departmentByProductType = await resolveDefaultDepartmentsInTx(
      tx,
      parsed.workItems.map((item) => item.productTypeId),
    );

    for (const item of parsed.workItems) {
      const departmentId =
        item.departmentId ??
        (item.productTypeId ? departmentByProductType.get(item.productTypeId) : undefined);

      const workItem = await tx.workItem.create({
        data: { orderId: order.id, state: "NEW", ...item, departmentId },
      });
      workItemIds.push(workItem.id);

      await createInitialSpecVersionInTx(scope, {
        workItemId: workItem.id,
        actorId: actor.userId,
      });

      await audit.record(tx, {
        action: "workitem.created",
        entityType: "WorkItem",
        entityId: workItem.id,
        actorId: actor.userId,
        after: {
          ...item,
          departmentId,
          dueDate: item.dueDate?.toISOString(),
          orderId: order.id,
        },
      });
    }

    return { orderId: order.id, orderNumber: order.number, workItemIds };
  });
}

/** `productTypeId -> defaultDepartmentId`, skipping unconfigured types. */
async function resolveDefaultDepartmentsInTx(
  tx: Prisma.TransactionClient,
  productTypeIds: ReadonlyArray<string | undefined>,
): Promise<ReadonlyMap<string, string>> {
  const ids = [...new Set(productTypeIds.filter((id): id is string => typeof id === "string" && id !== ""))];
  if (ids.length === 0) return new Map();

  const rows = await tx.productType.findMany({
    where: { id: { in: ids } },
    select: { id: true, defaultDepartmentId: true },
  });

  return new Map(
    rows.flatMap((row) => (row.defaultDepartmentId ? [[row.id, row.defaultDepartmentId] as const] : [])),
  );
}
