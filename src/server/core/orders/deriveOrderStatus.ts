// Derived Order status — data-model.md "Order Status Derivation (bucket
// rule, from /speckit-clarify)" and contracts/orders.md. Order status is
// NEVER a stored column (constitution I, spec FR-008); this is the single
// authoritative implementation of the bucket calculation, called at read
// time against an already-fetched slice of the Order's Work Items.

import type { WorkItemState } from "~/server/core/workflow/states";

export type OrderStatusBucket =
  | "NOT_STARTED"
  | "IN_PRODUCTION"
  | "PARTIALLY_READY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

const PRE_PRODUCTION: readonly WorkItemState[] = ["NEW", "ASSIGNED"];

/**
 * Pure, synchronous bucket calculation for an Order's derived status, given
 * the `state` of every one of its Work Items. No I/O, no Prisma — callers
 * fetch the Work Item slice themselves and pass it in.
 *
 * Zero-Work-Item behavior: contracts/orders.md documents this as undefined
 * behavior — callers MUST NOT invoke this before at least one Work Item
 * exists (constitution I: an Order without Work Items shouldn't be
 * displayed as "in progress" of anything). This function does not throw
 * (core functions never throw — plan.md §5.3), so it does not guard against
 * an empty array with a runtime error. With zero Work Items, nonCancelledStates
 * is empty and guarded by `length > 0`, so this falls through to `NOT_STARTED`
 * (the first unguarded `every`-based branch reached, vacuously true).
 * That result is meaningless and callers are responsible for never
 * producing it in practice.
 *
 * The CANCELLED branch additionally guards with `.some((s) => s ===
 * "CANCELLED")` before its `.every()` — this is NOT an empty-array guard
 * (an empty array would already vacuously satisfy the `.some()` check to
 * be false, so it doesn't change the empty-array outcome described above).
 * It exists for a *non-empty* array: CANCELLED must mean "every Work Item
 * is CANCELLED", and a plain `.every((s) => s === "CANCELLED")` alone
 * would already correctly reject any non-empty array containing a
 * non-CANCELLED state. The `.some()` check is there so this branch reads
 * as "at least one CANCELLED item exists AND all items are CANCELLED"
 * rather than relying on the reader to notice `.every()` alone already
 * encodes that for non-empty input — it's a clarity/defensive-redundancy
 * addition for the non-empty case, not a fix for the shared empty-array
 * vacuous-truth issue every other `every()`-based branch here has too.
 */
export function deriveOrderStatus(
  workItems: readonly { state: WorkItemState }[],
): OrderStatusBucket {
  const states = workItems.map((w) => w.state);

  if (states.some((s) => s === "CANCELLED") && states.every((s) => s === "CANCELLED")) {
    return "CANCELLED";
  }

  const nonCancelledStates = states.filter((s) => s !== "CANCELLED");

  if (
    nonCancelledStates.length > 0 &&
    nonCancelledStates.every((s) => s === "COMPLETED")
  ) {
    return "COMPLETED";
  }

  if (
    nonCancelledStates.length > 0 &&
    nonCancelledStates.every((s) => s === "DELIVERED" || s === "COMPLETED")
  ) {
    return "DELIVERED";
  }

  if (states.every((s) => PRE_PRODUCTION.includes(s))) {
    return "NOT_STARTED";
  }

  // At this point at least one state is outside PRE_PRODUCTION (the
  // "all pre-production" branch above already returned), so the
  // "not all pre-production" leg of the pseudocode is guaranteed here.
  const anyInProduction = states.some((s) => s === "IN_PRODUCTION");
  const anyDeliveredOrCompleted = states.some(
    (s) => s === "DELIVERED" || s === "COMPLETED",
  );

  if (anyInProduction && !anyDeliveredOrCompleted) {
    return "IN_PRODUCTION";
  }

  return "PARTIALLY_READY";
}
