// Expenses — 052-finance US4. FR-013 (fields + threshold approval + entity-
// scoped attachments), FR-014 (configurable categories, history keeps its
// label), FR-016 (permission, validation, audit, append-only corrections).

import { audit, authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { attachments } from "~/server/files";
import { normalizePage, paginateRows } from "~/server/pagination";
import { FINANCE_AUDIT_ACTIONS, requireReason } from "./audit";
import { getApprovalThreshold, isActiveCategory } from "./config";
import { DomainFinanceError } from "./errors";
import { parsePositiveDecimal } from "./money";
import { calendarDateToUtcMidnight } from "./time";

export type RecordExpenseInput = {
  readonly amount: string;
  readonly category: string;
  readonly expenseDate: string; // YYYY-MM-DD
  readonly employee: string;
  readonly description: string;
  readonly orderId?: string;
  readonly workItemId?: string;
  readonly receipt?: {
    readonly stream: NodeJS.ReadableStream | ReadableStream<Uint8Array>;
    readonly fileName: string;
  };
};

export type ExpenseSnapshot = {
  readonly id: string;
  readonly amount: string;
  readonly category: string;
  readonly expenseDate: string;
  readonly employee: string;
  readonly description: string;
  readonly orderId: string | null;
  readonly workItemId: string | null;
  readonly createdById: string;
  readonly createdAt: Date;
  readonly awaitingApproval: boolean;
  readonly attachmentId: string | null;
};

export async function recordExpense(
  actor: Actor,
  input: RecordExpenseInput,
): Promise<ExpenseSnapshot> {
  authorize(actor, "expense.record");

  const amount = parsePositiveDecimal(input.amount);
  const category = input.category?.trim() ?? "";
  if (!(await isActiveCategory(category))) {
    throw new DomainFinanceError("CATEGORY_NOT_CONFIGURED", `Expense category is not configured: ${category}`);
  }
  const employee = input.employee?.trim();
  if (!employee) throw new DomainFinanceError("VALIDATION", "Employee is required");
  const description = input.description?.trim();
  if (!description) throw new DomainFinanceError("VALIDATION", "Description is required");
  const expenseDate = calendarDateToUtcMidnight(input.expenseDate);

  const created = await db.$transaction(async (tx) => {
    if (input.orderId) {
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
    } else if (input.workItemId) {
      throw new DomainFinanceError("VALIDATION", "A Work Item link requires an Order");
    }

    const expense = await tx.expense.create({
      data: {
        amount,
        category,
        expenseDate,
        employee,
        description,
        orderId: input.orderId,
        workItemId: input.workItemId,
        createdById: actor.userId,
      },
    });

    // 050 entity-ownership rule: verify this actor may write THIS record
    // before attaching (attachments.attach does entity authz itself only via
    // the consuming feature — contracts/authorization-audit.md).
    let attachmentId: string | null = null;
    if (input.receipt) {
      attachmentId = await attachments.attach(tx, {
        entityType: "Expense",
        entityId: expense.id,
        stream: input.receipt.stream,
        fileName: input.receipt.fileName,
        kind: "image",
        actor,
      });
    }

    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.expenseRecorded,
      entityType: "Expense",
      entityId: expense.id,
      actorId: actor.userId,
      after: {
        amount: expense.amount.toString(),
        category: expense.category,
        expenseDate: expense.expenseDate.toISOString(),
        employee,
        description,
        orderId: input.orderId ?? null,
        workItemId: input.workItemId ?? null,
      },
      attachmentIds: attachmentId ? [attachmentId] : [],
    });

    return { expense, attachmentId };
  });

  const threshold = await getApprovalThreshold();
  const awaitingApproval = amount.gte(threshold);
  return {
    id: created.expense.id,
    amount: created.expense.amount.toString(),
    category: created.expense.category,
    expenseDate: created.expense.expenseDate.toISOString().slice(0, 10),
    employee: created.expense.employee,
    description: created.expense.description,
    orderId: created.expense.orderId,
    workItemId: created.expense.workItemId,
    createdById: created.expense.createdById,
    createdAt: created.expense.createdAt,
    awaitingApproval,
    attachmentId: created.attachmentId,
  };
}

/** Append-only correction: FinanceVoid(EXPENSE), never an in-place edit. */
export async function voidExpense(
  actor: Actor,
  input: { expenseId: string; reason: string },
): Promise<{ expenseId: string; voided: true }> {
  authorize(actor, "expense.record");
  const reason = requireReason(input.reason, "void an expense");

  await db.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({ where: { id: input.expenseId } });
    if (!expense) throw new DomainFinanceError("EXPENSE_NOT_FOUND", "Expense was not found");
    const existing = await tx.financeVoid.findUnique({
      where: { entityType_entityId: { entityType: "EXPENSE", entityId: expense.id } },
    });
    if (existing) throw new DomainFinanceError("ALREADY_VOIDED", "Expense is already voided");

    await tx.financeVoid.create({
      data: { entityType: "EXPENSE", entityId: expense.id, reason, voidedById: actor.userId },
    });
    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.expenseVoided,
      entityType: "Expense",
      entityId: expense.id,
      actorId: actor.userId,
      before: { amount: expense.amount.toString(), category: expense.category },
      after: { voided: true },
      reason,
    });
  });
  return { expenseId: input.expenseId, voided: true };
}

/**
 * Approval as an appended ExpenseApproval row (unique expenseId) — the
 * Expense row never changes. Gated by admin.config; never blocks recording,
 * counting or visibility (FR-013 clarification).
 */
export async function approveExpense(
  actor: Actor,
  input: { expenseId: string },
): Promise<{ expenseId: string; approved: true }> {
  authorize(actor, "admin.config");

  await db.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({
      where: { id: input.expenseId },
      include: { approval: true },
    });
    if (!expense) throw new DomainFinanceError("EXPENSE_NOT_FOUND", "Expense was not found");

    const voided = await tx.financeVoid.findUnique({
      where: { entityType_entityId: { entityType: "EXPENSE", entityId: expense.id } },
    });
    if (voided) throw new DomainFinanceError("ALREADY_VOIDED", "A voided expense cannot be approved");
    if (expense.approval) {
      throw new DomainFinanceError("ALREADY_APPROVED", "Expense is already approved");
    }
    const threshold = await getApprovalThreshold();
    if (expense.amount.lt(threshold)) {
      throw new DomainFinanceError("APPROVAL_NOT_REQUIRED", "Expense is below the approval threshold");
    }

    await tx.expenseApproval.create({
      data: { expenseId: expense.id, approvedById: actor.userId },
    });
    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.expenseApproved,
      entityType: "Expense",
      entityId: expense.id,
      actorId: actor.userId,
      before: { awaitingApproval: true },
      after: { awaitingApproval: false, approvedById: actor.userId },
    });
  });
  return { expenseId: input.expenseId, approved: true };
}

export type ListExpensesFilter = {
  readonly from?: string;
  readonly to?: string;
  readonly category?: string;
  readonly orderId?: string;
  readonly employee?: string;
  readonly approval?: "awaiting" | "approved" | "none";
  readonly includeVoided?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
};

export type ExpenseRow = {
  readonly id: string;
  readonly amount: string;
  readonly category: string;
  readonly expenseDate: string;
  readonly employee: string;
  readonly description: string;
  readonly orderId: string | null;
  readonly workItemId: string | null;
  readonly awaitingApproval: boolean;
  readonly approvedAt: Date | null;
  readonly voided: boolean;
  /** First live 050 receipt attachment, if any (FR-013). */
  readonly receiptAttachmentId: string | null;
};

/** FR-019 read query (contracts/queries.md listExpenses) — caller authorizes. */
export async function listExpenses(filter: ListExpensesFilter): Promise<{
  rows: ExpenseRow[];
  nextCursor: number | null;
}> {
  const { page, pageSize, skip, take } = normalizePage(filter);

  const rows = await db.expense.findMany({
    where: {
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.orderId ? { orderId: filter.orderId } : {}),
      ...(filter.employee ? { employee: { contains: filter.employee } } : {}),
      ...(filter.from || filter.to
        ? {
            expenseDate: {
              ...(filter.from ? { gte: calendarDateToUtcMidnight(filter.from) } : {}),
              ...(filter.to ? { lte: calendarDateToUtcMidnight(filter.to) } : {}),
            },
          }
        : {}),
    },
    include: { approval: { select: { approvedAt: true } } },
    orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
    skip,
    take,
  });

  const { rows: pageRows, nextCursor } = paginateRows(rows, page, pageSize);
  const voidRows = await db.financeVoid.findMany({
    where: { entityType: "EXPENSE", entityId: { in: pageRows.map((r) => r.id) } },
    select: { entityId: true },
  });
  const voidedSet = new Set(voidRows.map((r) => r.entityId));

  const threshold = await getApprovalThreshold();
  // FR-013: resolve receipt attachments for the page in one query.
  const attachments = await db.attachment.findMany({
    where: {
      entityType: "Expense",
      entityId: { in: pageRows.map((r) => r.id) },
      status: { notIn: ["ARCHIVED", "VOID"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, entityId: true },
  });
  const receiptByExpense = new Map<string, string>();
  for (const attachment of attachments) {
    if (!receiptByExpense.has(attachment.entityId)) {
      receiptByExpense.set(attachment.entityId, attachment.id);
    }
  }

  const shaped = pageRows
    .map((row) => ({
      id: row.id,
      amount: row.amount.toString(),
      category: row.category,
      expenseDate: row.expenseDate.toISOString().slice(0, 10),
      employee: row.employee,
      description: row.description,
      orderId: row.orderId,
      workItemId: row.workItemId,
      awaitingApproval: row.amount.gte(threshold) && !row.approval,
      approvedAt: row.approval?.approvedAt ?? null,
      voided: voidedSet.has(row.id),
      receiptAttachmentId: receiptByExpense.get(row.id) ?? null,
    }))
    .filter((row) => filter.includeVoided === true || !row.voided)
    .filter((row) => {
      if (filter.approval === "awaiting") return row.awaitingApproval;
      if (filter.approval === "approved") return row.approvedAt !== null;
      if (filter.approval === "none") return !row.awaitingApproval && row.approvedAt === null;
      return true;
    });

  return { rows: shaped, nextCursor };
}
