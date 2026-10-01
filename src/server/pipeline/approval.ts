// approval.ts — the accountant's sign-off (093 US3, FR-014).
//
// This is the ONLY path by which work reaches the printer for the roll class,
// and it is deliberately a single function that does all of the following in
// one transaction:
//
//   1. authorise `workitem.approve_production` — a permission RECEPTION does
//      not hold, so the person who took the order cannot approve it;
//   2. verify the item is actually in the accountant stage;
//   3. verify the frozen production specification and a valid design file —
//      re-checking here as well as in the guard is not redundancy for its own
//      sake: it lets the accountant be told WHICH requirement is missing
//      (spec US3 scenario 2) before any state is touched, while the guard
//      remains the unconditional backstop for every other caller;
//   4. record the append-only `AccountingApproval` with a copy of the total;
//   5. hand the price to 051 via `setPrice` so the existing
//      `WorkItemPrice` history and `PricingStatus` are maintained by the
//      module that owns them — this feature adds a stage, it does not
//      reimplement pricing;
//   6. transition to `READY_FOR_PRODUCTION`, where the guard re-validates.
//
// Step 5 runs in its own transaction because `setPrice` owns that write. The
// approval row is written first, so if the transition is subsequently refused
// the item is left approved-but-unreleased, which is a state an accountant can
// see and retry — never a released item with no approval, which is the
// failure that would matter.

import { type Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { audit, authorize, type Actor } from "~/server/auth";
import {
  transitionWorkItem,
  asUserId,
  asWorkItemId,
  type Actor as CoreActor,
  type DomainError,
} from "~/server/core";
import { setPrice } from "~/server/pricing";
import { DomainProductionSpecError } from "~/server/production-spec/errors";
import { isInStage } from "./stage";

/** Surfaces `transitionWorkItem`'s own error unchanged — same convention as
 *  012's `WorkItemTransitionError` and 011's, because `transitionWorkItem`
 *  already owns the audit write for the transition. */
export class PipelineTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "PipelineTransitionError";
    this.error = error;
  }
}

export type ApproveForProductionInput = {
  readonly workItemId: string;
  /** Optional accountant note recorded on the approval row. */
  readonly note?: string;
};

export type AccountingApprovalSnapshot = {
  readonly approvalId: string;
  readonly workItemId: string;
  readonly approvedById: string;
  readonly totalAmount: string;
  readonly note: string | null;
  readonly approvedAt: Date;
};

function toCoreActor(actor: Actor): CoreActor {
  return {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };
}

/**
 * Approves an accountant-stage item and releases it straight to the printer.
 *
 * There is no branding/content stage for this product class (093 spec,
 * corrected twice): approval lands on `READY_FOR_PRODUCTION`.
 */
export async function approveForProduction(
  actor: Actor,
  input: ApproveForProductionInput,
): Promise<AccountingApprovalSnapshot> {
  authorize(actor, "workitem.approve_production");

  const workItemId = input.workItemId;

  const approval = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const item = await tx.workItem.findUniqueOrThrow({
      where: { id: workItemId },
      select: {
        id: true,
        state: true,
        productionTotal: true,
        productionSpecAt: true,
        customerWidthCm: true,
        productionWidthCm: true,
      },
    });

    if (!isInStage(item.state, "ACCOUNTANT")) {
      throw new DomainProductionSpecError(
        "WORK_ITEM_NOT_APPLICABLE",
        `Only an item in the accountant stage can be approved (current state: ${item.state})`,
      );
    }
    if (item.productionSpecAt === null || item.productionTotal === null) {
      throw new DomainProductionSpecError(
        "PRODUCTION_SPEC_MISSING",
        "لا يوجد مقاس إنتاج مُعتمد لهذا العمل — لا يمكن الموافقة قبل ضبطه",
      );
    }

    // A design version must exist AND point at bytes. A row whose upload
    // failed leaves a null/empty key, and approving that would put the
    // printer in front of a file that does not exist (spec US2 scenario 3).
    const designVersion = await tx.designVersion.findFirst({
      where: { workItemId, storageKey: { not: "" } },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
    if (!designVersion) {
      throw new DomainProductionSpecError(
        "SPEC_NOT_SET",
        "لا يوجد ملف تصميم صالح معتمد — لا يمكن الموافقة قبل رفع الملف",
      );
    }

    // Normalised to a non-empty string first, then compared against `""` rather
    // than written as `note?.trim() || null`. An approval note that was only
    // whitespace is a note nobody wrote, and storing `""` would make "has a
    // note" and "has a blank note" indistinguishable downstream.
    const note = input.note?.trim() ?? "";

    const created = await tx.accountingApproval.create({
      data: {
        workItemId,
        approvedById: actor.userId,
        totalAmount: item.productionTotal,
        note: note === "" ? null : note,
      },
    });

    await audit.record(tx, {
      action: "workitem.accounting_approved",
      entityType: "AccountingApproval",
      entityId: created.id,
      actorId: actor.userId,
      after: {
        workItemId,
        totalAmount: item.productionTotal.toString(),
        productionWidthCm: item.productionWidthCm?.toString() ?? null,
        customerWidthCm: item.customerWidthCm?.toString() ?? null,
        designVersionId: designVersion.id,
        designVersion: designVersion.version,
        note: created.note,
      },
      reason: created.note ?? undefined,
    });

    return created;
  });

  // 051 owns the price record and the PRICED status; the amount applied is
  // the FROZEN total, never a freshly recomputed quote (FR-007, SC-006).
  await setPrice(actor, {
    workItemId,
    kind: "VARIABLE",
    amount: approval.totalAmount.toString(),
    reason: "موافقة المحاسب على مقاس الإنتاج والتسعير المعتمد",
  });

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "READY_FOR_PRODUCTION",
      actor: toCoreActor(actor),
      meta: { accountingApprovalId: approval.id },
    });
    if (!result.ok) {
      throw new PipelineTransitionError(result.error);
    }
    await audit.record(tx, {
      action: "workitem.sent_to_printer",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { accountingApprovalId: approval.id, to: "READY_FOR_PRODUCTION" },
    });
  });

  return {
    approvalId: approval.id,
    workItemId: approval.workItemId,
    approvedById: approval.approvedById,
    totalAmount: approval.totalAmount.toString(),
    note: approval.note,
    approvedAt: approval.approvedAt,
  };
}

/**
 * The accountant's queue: everything awaiting their decision, with the frozen
 * specification already joined in so the list needs no N+1 follow-up.
 *
 * Scoped by STATE, not by role, and the caller must still hold
 * `workitem.approve_production` — the query decides what an accountant can
 * see, the permission decides what they may do (constitution V).
 */
export async function listAwaitingAccountingApproval(): Promise<
  Array<{
    readonly workItemId: string;
    readonly orderId: string;
    readonly state: string;
    readonly customerWidthCm: string | null;
    readonly productionWidthCm: string | null;
    readonly productionAreaSqm: string | null;
    readonly productionTotal: string | null;
    readonly assigneeId: string | null;
  }>
> {
  const rows = await db.workItem.findMany({
    where: { state: { in: ["APPROVED", "WAITING_PRICING"] } },
    select: {
      id: true,
      orderId: true,
      state: true,
      customerWidthCm: true,
      productionWidthCm: true,
      productionAreaSqm: true,
      productionTotal: true,
      assigneeId: true,
    },
    orderBy: { updatedAt: "asc" },
  });
  return rows.map((row) => ({
    workItemId: row.id,
    orderId: row.orderId,
    state: row.state,
    customerWidthCm: row.customerWidthCm?.toString() ?? null,
    productionWidthCm: row.productionWidthCm?.toString() ?? null,
    productionAreaSqm: row.productionAreaSqm?.toString() ?? null,
    productionTotal: row.productionTotal?.toString() ?? null,
    assigneeId: row.assigneeId,
  }));
}

/** Whether an item has an accountant approval on record — used by the UI to
 *  explain a blocked release rather than only to enforce it. */
export async function hasAccountingApproval(workItemId: string): Promise<boolean> {
  const count = await db.accountingApproval.count({ where: { workItemId } });
  return count > 0;
}
