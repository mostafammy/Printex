// returns.ts — createReturn (generic write path, User Story 6, T024).
// contracts/review-rework.md's `createReturn` section, research.md §3
// (StorageAdapter reuse), data-model.md's `Return`/`ReturnAttachment` models.
//
// Transaction-shape choice (documented per the task brief): `designVersions.ts`
// has no tx-taking helper of its own — `uploadDesignVersion` writes bytes
// outside a transaction, then opens its own `db.$transaction` inline. But
// `rejectDesign` (review.ts) needs this same "write the Return row" step to
// run INSIDE its own already-open transaction (constitution III: rejection +
// notification are atomic), and Prisma's interactive transactions cannot be
// nested. So this module exports three layers instead of `assignment.ts`'s
// single inlined-per-branch shape:
//   1. `uploadReturnAttachments` — pure byte-writing via StorageAdapter.put,
//      called BEFORE any transaction opens (mirrors uploadDesignVersion's
//      ordering), returning already-persisted attachment metadata.
//   2. `createReturnInTx(tx, ...)` — the actual `Return`/`ReturnAttachment`
//      row write, taking a caller-supplied `tx`. This is the "given
//      transaction" write path contracts/review-rework.md describes, and is
//      what `rejectDesign` calls directly inside its own transaction.
//   3. `createReturn(actor, workItemId, input)` — the public, contract-frozen
//      generic entry point (no tx parameter, matching the contract's exact
//      signature for 014/051 to call later): uploads attachment bytes, then
//      opens its own `db.$transaction` and delegates to `createReturnInTx`.
// `rejectDesign` reuses steps 1 and 2 directly (not step 3) so its Return
// write and its `notify()` call share one transaction with the state
// transition, per the contract's "not duplicated logic" note.

import type { Prisma } from "../../../generated/prisma";
import { env } from "~/env";
import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import { LocalDiskStorageAdapter } from "~/server/core";
import type { RejectionCategory } from "~/server/core";

// Module-level singleton, same lazy-global pattern as `designVersions.ts`
// (research.md §3 — 013 follows 012's precedent of building directly on
// `StorageAdapter`, no new storage backend).
const globalForStorage = globalThis as unknown as {
  reviewStorageAdapter: LocalDiskStorageAdapter | undefined;
};
const storageAdapter =
  globalForStorage.reviewStorageAdapter ?? new LocalDiskStorageAdapter(env.STORAGE_ROOT);
if (env.NODE_ENV !== "production") globalForStorage.reviewStorageAdapter = storageAdapter;

export type ReturnAttachmentKind = "VOICE_NOTE" | "IMAGE" | "FILE";

export interface ReturnAttachmentFile {
  readonly kind: ReturnAttachmentKind;
  readonly fileName: string;
  readonly mimeType?: string;
  readonly stream: NodeJS.ReadableStream;
}

interface UploadedReturnAttachment {
  readonly kind: ReturnAttachmentKind;
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType?: string;
  readonly sizeBytes: number;
}

export interface CreateReturnInput {
  readonly category: RejectionCategory;
  readonly originDepartmentId: string;
  readonly assignedToId: string;
  readonly explanation: string;
  readonly note?: string;
  readonly designVersionId?: string;
  readonly attachments?: readonly ReturnAttachmentFile[];
}

/**
 * Writes attachment bytes via `StorageAdapter.put` BEFORE any transaction's
 * metadata commit (same ordering `designVersions.ts`'s `uploadDesignVersion`
 * uses — network/disk I/O should not hold a transaction open). Returns
 * metadata only; no DB write happens here. Called with an empty/undefined
 * list resolves to `[]` immediately (the "abandoned voice note" edge case —
 * no attachment, no storage write, nothing to roll back).
 */
export async function uploadReturnAttachments(
  workItemId: string,
  attachments?: readonly ReturnAttachmentFile[],
): Promise<UploadedReturnAttachment[]> {
  if (!attachments || attachments.length === 0) return [];

  const uploaded: UploadedReturnAttachment[] = [];
  for (const [index, attachment] of attachments.entries()) {
    const storageKey = `returns/${workItemId}/${Date.now()}-${index}-${attachment.fileName}`;
    const { size } = await storageAdapter.put(storageKey, attachment.stream);
    uploaded.push({
      kind: attachment.kind,
      storageKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: size,
    });
  }
  return uploaded;
}

/**
 * The generic `Return`/`ReturnAttachment` write path, run inside the
 * caller's own transaction (contracts/review-rework.md `createReturn` step
 * 2 — "this function does not transition the Work Item"). `attachments` here
 * are already-uploaded metadata (from `uploadReturnAttachments`), never raw
 * streams — bytes must already be on disk before this runs.
 */
export async function createReturnInTx(
  tx: Prisma.TransactionClient,
  actor: Actor,
  workItemId: string,
  input: CreateReturnInput,
  uploadedAttachments: UploadedReturnAttachment[] = [],
): Promise<{ returnId: string }> {
  const created = await tx.return.create({
    data: {
      workItemId,
      raisedById: actor.userId,
      originDepartmentId: input.originDepartmentId,
      category: input.category,
      assignedToId: input.assignedToId,
      explanation: input.explanation,
      note: input.note,
      designVersionId: input.designVersionId,
      attachments: {
        create: uploadedAttachments.map((a) => ({
          kind: a.kind,
          storageKey: a.storageKey,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
      },
    },
  });

  return { returnId: created.id };
}

/**
 * Public, contract-frozen entry point (User Story 6) — NO `authorize()`
 * beyond the caller being an authenticated `Actor`: the shape and write path
 * are generic, not Review-gated (contracts/review-rework.md `createReturn`
 * step 1). A future 014/051 caller performs its own permission check before
 * invoking this, and — if it also needs a state change — wraps its own
 * `transitionWorkItem` call around a direct call to `createReturnInTx`
 * inside its own transaction, the same way `rejectDesign` does.
 */
export async function createReturn(
  actor: Actor,
  workItemId: string,
  input: CreateReturnInput,
): Promise<{ returnId: string }> {
  const uploadedAttachments = await uploadReturnAttachments(workItemId, input.attachments);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    return createReturnInTx(tx, actor, workItemId, input, uploadedAttachments);
  });
}
