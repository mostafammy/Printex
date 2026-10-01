// Cache tags + invalidation helpers — 092-performance Phase 12 (owner
// override of spec FC-004, which prohibited persistent caching of
// workflow/queue reads). Same class of override as T047's `staleTimes`
// override of FC-003; see specs/092-performance/cache-override-plan.md.
//
// TWO RULES THIS FILE EXISTS TO ENFORCE
//
// 1. INVALIDATE AFTER COMMIT, NEVER INSIDE THE TRANSACTION. `revalidateTag`
//    called mid-transaction drops the entry; a concurrent request then
//    repopulates it from rows the not-yet-committed transaction hasn't
//    written, and that pre-commit value persists until the next invalidation.
//    Every `invalidate*` call belongs AFTER the enclosing `db.$transaction`
//    has resolved — see `src/server/core/aspects/engine.ts`'s `afterCommit`
//    list for the existing seam that already runs at the right time.
//
// 2. QUEUE CACHE KEYS ARE BUILT FROM STRINGS ONLY. `Actor.permissions` is a
//    `Set<Permission>` and is not serializable; passing the Actor itself
//    silently produces a key that ignores permissions entirely — a
//    cross-user data leak, because the two actors are indistinguishable to
//    the cache. `queueKeyParts` flattens the Actor to the strings that
//    actually determine the result set.

import { revalidateTag } from "next/cache";
import type { Actor } from "~/server/auth";

/** Actor-independent reference data. Each tag's only writer lives in the same
 *  module as its reader, so the `revalidateTag` call sits ~20 lines from the
 *  write — nothing cross-file to forget. */
export const CACHE_TAGS = {
  financeConfig: "finance-config",
  productTypes: "product-types",
  roles: "roles",
} as const;

/** One tag per queue surface. `invalidateQueues()` with no argument clears
 *  all of them, which is what a `WorkItem.state` write needs: a transition
 *  can move a card between any two queues, and every actor's cached copy of
 *  every queue is now potentially wrong. */
export const QUEUE_TAGS = {
  reception: "queue:reception",
  design: "queue:design",
  pricing: "queue:pricing",
  review: "queue:review",
  production: "queue:production",
} as const;

export type QueueSurface = keyof typeof QUEUE_TAGS;

/**
 * Flattens an Actor into the strings that determine a queue's result set.
 *
 * `roles` and `departmentIds` are part of the key because board/reception
 * visibility is role- and department-derived (`src/server/board/visibility.ts`
 * `toPrismaWhere`), not user-derived — two users with identical permissions but
 * different departments genuinely see different rows. `permissions` is
 * intentionally NOT flattened to a string: it is a Set, the ordering is not
 * stable enough to hash meaningfully, and every queue caller has already
 * `authorize()`d or narrowed by permission before reaching the cached read. If
 * a future cached read's rows depend on `actor.permissions`, add the specific
 * permission keys it checks here — do not pass the Set.
 */
export function actorScopeKey(actor: Actor): string {
  const roles = [...actor.roles].sort().join(",");
  const departments = [...actor.departmentIds].sort().join(",");
  return `${actor.userId}|${roles}|${departments}`;
}

/**
 * The `unstable_cache` keyParts for a queue read: the surface, the actor
 * scope, then the caller's own filter/page values. Explicit string parts —
 * `unstable_cache` requires them to be strings, and they must fully determine
 * the result or two different reads will share one entry.
 */
export function queueKeyParts(
  surface: QueueSurface,
  actor: Actor,
  ...filters: ReadonlyArray<string | number | boolean | null | undefined>
): string[] {
  return [QUEUE_TAGS[surface], actorScopeKey(actor), ...filters.map((f) => String(f ?? ""))];
}

/**
 * `revalidateTag` with a store-existence guard.
 *
 * In a request or server-action context this is a no-op-with-a-store; with NO
 * store — a plain-Vitest call into a server module, or a background interval
 * started from `instrumentation.ts` — Next throws ("static generation store
 * missing"). Domain code is called from all three places, so the guard lives
 * HERE rather than at each call site: a per-call-site try/catch is something a
 * future writer can forget, and a forgotten one fails a test loudly but fails
 * production silently.
 *
 * Swallowing the throw is safe in the no-store case because there is nothing
 * to invalidate — no cache entry can have been written by a request-less
 * caller. In a real request the tag IS dropped, so correctness is unchanged.
 */
function revalidateTagSafely(tag: string): void {
  try {
    revalidateTag(tag);
  } catch {
    // No Next cache store in this context — nothing cached to invalidate.
  }
}

/**
 * Drops cached reference data. Safe to call from any context.
 */
export function invalidateReferenceData(tag: string): void {
  revalidateTagSafely(tag);
}

/**
 * Drops cached queue reads. Call with a surface to drop one; call with no
 * argument after any `WorkItem.state` write to drop them all.
 *
 * MUST be called after commit — see rule 1 at the top of this file.
 */
export function invalidateQueues(surface?: QueueSurface): void {
  if (surface) {
    revalidateTagSafely(QUEUE_TAGS[surface]);
    return;
  }
  for (const tag of Object.values(QUEUE_TAGS)) {
    revalidateTagSafely(tag);
  }
}
