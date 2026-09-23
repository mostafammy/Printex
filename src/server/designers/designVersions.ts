// designVersions.ts — uploadDesignVersion, markDesignComplete (US4).
// contracts/designer-assignment.md's `uploadDesignVersion`/`markDesignComplete`
// sections, research.md §4 (DesignVersion storage decision), research.md §5
// (why markDesignComplete is two chained transitionWorkItem calls).

import type { Prisma } from "../../../generated/prisma";
import { env } from "~/env";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  closeOpenSegment,
  asUserId,
  asWorkItemId,
  LocalDiskStorageAdapter,
} from "~/server/core";
import type { Actor as CoreActor, DomainError } from "~/server/core";
import { DomainDesignerError } from "./errors";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

// Module-level singleton, same lazy-global pattern as `src/server/db.ts` —
// `StorageAdapter`'s only implementation today (research.md §4); 050 may
// later inject a different one, but no seam for that exists yet upstream.
const globalForStorage = globalThis as unknown as {
  designerStorageAdapter: LocalDiskStorageAdapter | undefined;
};
const storageAdapter =
  globalForStorage.designerStorageAdapter ?? new LocalDiskStorageAdapter(env.STORAGE_ROOT);
if (env.NODE_ENV !== "production") globalForStorage.designerStorageAdapter = storageAdapter;

// ── uploadDesignVersion (US4) ────────────────────────────────────────────

export interface UploadDesignVersionFile {
  readonly stream: NodeJS.ReadableStream;
  readonly fileName: string;
  readonly mimeType?: string;
}

/**
 * Uploads a new, versioned design file for a Work Item currently `IN_DESIGN`.
 * Does NOT change `WorkItem.state` (FR-016) — that is `markDesignComplete`'s
 * job. Bytes are streamed to `storageAdapter.put()` OUTSIDE the DB
 * transaction (network/disk I/O should not hold a transaction open;
 * contracts/designer-assignment.md).
 */
export async function uploadDesignVersion(
  actor: Actor,
  workItemId: string,
  file: UploadDesignVersionFile,
  note?: string,
): Promise<{ designVersionId: string; version: number }> {
  authorize(actor, "design.work");

  const workItem = await db.workItem.findUniqueOrThrow({ where: { id: workItemId } });
  if (workItem.assigneeId !== actor.userId) {
    throw new DomainDesignerError("NOT_ASSIGNEE", "Only the assigned designer may upload a design version.");
  }
  if (workItem.state !== "IN_DESIGN") {
    throw new DomainDesignerError("NOT_IN_DESIGN", "The Work Item must be in IN_DESIGN to upload a design version.");
  }

  // Compute a best-effort next version number for the storage key — the
  // authoritative version number is (re-)computed inside the transaction
  // below to avoid a TOCTOU race; this is only used to keep storage keys
  // human-legible.
  const priorCount = await db.designVersion.count({ where: { workItemId } });
  const storageKey = `design-versions/${workItemId}/${priorCount + 1}-${file.fileName}`;

  const { size, sha256 } = await storageAdapter.put(storageKey, file.stream);

  let designVersionId!: string;
  let version!: number;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    version = 1 + (await tx.designVersion.count({ where: { workItemId } }));

    const created = await tx.designVersion.create({
      data: {
        workItemId,
        version,
        storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: size,
        sha256,
        note,
        uploadedById: actor.userId,
      },
    });
    designVersionId = created.id;

    await audit.record(tx, {
      action: "designversion.uploaded",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { version, fileName: file.fileName, note },
    });
  });

  return { designVersionId, version };
}

// ── markDesignComplete (US4) ─────────────────────────────────────────────

/**
 * Marks an `IN_DESIGN` Work Item design-complete, requiring at least one
 * uploaded `DesignVersion` (FR-017), closing any open `ACTIVE` timer segment
 * (FR-018), then chaining two `transitionWorkItem` calls — `IN_DESIGN →
 * DESIGN_COMPLETED` then `DESIGN_COMPLETED → WAITING_REVIEW`/`APPROVED`
 * depending on `requiresReview` — both inside the same `db.$transaction`
 * (research.md §5). No separate `audit.record`: the `WorkItemTransition`
 * rows `transitionWorkItem` writes are this call's audit trail.
 */
export async function markDesignComplete(actor: Actor, workItemId: string): Promise<void> {
  authorize(actor, "design.work");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await tx.workItem.findUniqueOrThrow({ where: { id: workItemId } });

    if (workItem.assigneeId !== actor.userId) {
      throw new DomainDesignerError("NOT_ASSIGNEE", "Only the assigned designer may mark design complete.");
    }
    if (workItem.state !== "IN_DESIGN") {
      throw new DomainDesignerError("NOT_IN_DESIGN", "The Work Item must be in IN_DESIGN to mark design complete.");
    }

    const designVersionCount = await tx.designVersion.count({ where: { workItemId } });
    if (designVersionCount === 0) {
      throw new DomainDesignerError(
        "NO_DESIGN_VERSION",
        "At least one design version must be uploaded before marking design complete.",
      );
    }

    await closeOpenSegment(tx, { workItemId: asWorkItemId(workItemId), kind: "ACTIVE" });

    const coreActor = toCoreActor(actor);

    const first = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "DESIGN_COMPLETED",
      actor: coreActor,
    });
    if (!first.ok) {
      throw new WorkItemDesignTransitionError(first.error);
    }

    const second = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: workItem.requiresReview ? "WAITING_REVIEW" : "APPROVED",
      actor: coreActor,
    });
    if (!second.ok) {
      throw new WorkItemDesignTransitionError(second.error);
    }
  });
}

/**
 * Surfaces `transitionWorkItem`'s own `Result` error unchanged when
 * `markDesignComplete`'s chained transitions are refused — mirrors
 * `src/server/orders/cancelOrder.ts`'s `WorkItemTransitionError`. Not
 * wrapped in `DomainDesignerError` since `transitionWorkItem` already owns
 * the audit write for the transition itself.
 */
export class WorkItemDesignTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemDesignTransitionError";
    this.error = error;
  }
}
