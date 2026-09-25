// Direct manufacturing costs — 052-finance US5. FR-015 (traceable per
// order/work item), FR-016 (permission, validation, audit, append-only).

import { audit, authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { attachments } from "~/server/files";
import { FINANCE_AUDIT_ACTIONS, requireReason } from "./audit";
import { DomainFinanceError } from "./errors";
import { parsePositiveDecimal } from "./money";
import { calendarDateToUtcMidnight } from "./time";

export type RecordDirectCostInput = {
  readonly orderId: string;
  readonly workItemId?: string;
  readonly amount: string;
  readonly costDate: string; // YYYY-MM-DD
  readonly description: string;
  readonly receipt?: {
    readonly stream: NodeJS.ReadableStream;
    readonly fileName: string;
  };
};

export type DirectCostSnapshot = {
  readonly id: string;
  readonly orderId: string;
  readonly workItemId: string | null;
  readonly amount: string;
  readonly costDate: string;
  readonly description: string;
  readonly createdById: string;
  readonly createdAt: Date;
  readonly attachmentId: string | null;
};

export async function recordDirectCost(
  actor: Actor,
  input: RecordDirectCostInput,
): Promise<DirectCostSnapshot> {
  authorize(actor, "expense.record");

  const amount = parsePositiveDecimal(input.amount);
  const description = input.description?.trim();
  if (!description) throw new DomainFinanceError("VALIDATION", "Description is required");
  const costDate = calendarDateToUtcMidnight(input.costDate);

  const created = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { id: true } });
    if (!order) throw new DomainFinanceError("ORDER_NOT_FOUND", "Order was not found");
    if (input.workItemId) {
      const workItem = await tx.workItem.findUnique({
        where: { id: input.workItemId },
        select: { orderId: true },
      });
      if (workItem?.orderId !== input.orderId) {
        throw new DomainFinanceError("VALIDATION", "Work Item does not belong to the Order");
      }
    }

    const cost = await tx.directCost.create({
      data: {
        amount,
        costDate,
        description,
        orderId: input.orderId,
        workItemId: input.workItemId,
        createdById: actor.userId,
      },
    });

    let attachmentId: string | null = null;
    if (input.receipt) {
      attachmentId = await attachments.attach(tx, {
        entityType: "DirectCost",
        entityId: cost.id,
        stream: input.receipt.stream,
        fileName: input.receipt.fileName,
        kind: "image",
        actor,
      });
    }

    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.directCostRecorded,
      entityType: "DirectCost",
      entityId: cost.id,
      actorId: actor.userId,
      after: {
        orderId: cost.orderId,
        workItemId: cost.workItemId,
        amount: cost.amount.toString(),
        costDate: cost.costDate.toISOString(),
        description,
      },
      attachmentIds: attachmentId ? [attachmentId] : [],
    });
    return { cost, attachmentId };
  });

  return {
    id: created.cost.id,
    orderId: created.cost.orderId,
    workItemId: created.cost.workItemId,
    amount: created.cost.amount.toString(),
    costDate: created.cost.costDate.toISOString().slice(0, 10),
    description: created.cost.description,
    createdById: created.cost.createdById,
    createdAt: created.cost.createdAt,
    attachmentId: created.attachmentId,
  };
}

export async function voidDirectCost(
  actor: Actor,
  input: { directCostId: string; reason: string },
): Promise<{ directCostId: string; voided: true }> {
  authorize(actor, "expense.record");
  const reason = requireReason(input.reason, "void a direct cost");

  await db.$transaction(async (tx) => {
    const cost = await tx.directCost.findUnique({ where: { id: input.directCostId } });
    if (!cost) throw new DomainFinanceError("DIRECT_COST_NOT_FOUND", "Direct cost was not found");
    const existing = await tx.financeVoid.findUnique({
      where: { entityType_entityId: { entityType: "DIRECT_COST", entityId: cost.id } },
    });
    if (existing) throw new DomainFinanceError("ALREADY_VOIDED", "Direct cost is already voided");

    await tx.financeVoid.create({
      data: { entityType: "DIRECT_COST", entityId: cost.id, reason, voidedById: actor.userId },
    });
    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.directCostVoided,
      entityType: "DirectCost",
      entityId: cost.id,
      actorId: actor.userId,
      before: { amount: cost.amount.toString(), description: cost.description },
      after: { voided: true },
      reason,
    });
  });
  return { directCostId: input.directCostId, voided: true };
}

export type ListDirectCostsFilter = {
  readonly orderId?: string;
  readonly workItemId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly includeVoided?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
};

export type DirectCostRow = {
  readonly id: string;
  readonly orderId: string;
  readonly workItemId: string | null;
  readonly amount: string;
  readonly costDate: string;
  readonly description: string;
  readonly createdById: string;
  readonly voided: boolean;
};

/** FR-019 read query (contracts/queries.md listDirectCosts). */
export async function listDirectCosts(filter: ListDirectCostsFilter): Promise<{
  rows: DirectCostRow[];
  nextCursor: number | null;
}> {
  const pageSize = Math.min(Math.max(filter.pageSize ?? 25, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const rows = await db.directCost.findMany({
    where: {
      ...(filter.orderId ? { orderId: filter.orderId } : {}),
      ...(filter.workItemId ? { workItemId: filter.workItemId } : {}),
      ...(filter.from || filter.to
        ? {
            costDate: {
              ...(filter.from ? { gte: calendarDateToUtcMidnight(filter.from) } : {}),
              ...(filter.to ? { lte: calendarDateToUtcMidnight(filter.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ costDate: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const voidRows = await db.financeVoid.findMany({
    where: { entityType: "DIRECT_COST", entityId: { in: pageRows.map((r) => r.id) } },
    select: { entityId: true },
  });
  const voidedSet = new Set(voidRows.map((r) => r.entityId));
  const shaped = pageRows
    .map((row) => ({
      id: row.id,
      orderId: row.orderId,
      workItemId: row.workItemId,
      amount: row.amount.toString(),
      costDate: row.costDate.toISOString().slice(0, 10),
      description: row.description,
      createdById: row.createdById,
      voided: voidedSet.has(row.id),
    }))
    .filter((row) => filter.includeVoided === true || !row.voided);
  return { rows: shaped, nextCursor: hasMore ? page + 1 : null };
}
