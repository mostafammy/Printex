// Work Item state literal union — plan.md §5.2, §5.3, §5.4.
//
// A `const` array + `as const` (not a bare `enum`) keeps this tree-shakeable
// and gives exhaustive `switch` checking via `never`, which TypeScript
// `enum` does not.

export const WORK_ITEM_STATES = [
  "NEW",
  "ASSIGNED",
  "IN_DESIGN",
  "DESIGN_COMPLETED",
  "WAITING_REVIEW",
  "REWORK_REQUIRED",
  "APPROVED",
  "WAITING_PRICING",
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION",
  "PRODUCTION_COMPLETED",
  "READY_FOR_COLLECTION",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type WorkItemState = (typeof WORK_ITEM_STATES)[number];

/**
 * Exhaustiveness guard for `switch (state)` statements over `WorkItemState`
 * (and other closed unions). By construction this is unreachable at runtime:
 * TypeScript only allows calling it with a value of type `never`, i.e. once
 * every case has been handled. Its only job is to make the compiler fail
 * loudly the moment a new state is added to `WORK_ITEM_STATES` but some
 * `switch` elsewhere isn't updated to handle it. This is the one sanctioned
 * exception to "no throw in core" (plan.md §5.3) beyond the storage-adapter
 * carve-out, precisely because it exists to be unreachable, not to signal a
 * real runtime failure.
 */
export function assertNever(x: never): never {
  // eslint-disable-next-line no-restricted-syntax -- exhaustiveness guard, unreachable by construction
  throw new Error(`Unreachable: unexpected value ${JSON.stringify(x)}`);
}
