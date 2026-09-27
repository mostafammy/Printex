// changeRequests.ts — Change requests for Work Items in production.
// tasks.md T047–T049, contracts/change-control.md §createChangeRequest …
// §getChangeRequestDetail, spec FR-011–018.
//
// Lock order is always ChangeRequest row, then Work Item row, so concurrent
// deciders serialize on the request and the loser sees it already decided.

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { closeOpenSegment, fail, notify, asWorkItemId, type WorkItemState } from "~/server/core";
import { defineCommand, defineQuery } from "./aspect";
import { applyApprovalOutcomeInTx } from "./approvalEffects";
import { diffSpecSnapshots, type SpecFieldChange } from "./diff";
import { canRedesignOnApproval } from "./policy";
import { usersWithPermission } from "./recipients";
import {
  mergeSpecPatch,
  specPatchSchema,
  type SpecField,
  type SpecPatch,
  type SpecVersionView,
} from "./specFields";
import { applySpecChangeInTx, ensureCurrentSpecVersionInTx, toSpecVersionView } from "./versions";
import { lockWorkItemInTx } from "./workItemLock";

const reasonSchema = z.string().trim().min(1);

const optionalNoteSchema = z
  .string()
  .trim()
  .transform((s) => (s === "" ? undefined : s))
  .optional();

type Tx = Prisma.TransactionClient;

type LockedChangeRequest = {
  readonly id: string;
  readonly workItemId: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "CLOSED_BY_CANCELLATION";
  readonly baseSpecVersionId: string;
  readonly proposedPatch: Prisma.JsonValue;
  readonly requestReason: string;
  readonly requestedById: string;
};

/** SELECT … FOR UPDATE on the request; NOT_FOUND when absent. */
async function lockChangeRequestInTx(tx: Tx, changeRequestId: string): Promise<LockedChangeRequest> {
  const [row] = await tx.$queryRaw<LockedChangeRequest[]>`
    SELECT id, "workItemId", status, "baseSpecVersionId", "proposedPatch", "requestReason", "requestedById"
    FROM "ChangeRequest"
    WHERE id = ${changeRequestId}
    FOR UPDATE
  `;
  if (!row) {
    return fail({ code: "NOT_FOUND", entity: "ChangeRequest", id: changeRequestId });
  }
  return row;
}

/** The stored patch was validated on write; re-parse to get a typed value back. */
function parseStoredPatch(raw: Prisma.JsonValue): SpecPatch {
  return specPatchSchema.parse(raw);
}

function changedFieldsOf(changes: readonly SpecFieldChange[]): SpecField[] {
  return changes.map((c) => c.field);
}

// ── createChangeRequest ────────────────────────────────────────────────────

export const createChangeRequestInputSchema = z.object({
  workItemId: z.string().min(1),
  patch: specPatchSchema,
  reason: reasonSchema,
});

export const createChangeRequest = defineCommand({
  action: "change_request.created",
  input: createChangeRequestInputSchema,
  permission: "order.edit",
  run: async (ctx) => {
    const { workItemId, patch, reason } = ctx.input;
    const item = await lockWorkItemInTx(ctx.tx, workItemId);

    if (item.state !== "IN_PRODUCTION") {
      return fail({ code: "NOT_IN_PRODUCTION" });
    }
    const pending = await ctx.tx.changeRequest.findFirst({
      where: { workItemId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      return fail({ code: "CHANGE_REQUEST_PENDING" });
    }

    // Dry run: the request must actually change something.
    const current = await ensureCurrentSpecVersionInTx(ctx, workItemId);
    const changes = diffSpecSnapshots(current.snapshot, mergeSpecPatch(current.snapshot, patch));
    if (changes.length === 0) {
      return fail({ code: "NO_CHANGES" });
    }
    if (patch.productTypeId && patch.productTypeId !== current.snapshot.productTypeId) {
      const pt = await ctx.tx.productType.findUnique({
        where: { id: patch.productTypeId },
        select: { id: true },
      });
      if (!pt) {
        return fail({ code: "NOT_FOUND", entity: "ProductType", id: patch.productTypeId });
      }
    }

    // Freeze: pause a running timer — the same end state as 014's pauseProduction.
    const runningSegment = await ctx.tx.phaseTiming.findFirst({
      where: { workItemId, kind: "ACTIVE", endedAt: null },
      select: { id: true },
    });
    const now = new Date();

    const cr = await ctx.tx.changeRequest.create({
      data: {
        workItemId,
        baseSpecVersionId: current.id,
        proposedPatch: patch,
        requestReason: reason,
        requestedById: ctx.actor.userId,
        pausedRunningTimerAt: runningSegment ? now : null,
      },
      select: { id: true },
    });

    if (runningSegment) {
      await closeOpenSegment(ctx.tx, { workItemId: asWorkItemId(workItemId), kind: "ACTIVE", at: now });
    }

    const approverIds = await usersWithPermission(ctx.tx, "change.approve");
    const changedFields = changedFieldsOf(changes);
    await notify(ctx.tx, {
      type: "work_item.change_requested",
      entity: { type: "WorkItem", id: workItemId },
      recipients: {
        userIds: approverIds,
        departmentIds: item.effectiveDepartmentId ? [item.effectiveDepartmentId] : [],
      },
      payload: { workItemId, orderId: item.orderId, changeRequestId: cr.id, changedFields, reason },
    });

    return {
      value: { changeRequestId: cr.id },
      audit: [
        {
          action: "change_request.created",
          entityType: "ChangeRequest",
          entityId: cr.id,
          after: { workItemId, baseVersion: current.version, patch, changedFields },
          reason,
        },
      ],
    };
  },
});

// ── approveChangeRequest ───────────────────────────────────────────────────

export const approveChangeRequestInputSchema = z.object({
  changeRequestId: z.string().min(1),
  outcome: z.enum(["CONTINUE_PRODUCTION", "REDESIGN"]),
  note: optionalNoteSchema,
});

export const approveChangeRequest = defineCommand({
  action: "change_request.approved",
  input: approveChangeRequestInputSchema,
  permission: "change.approve",
  run: async (ctx) => {
    const { changeRequestId, outcome, note } = ctx.input;

    const cr = await lockChangeRequestInTx(ctx.tx, changeRequestId);
    if (cr.status !== "PENDING") {
      return fail({ code: "CHANGE_REQUEST_ALREADY_DECIDED" });
    }
    const item = await lockWorkItemInTx(ctx.tx, cr.workItemId);
    if (item.state !== "IN_PRODUCTION") {
      return fail({ code: "WORK_ITEM_LEFT_PRODUCTION" });
    }
    if (outcome === "REDESIGN" && !canRedesignOnApproval(item)) {
      return fail({ code: "REDESIGN_NOT_ALLOWED" });
    }

    const applied = await applySpecChangeInTx(ctx, {
      workItemId: item.id,
      actorId: ctx.actor.userId,
      origin: "CHANGE_REQUEST",
      patch: parseStoredPatch(cr.proposedPatch),
      expected: { specVersionId: cr.baseSpecVersionId },
      reason: cr.requestReason,
      changeRequestId,
      ifUnchanged: "fail",
      lockedWorkItem: item,
    });
    if (!applied) {
      return fail({ code: "NO_CHANGES" });
    }

    const decided = await ctx.tx.changeRequest.updateMany({
      where: { id: changeRequestId, status: "PENDING" },
      data: {
        status: "APPROVED",
        outcome,
        decidedById: ctx.actor.userId,
        decidedAt: new Date(),
        decisionNote: note ?? null,
        resultingSpecVersionId: applied.current.id,
      },
    });
    if (decided.count !== 1) {
      return fail({ code: "CHANGE_REQUEST_ALREADY_DECIDED" });
    }

    const { returnId } = await applyApprovalOutcomeInTx(ctx, {
      workItem: item,
      changeRequestId,
      outcome,
      version: applied.current.version,
      reason: cr.requestReason,
    });

    await notify(ctx.tx, {
      type: "work_item.change_approved",
      entity: { type: "WorkItem", id: item.id },
      recipients: { userIds: [cr.requestedById] },
      payload: {
        workItemId: item.id,
        orderId: item.orderId,
        changeRequestId,
        outcome,
        version: applied.current.version,
      },
    });

    return {
      value: { version: applied.current.version, outcome },
      audit: [
        {
          action: "change_request.approved",
          entityType: "ChangeRequest",
          entityId: changeRequestId,
          before: { status: "PENDING" },
          after: {
            status: "APPROVED",
            outcome,
            resultingVersion: applied.current.version,
            returnId,
          },
          reason: note,
        },
      ],
    };
  },
});

// ── rejectChangeRequest / withdrawChangeRequest ────────────────────────────

export const closeChangeRequestInputSchema = z.object({
  changeRequestId: z.string().min(1),
  reason: reasonSchema,
});

type CloseKind = {
  readonly status: "REJECTED" | "WITHDRAWN";
  readonly action: "change_request.rejected" | "change_request.withdrawn";
  readonly notification: "work_item.change_rejected" | "work_item.change_withdrawn";
};

/** Template for the two decisions that write no version and lift the hold at once. */
function defineCloseCommand(kind: CloseKind, permission: "change.approve" | "order.edit") {
  return defineCommand({
    action: kind.action,
    input: closeChangeRequestInputSchema,
    permission,
    run: async (ctx) => {
      const { changeRequestId, reason } = ctx.input;

      const cr = await lockChangeRequestInTx(ctx.tx, changeRequestId);
      if (cr.status !== "PENDING") {
        return fail({ code: "CHANGE_REQUEST_ALREADY_DECIDED" });
      }

      const decided = await ctx.tx.changeRequest.updateMany({
        where: { id: changeRequestId, status: "PENDING" },
        data: {
          status: kind.status,
          decidedById: ctx.actor.userId,
          decidedAt: new Date(),
          decisionNote: reason,
        },
      });
      if (decided.count !== 1) {
        return fail({ code: "CHANGE_REQUEST_ALREADY_DECIDED" });
      }

      const item = await ctx.tx.workItem.findUnique({
        where: { id: cr.workItemId },
        select: { orderId: true, departmentId: true, productType: { select: { defaultDepartmentId: true } } },
      });
      const effDept = item?.departmentId ?? item?.productType?.defaultDepartmentId ?? null;

      await notify(ctx.tx, {
        type: kind.notification,
        entity: { type: "WorkItem", id: cr.workItemId },
        recipients: { userIds: [cr.requestedById], departmentIds: effDept ? [effDept] : [] },
        payload: { workItemId: cr.workItemId, orderId: item?.orderId ?? null, changeRequestId, reason },
      });

      return {
        value: null,
        audit: [
          {
            action: kind.action,
            entityType: "ChangeRequest",
            entityId: changeRequestId,
            before: { status: "PENDING" },
            after: { status: kind.status },
            reason,
          },
        ],
      };
    },
  });
}

export const rejectChangeRequest = defineCloseCommand(
  { status: "REJECTED", action: "change_request.rejected", notification: "work_item.change_rejected" },
  "change.approve",
);

export const withdrawChangeRequest = defineCloseCommand(
  { status: "WITHDRAWN", action: "change_request.withdrawn", notification: "work_item.change_withdrawn" },
  "order.edit",
);

// ── listPendingChangeRequests ──────────────────────────────────────────────

export const PENDING_QUEUE_DEFAULT_LIMIT = 50;
export const PENDING_QUEUE_MAX_LIMIT = 100;

export const listPendingChangeRequestsInputSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PENDING_QUEUE_MAX_LIMIT).default(PENDING_QUEUE_DEFAULT_LIMIT),
});

export type PendingChangeRequestRow = {
  readonly changeRequestId: string;
  readonly workItemId: string;
  readonly orderId: string;
  readonly orderNumber: number;
  readonly customerName: string;
  readonly productTypeName: string | null;
  readonly priority: "NORMAL" | "URGENT";
  readonly requestedByName: string;
  readonly createdAt: Date;
  readonly changedFields: SpecField[];
};

/**
 * The approver queue: urgent first, then oldest first. One query with
 * `include` for any page size (no N+1, FR-017); diffs are computed in memory.
 */
export const listPendingChangeRequests = defineQuery({
  input: listPendingChangeRequestsInputSchema,
  permission: "change.approve",
  run: async ({ client, input }) => {
    const rows = await client.changeRequest.findMany({
      where: { status: "PENDING" },
      orderBy: [{ workItem: { order: { priority: "desc" } } }, { createdAt: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        requestedBy: { select: { name: true } },
        baseSpecVersion: true,
        workItem: {
          select: {
            id: true,
            productType: { select: { name: true } },
            order: {
              select: { id: true, number: true, priority: true, customer: { select: { name: true } } },
            },
          },
        },
      },
    });

    const page = rows.slice(0, input.limit);
    const nextCursor = rows.length > input.limit ? (page.at(-1)?.id ?? null) : null;

    const out: PendingChangeRequestRow[] = page.map((cr) => {
      const base = toSpecVersionView({ ...cr.baseSpecVersion, createdBy: null }).snapshot;
      const changes = diffSpecSnapshots(base, mergeSpecPatch(base, parseStoredPatch(cr.proposedPatch)));
      return {
        changeRequestId: cr.id,
        workItemId: cr.workItem.id,
        orderId: cr.workItem.order.id,
        orderNumber: cr.workItem.order.number,
        customerName: cr.workItem.order.customer.name,
        productTypeName: cr.workItem.productType?.name ?? null,
        priority: cr.workItem.order.priority,
        requestedByName: cr.requestedBy.name,
        createdAt: cr.createdAt,
        changedFields: changedFieldsOf(changes),
      };
    });

    return { rows: out, nextCursor };
  },
});

// ── getChangeRequestDetail ─────────────────────────────────────────────────

export const getChangeRequestDetailInputSchema = z.object({
  changeRequestId: z.string().min(1),
});

export type ChangeRequestDetail = {
  readonly changeRequestId: string;
  readonly status: LockedChangeRequest["status"];
  readonly outcome: "CONTINUE_PRODUCTION" | "REDESIGN" | null;
  readonly isAdminOverride: boolean;
  readonly requestReason: string;
  readonly requestedBy: { readonly id: string; readonly name: string };
  readonly createdAt: Date;
  readonly decidedBy: { readonly id: string; readonly name: string } | null;
  readonly decidedAt: Date | null;
  readonly decisionNote: string | null;
  readonly base: SpecVersionView;
  readonly currentVersion: number | null;
  readonly changes: readonly SpecFieldChange[];
  readonly workItem: {
    readonly id: string;
    readonly orderId: string;
    readonly orderNumber: number;
    readonly customerName: string;
    readonly state: WorkItemState;
    readonly requiresDesign: boolean;
    readonly assigneeId: string | null;
  };
  /** Whether the REDESIGN outcome may be offered (US3-5). */
  readonly canRedesign: boolean;
};

export const getChangeRequestDetail = defineQuery({
  input: getChangeRequestDetailInputSchema,
  permission: "change.approve",
  run: async ({ client, input }): Promise<ChangeRequestDetail> => {
    const cr = await client.changeRequest.findUnique({
      where: { id: input.changeRequestId },
      include: {
        requestedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
        baseSpecVersion: { include: { createdBy: { select: { id: true, name: true } } } },
        workItem: {
          select: {
            id: true,
            state: true,
            requiresDesign: true,
            assigneeId: true,
            currentSpecVersion: { select: { version: true } },
            order: { select: { id: true, number: true, customer: { select: { name: true } } } },
          },
        },
      },
    });
    if (!cr) {
      return fail({ code: "NOT_FOUND", entity: "ChangeRequest", id: input.changeRequestId });
    }

    const base = toSpecVersionView(cr.baseSpecVersion);
    const changes = diffSpecSnapshots(
      base.snapshot,
      mergeSpecPatch(base.snapshot, parseStoredPatch(cr.proposedPatch)),
    );

    return {
      changeRequestId: cr.id,
      status: cr.status,
      outcome: cr.outcome,
      isAdminOverride: cr.isAdminOverride,
      requestReason: cr.requestReason,
      requestedBy: cr.requestedBy,
      createdAt: cr.createdAt,
      decidedBy: cr.decidedBy,
      decidedAt: cr.decidedAt,
      decisionNote: cr.decisionNote,
      base,
      currentVersion: cr.workItem.currentSpecVersion?.version ?? null,
      changes,
      workItem: {
        id: cr.workItem.id,
        orderId: cr.workItem.order.id,
        orderNumber: cr.workItem.order.number,
        customerName: cr.workItem.order.customer.name,
        state: cr.workItem.state,
        requiresDesign: cr.workItem.requiresDesign,
        assigneeId: cr.workItem.assigneeId,
      },
      canRedesign: canRedesignOnApproval(cr.workItem),
    };
  },
});

/** The Work Item's open request, if any — for the order page's withdraw action. */
export async function findPendingChangeRequestId(client: Tx, workItemId: string): Promise<string | null> {
  const row = await client.changeRequest.findFirst({
    where: { workItemId, status: "PENDING" },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Open requests for many Work Items in one query (the order page lists
 * several). The partial unique index guarantees at most one per Work Item.
 */
export async function findPendingChangeRequestIds(
  client: Tx,
  workItemIds: readonly string[],
): Promise<Map<string, string>> {
  if (workItemIds.length === 0) return new Map();
  const rows = await client.changeRequest.findMany({
    where: { workItemId: { in: [...workItemIds] }, status: "PENDING" },
    select: { id: true, workItemId: true },
  });
  return new Map(rows.map((r) => [r.workItemId, r.id]));
}
