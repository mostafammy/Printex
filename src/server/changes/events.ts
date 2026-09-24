// events.ts — SPEC_CHANGED event and listener registry.
// contracts/events-and-ports.md §1 (specs/016-change-control/contracts/events-and-ports.md).

import type { Prisma } from "../../../generated/prisma";
import {
  notify,
  fail,
  AspectDomainError,
  AspectMisuseError,
  type WorkItemState,
} from "~/server/core";
import type { SpecField } from "./specFields";

export const SPEC_CHANGED = "work_item.spec_changed" as const;

export type SpecChangedEvent = {
  readonly type: typeof SPEC_CHANGED;
  readonly workItemId: string;
  readonly orderId: string;
  readonly fromVersion: number; // >= 1
  readonly toVersion: number; // fromVersion + 1
  readonly specVersionId: string; // the new version
  readonly origin: "DIRECT_EDIT" | "CHANGE_REQUEST" | "ADMIN_OVERRIDE";
  readonly changeRequestId: string | null; // non-null for CHANGE_REQUEST and in-production overrides
  readonly changedFields: readonly SpecField[]; // non-empty, SPEC_FIELDS order
  readonly workItemState: WorkItemState; // state at emission time (before any redesign transition)
  readonly actorId: string;
  readonly occurredAt: Date;
};

export type SpecChangeListener = (
  tx: Prisma.TransactionClient,
  event: SpecChangedEvent,
) => Promise<void>;

const listeners = new Map<string, SpecChangeListener>();

/**
 * Registers an in-transaction listener for SPEC_CHANGED events.
 * Replaces any existing listener registered with the same name (idempotent under hot reload).
 */
export function registerSpecChangeListener(
  name: string,
  listener: SpecChangeListener,
): void {
  listeners.set(name, listener);
}

/**
 * Test-only hook to clear registered listeners between test runs.
 * Not exported from the barrel.
 */
export function __resetSpecChangeListenersForTests(): void {
  listeners.clear();
}

function isAspectDomainError(err: unknown): err is AspectDomainError {
  return err instanceof AspectDomainError;
}

/**
 * Emits a SPEC_CHANGED event inside the caller's transaction.
 * 1. Runs registered listeners sequentially in registration order.
 * 2. Writes one notify outbox row for delivery.
 */
export async function emitSpecChangedInTx(
  tx: Prisma.TransactionClient,
  event: SpecChangedEvent,
): Promise<void> {
  for (const [name, listener] of listeners.entries()) {
    try {
      await listener(tx, event);
    } catch (err) {
      if (isAspectDomainError(err)) {
        const code = err.error.code;
        if (code !== "SPEC_CHANGE_VETOED") {
          throw new AspectMisuseError(`listener ${name} raised foreign code ${code}`);
        }
        throw err;
      }
      throw err;
    }
  }

  const item = await tx.workItem.findUnique({
    where: { id: event.workItemId },
    select: {
      assigneeId: true,
      departmentId: true,
      productType: { select: { defaultDepartmentId: true } },
    },
  });

  if (!item) {
    return fail({
      code: "NOT_FOUND",
      entity: "WorkItem",
      id: event.workItemId,
    });
  }

  const assigneeId = item.assigneeId ?? undefined;
  const effectiveDepartmentId =
    item.departmentId ?? item.productType?.defaultDepartmentId ?? undefined;

  const recipientUserIds: string[] = assigneeId ? [assigneeId] : [];
  const recipientDepartmentIds: string[] = effectiveDepartmentId
    ? [effectiveDepartmentId]
    : [];

  await notify(tx, {
    type: SPEC_CHANGED,
    entity: { type: "WorkItem", id: event.workItemId },
    recipients: {
      userIds: recipientUserIds,
      departmentIds: recipientDepartmentIds,
    },
    payload: {
      type: event.type,
      workItemId: event.workItemId,
      orderId: event.orderId,
      fromVersion: event.fromVersion,
      toVersion: event.toVersion,
      specVersionId: event.specVersionId,
      origin: event.origin,
      changeRequestId: event.changeRequestId,
      changedFields: [...event.changedFields],
      workItemState: event.workItemState,
      actorId: event.actorId,
      occurredAt: event.occurredAt.toISOString(),
    },
  });
}
