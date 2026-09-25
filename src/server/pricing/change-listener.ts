// 016 spec-change pricing reset — contracts/spec-change-reset.md.
//
// 016 exports `registerSpecChangeListener` from `~/server/changes`, but 016 is
// not implemented in this tree yet (plan.md: "tasks remain blocked at the
// contract boundary"). This module therefore keeps the listener logic and the
// registration as two pure pieces: `pricingResetListener` is the exact
// listener 016 will run, and `registerPricingResetListener` binds it under
// the frozen name `pricing.reset` through whichever registry function 016
// (or a contract test double) supplies. The barrel re-exports both so the
// boot path can wire it with one line once `registerSpecChangeListener`
// exists.

import type { Prisma } from "../../../generated/prisma";
import { audit } from "~/server/auth";
import { persistPricingStatus } from "./status";

export const PRICING_RESET_LISTENER_NAME = "pricing.reset";

/** Mirror of 016's frozen `SpecChangedEvent` (contracts/events-and-ports.md §1). */
export type SpecChangedEvent = {
  readonly type: "work_item.spec_changed";
  readonly workItemId: string;
  readonly orderId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly specVersionId: string;
  readonly origin: "DIRECT_EDIT" | "CHANGE_REQUEST" | "ADMIN_OVERRIDE";
  readonly changeRequestId: string | null;
  readonly changedFields: readonly string[];
  readonly workItemState: string;
  readonly actorId: string;
  readonly occurredAt: Date;
};

/** Mirror of 016's frozen `SpecChangeListener` signature (tx first). */
export type SpecChangeListener = (
  tx: Prisma.TransactionClient,
  event: SpecChangedEvent,
) => Promise<void>;

/**
 * The `pricing.reset` listener.
 *
 * Obligations (contracts/spec-change-reset.md):
 * - uses ONLY the supplied transaction — no nested transaction, no external
 *   I/O, no UI calls; unexpected errors propagate so 016 rolls back the
 *   whole spec change together with this reset;
 * - any existing pricing status row (PRICED, DISPUTED, or already-PENDING)
 *   is reset to PENDING, `waitingSince` is set (or retained), the
 *   current-price association and any stale dispute reason are cleared;
 * - WorkItemPrice history rows are never touched (append-only);
 * - the affected specification version is recorded in
 *   `pricing.reset_after_spec_change`'s audit payload;
 * - a numeric price that happens to be unchanged still resets: the
 *   explanation changed.
 */
export const pricingResetListener: SpecChangeListener = async (tx, event) => {
  const existing = await tx.pricingStatus.findUnique({
    where: { workItemId: event.workItemId },
    select: { status: true, currentPriceId: true, waitingSince: true },
  });

  // Waiting age starts at the spec change for items that had no status row
  // yet; existing unresolved rows keep their original waitingSince so 053's
  // delay alerts do not restart on every spec edit.
  const waitingSince =
    existing?.waitingSince ?? (existing ? undefined : event.occurredAt);

  await persistPricingStatus(tx, {
    workItemId: event.workItemId,
    status: "PENDING",
    waitingSince,
    disputeReason: null,
    currentPriceId: null,
    updatedById: event.actorId,
  });

  await audit.record(tx, {
    action: "pricing.reset_after_spec_change",
    entityType: "PricingStatus",
    entityId: event.workItemId,
    actorId: event.actorId,
    before: {
      status: existing?.status ?? null,
      currentPriceId: existing?.currentPriceId ?? null,
    },
    after: {
      status: "PENDING",
      specVersionId: event.specVersionId,
      fromVersion: event.fromVersion,
      toVersion: event.toVersion,
    },
  });
};

/**
 * Binds the listener under the frozen `pricing.reset` name. Registration is
 * replace-by-name (016 contract), so calling this from the pricing barrel
 * and from 016's boot path is idempotent under hot reload and test
 * re-imports.
 */
export function registerPricingResetListener(
  register: (name: string, listener: SpecChangeListener) => void,
): void {
  register(PRICING_RESET_LISTENER_NAME, pricingResetListener);
}
