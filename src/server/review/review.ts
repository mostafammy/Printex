// review.ts — getReviewDetail, approveDesign, rejectDesign (US2/US3,
// T015, T016, T023, T025). contracts/review-rework.md's matching sections,
// data-model.md's Validation rules, research.md §2/§4.

import type { Prisma } from "../../../generated/prisma";
import { z } from "zod";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  notify,
  asUserId,
  asWorkItemId,
} from "~/server/core";
import type { Actor as CoreActor, DomainError, WorkItemState } from "~/server/core";
import type { RejectionCategory } from "~/server/core";
import { DomainReviewError } from "./errors";
import { createReturnInTx, uploadReturnAttachments } from "./returns";
import type { ReturnAttachmentFile } from "./returns";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

/**
 * Surfaces `transitionWorkItem`'s own `Result` error unchanged — mirrors
 * 012's `assignment.ts`/`designVersions.ts` `WorkItemTransitionError`
 * convention: NOT wrapped in `DomainReviewError`, since `transitionWorkItem`
 * already owns the audit write for the transition itself. This is also the
 * error surfaced when the pre-registered no-self-review guard (T006) fails
 * (`GUARD_FAILED`, research.md §4) — approveDesign does not re-implement
 * that check.
 */
export class WorkItemTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemTransitionError";
    this.error = error;
  }
}

// ── getReviewDetail (US2) ────────────────────────────────────────────────

export interface VersionSummary {
  readonly id: string;
  readonly version: number;
  readonly fileName: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number;
  readonly note: string | null;
  readonly uploadedById: string;
  readonly uploadedAt: Date;
  readonly approvedAt: Date | null;
  readonly approvedById: string | null;
}

export interface ReviewDetail {
  readonly workItemId: string;
  readonly state: WorkItemState;
  readonly order: {
    readonly orderId: string;
    readonly orderNumber: number;
    readonly customerName: string;
    readonly quantity: number | null;
    readonly widthValue: string | null;
    readonly heightValue: string | null;
    readonly dimensionUnit: string | null;
    readonly material: string | null;
    /// Read from `WorkItem.finishNotes` — the closest existing 011 field to
    /// "customer notes recorded on the order" (spec.md US2 Acceptance
    /// Scenario 1); no dedicated `Order.customerNotes` column exists
    /// (data-model.md's `order: { ... customerNotes, ... }` is read "from
    /// existing Order/WorkItem fields (011)", not a new column this feature
    /// adds).
    readonly customerNotes: string | null;
  };
  readonly versions: VersionSummary[];
  readonly currentVersion: VersionSummary | null;
}

function toVersionSummary(v: {
  id: string;
  version: number;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  note: string | null;
  uploadedById: string;
  createdAt: Date;
  approvedAt: Date | null;
  approvedById: string | null;
}): VersionSummary {
  return {
    id: v.id,
    version: v.version,
    fileName: v.fileName,
    mimeType: v.mimeType,
    sizeBytes: v.sizeBytes,
    note: v.note,
    uploadedById: v.uploadedById,
    uploadedAt: v.createdAt,
    approvedAt: v.approvedAt,
    approvedById: v.approvedById,
  };
}

export async function getReviewDetail(actor: Actor, workItemId: string): Promise<ReviewDetail> {
  authorize(actor, "design.review");

  const workItem = await db.workItem.findUnique({
    where: { id: workItemId },
    include: {
      order: { include: { customer: { select: { name: true } } } },
      designVersions: { orderBy: { version: "asc" } },
    },
  });
  if (!workItem) {
    throw new DomainReviewError("WORK_ITEM_NOT_FOUND", "Work item not found");
  }

  const versions = workItem.designVersions.map(toVersionSummary);
  const currentVersion = versions.length > 0 ? versions[versions.length - 1]! : null;

  return {
    workItemId: workItem.id,
    state: workItem.state,
    order: {
      orderId: workItem.order.id,
      orderNumber: workItem.order.number,
      customerName: workItem.order.customer.name,
      quantity: workItem.quantity,
      widthValue: workItem.widthValue?.toString() ?? null,
      heightValue: workItem.heightValue?.toString() ?? null,
      dimensionUnit: workItem.dimensionUnit,
      material: workItem.material,
      customerNotes: workItem.finishNotes,
    },
    versions,
    currentVersion,
  };
}

// ── shared load/guard helper (approveDesign + rejectDesign) ─────────────

async function loadReviewableCurrentVersion(
  tx: Prisma.TransactionClient,
  workItemId: string,
): Promise<{
  workItem: { id: string; state: WorkItemState; assigneeId: string | null; orderId: string };
  currentVersion: { id: string; uploadedById: string };
}> {
  const workItem = await tx.workItem.findUnique({
    where: { id: workItemId },
    select: { id: true, state: true, assigneeId: true, orderId: true },
  });
  if (!workItem) {
    throw new DomainReviewError("WORK_ITEM_NOT_FOUND", "Work item not found");
  }
  if (workItem.state !== "WAITING_REVIEW") {
    throw new DomainReviewError("NOT_REVIEWABLE", `Work item state ${workItem.state} is not reviewable`);
  }

  const currentVersion = await tx.designVersion.findFirst({
    where: { workItemId },
    orderBy: { version: "desc" },
    select: { id: true, uploadedById: true },
  });
  if (!currentVersion) {
    throw new DomainReviewError("NO_DESIGN_VERSION", "Work item has no design version to review");
  }

  return { workItem, currentVersion };
}

// ── approveDesign (US2) ──────────────────────────────────────────────────

export async function approveDesign(actor: Actor, workItemId: string): Promise<void> {
  authorize(actor, "design.review");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const { currentVersion } = await loadReviewableCurrentVersion(tx, workItemId);

    // The pre-registered no-self-review guard (src/server/review/guards.ts,
    // T006) runs inside transitionWorkItem here — this function does not
    // re-implement that comparison (research.md §4).
    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "APPROVED",
      actor: toCoreActor(actor),
    });
    if (!result.ok) {
      throw new WorkItemTransitionError(result.error);
    }

    await tx.designVersion.update({
      where: { id: currentVersion.id },
      data: { approvedAt: new Date(), approvedById: actor.userId },
    });

    await audit.record(tx, {
      action: "workitem.design_approved",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { designVersionId: currentVersion.id },
    });
  });
}

// ── rejectDesign (US3) ───────────────────────────────────────────────────

// `~/server/core`'s barrel only re-exports `RejectionCategory` as a TYPE
// (not the runtime `REJECTION_CATEGORIES` tuple `core`'s own
// `workflow/rejectionCategory.ts` declares) — a deep import of that
// module's internals from outside `src/server/core/**` is a lint error
// (eslint.config.js module-boundary rule (b)). This tuple is duplicated
// here, literal-for-literal, purely so Zod has a runtime enum to validate
// against; `RejectionCategory` (the type) still keeps both in sync at
// compile time.
const REJECTION_CATEGORIES = [
  "DESIGN_ISSUE",
  "DIMENSION_ISSUE",
  "CUSTOMER_CHANGE",
  "PRICING_ISSUE",
  "ACCOUNTING_ISSUE",
  "PRODUCTION_ISSUE",
  "MISSING_INFORMATION",
  "OTHER",
] as const satisfies readonly RejectionCategory[];

const returnAttachmentKindSchema = z.enum(["VOICE_NOTE", "IMAGE", "FILE"]);

// data-model.md's Validation rules: category required, originDepartmentId
// required, explanation required non-empty-after-trim, note/attachments
// optional. `attachments[].stream` is validated structurally (not by Zod —
// a NodeJS.ReadableStream has no useful Zod shape); Zod only checks the
// metadata fields Zod can meaningfully validate.
export const rejectDesignInputSchema = z.object({
  category: z.enum(REJECTION_CATEGORIES),
  originDepartmentId: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  note: z.string().trim().min(1).optional(),
  attachments: z
    .array(
      z.object({
        kind: returnAttachmentKindSchema,
        fileName: z.string().trim().min(1),
        mimeType: z.string().trim().min(1).optional(),
        stream: z.custom<NodeJS.ReadableStream>((v) => v !== undefined && v !== null),
      }),
    )
    .optional(),
});

export interface RejectDesignInput {
  readonly category: RejectionCategory;
  readonly originDepartmentId: string;
  readonly explanation: string;
  readonly note?: string;
  readonly attachments?: readonly ReturnAttachmentFile[];
}

export async function rejectDesign(
  actor: Actor,
  workItemId: string,
  input: RejectDesignInput,
): Promise<{ returnId: string }> {
  authorize(actor, "design.review");

  // Validated BEFORE opening a transaction (contracts/review-rework.md
  // `rejectDesign` step 2) — a bad submission never even reaches the DB.
  const validated = rejectDesignInputSchema.parse(input);

  // Attachment bytes are written before the transaction's metadata commit
  // (same ordering `uploadDesignVersion` uses — research.md §3, returns.ts).
  const uploadedAttachments = await uploadReturnAttachments(workItemId, validated.attachments);

  let returnId!: string;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const { workItem, currentVersion } = await loadReviewableCurrentVersion(tx, workItemId);

    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "REWORK_REQUIRED",
      actor: toCoreActor(actor),
      reason: validated.explanation,
      rejectionCategory: validated.category,
    });
    if (!result.ok) {
      throw new WorkItemTransitionError(result.error);
    }

    // A Work Item reaching WAITING_REVIEW always has an assignee (set at its
    // ASSIGNED transition and never cleared, 012) — defensive-only, not a
    // contract-documented error code.
    if (!workItem.assigneeId) {
      throw new Error(`Work item ${workItemId} has no assignee to notify on rejection`);
    }

    const created = await createReturnInTx(
      tx,
      actor,
      workItemId,
      {
        category: validated.category,
        originDepartmentId: validated.originDepartmentId,
        assignedToId: workItem.assigneeId,
        explanation: validated.explanation,
        note: validated.note,
        designVersionId: currentVersion.id,
      },
      uploadedAttachments,
    );
    returnId = created.returnId;

    // Same transaction as the Return write (FR-009, SC-003, constitution III).
    await notify(tx, {
      type: "workitem.rejected",
      entity: { type: "WorkItem", id: workItemId },
      recipients: { userIds: [workItem.assigneeId] },
      payload: { returnId, orderId: workItem.orderId },
    });
  });

  return { returnId };
}
