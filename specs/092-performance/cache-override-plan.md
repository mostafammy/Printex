# Cache expansion — 092 Phase 12 (owner override of FC-002)

**Status:** plan, not started. **Date:** 2026-09-30.

## Context

§6.9 of `PERFORMANCE_INVESTIGATION.md`: production talks to Supabase's pooler
(`aws-1-eu-west-1.pooler.supabase.com`), not the LAN Postgres the design assumes.
Every *serial* query phase costs a real internet RTT, so a 4-phase page render
pays 4 RTTs. 092 removed waterfalls and N+1s; what remains is round-trip count.

Owner direction: add persistent caching where it is safe, including queues and
workflow reads — an explicit override of 092 spec **FC-002** (the
persistent-cross-request-caching prohibition), in the same class as T047's
override of FC-003. RBAC, permissions and financial authority stay uncached:
FC-002's prohibition is upheld for those, and the override is scoped to
actor-independent reference data and queue reads only.

**The win is smaller than "cache the queues" suggests, and the reason matters:**

- `experimental.staleTimes.dynamic: 15` (T047) *already* serves a repeat
  navigation from the client cache with no server round-trip. A server-side
  cache for the same page only helps past that 15 s window.
- Every queue read is **actor-scoped** (`assigneeId = actor.userId`, or a
  per-role `toPrismaWhere`), so each user gets a private cache entry. Hit rate
  ≈ "same user re-navigates within TTL", not "shared across the shop".
- Any work-item transition must broadcast-invalidate *every* actor's entry. In a
  human-paced shop transitions are rare, so this is affordable — but it means
  the cache buys repeat-read latency, not aggregate throughput.

So this plan is ordered by cost/risk, cheapest first, and **Phase 1 + 2 are the
part that pays for itself**. Phase 3 is the override, and it is scoped to
queues rather than the board — see the exclusion below.

## Approach

### Phase 1 — Request-level dedupe (React `cache()`), zero staleness

`getFinanceConfig()` (`src/server/finance/config.ts:75`) is called 2–3× within
a *single* request: `src/components/finance/record-payment-form.tsx:20` and
`src/components/finance/expense-form.tsx:18` both call it on the same page, and
`src/server/finance/expenses.ts` calls `isActiveCategory` (`:53`) then
`getApprovalThreshold` (`:127`); `payments.ts:54,57` likewise.

Wrap the read in React `cache()`, exactly as `unreadCount` / `readFirstPage`
already do in `src/server/notifications/center.ts:104,124` (T053 precedent).
One RTT per request instead of 2–3, with no staleness window at all.

### Phase 2 — Persistent cache, reference data (actor-independent)

`unstable_cache` + `revalidateTag`, matching the existing pattern in
`src/server/admin/health.ts:139`.

| Function | File | Tag | Invalidated by |
|---|---|---|---|
| `getFinanceConfig` | `src/server/finance/config.ts` | `finance-config` | `updateFinanceConfig` (same file) |
| `listActiveProductTypes` | `src/server/orders/productTypes.ts:25` | `product-types` | the 4 admin mutators in the same file |
| `listRolesWithPermissions` | `src/server/admin/roles.ts:5` | `roles` | no writer exists (read-only page) → `revalidate: 300` only |

The structural property that makes this miss-proof: each table's only writer
lives in the same module as its reader, so the `revalidateTag` call sits ~20
lines from the write. No cross-file wiring, nothing to forget.

### Phase 3 — Queues (the override)

Tag per surface: `queue:reception`, `queue:design`, `queue:pricing`,
`queue:review`, `queue:production`. Cache key = `[surface, userId,
roles.join(","), departmentIds.join(","), page, ...filters]` — explicit string
parts, because `Actor.permissions` is a `Set` and is not serializable.

Rows + stats for `getMyQueuePage`/`getMyQueueStats` (`src/server/designers/queue.ts`),
`getReceptionQueuePage`/`getReceptionQueueStats` (`src/server/orders/search.ts`),
`getPricingQueue` (`src/server/pricing/queue.ts`), `getReviewQueuePage`,
`getOperatorQueuePage`.

Two correctness rules, both non-obvious:

1. **Time-dependent fields are formatted after the cache, never inside it.**
   `getPricingQueue` builds `ageLabel` from `now` (`pricing/queue.ts:78`). A
   cached label freezes. Cache the raw `waitingSince`/`Date` values and call
   `formatQueueAge` at render. Same for any future "x minutes ago" column.
   `ponytail: if a new time-derived column is added to a cached queue, it must
   be computed outside the cache function — otherwise it silently freezes at
   the value from whenever the entry was written.`

2. **Invalidate after commit, never inside the transaction.**
   `revalidateTag` called mid-transaction clears the entry, a concurrent request
   repopulates it from *pre-commit* rows, and that stale value then persists.
   Every call goes *after* the enclosing `db.$transaction(...)` resolves.

**Invalidation wiring pattern** (name it once, apply per writer): all
`WorkItem.state` writes funnel through `transitionWorkItem`
(`src/server/core/workflow/transition.ts:104`) — the sole state mutator — but
`core` imports nothing from `next/*` and must stay pure. So the one-line
`invalidateQueues()` goes *after* the transaction in each calling domain
module. Two existing seams cover most of it:

- `src/server/core/aspects/engine.ts:225` — the `afterCommit` hook list already
  runs post-commit. Registering invalidation there covers every 016
  change-control command in one edit.
- Representative direct writers, same one-line shape after their
  `$transaction`: `src/server/designers/assignment.ts:336`,
  `src/server/orders/sendToProduction.ts:47`, `src/server/production/completion.ts:88`.

A test asserts the choke point can't be bypassed (below), so a future writer
that forgets is caught rather than shipped stale.

### Excluded: the board snapshot

`getBoardSnapshot` is deliberately **not** cached:

- It is already kept live by the `board_transition` SSE stream
  (`prisma/manual-sql/board-transition-notify.sql` + `src/server/board/live/hub.ts`),
  so a cache adds staleness to a surface that is already real-time — and every
  transition would invalidate every actor's copy, which is the exact workload
  the board has.
- Its signature takes an injectable `prismaClient` for tests
  (`src/server/board/snapshot.ts:72`, used by
  `tests/performance/board-snapshot.test.ts`). A runtime client argument cannot
  be a cache key, so caching it means splitting the API and keeping the
  injectable path uncached anyway.

If the board is ever a measured problem, the fix is fewer serial phases inside
it, not a cache.

## Files

New: `src/server/cache/queues.ts` (tags + `invalidateQueues()` helper).

Modified: `src/server/finance/config.ts`, `src/server/orders/productTypes.ts`,
`src/server/admin/roles.ts`, `src/server/designers/queue.ts`,
`src/server/orders/search.ts`, `src/server/pricing/queue.ts`,
`src/server/review/queue.ts`, `src/server/production/queue.ts`,
`src/server/core/aspects/engine.ts`, the three representative writers above,
`next.config.js` (unchanged — `staleTimes` stays the client tier).

`specs/092-performance/LINEAR_PERFORMANCE_ISSUES.md` + the spec's FC-004 line get
an owner-override note, matching how T047 was recorded.

## Verification

**The one runnable check that matters** — `tests/integration/cacheMechanism.test.ts`.
The repo already mocks `next/cache` in `tests/integration/bellRefresh.test.ts:90`;
this test does the same with a working in-memory `unstable_cache` (keyed by
tags + key parts) and asserts the three properties the whole design rests on:

1. second call to a cached read issues **0** DB queries, via the existing
   `captureQueries` helper (`tests/helpers/queryCount.ts:56`) + `dbMockFactory`;
2. `revalidateTag` forces exactly one re-read;
3. **cross-user isolation** — two actors with the same permissions but different
   `userId` do not share an entry, and invalidating for actor A leaves actor B's
   entry intact.

Plus a per-surface assertion that each cached queue's domain module re-invokes
`invalidateQueues()` on its write path.

Then:

- `pnpm vitest run tests/integration/cacheMechanism.test.ts`
- `pnpm check` (typecheck + lint)
- full `pnpm vitest run` — the 092 query-count suites
  (`shell-layout-queries`, `queryCount`, `board-snapshot`,
  `orderDetailOrchestration`, `sharedFirstPage`) must still pass, since they
  assert query counts that caching only lowers.
- `pnpm build` — config parse.

**Manual, two browsers** (this is the part no unit test can prove):

1. User A on `/my-queue`, user B on `/pricing`.
2. B drags a card on `/board` that changes A's queue membership.
3. A hard-refreshes and within the TTL must see the change — a stale A here is
   the design's one real risk, and it is invisible to a single-user test.
4. Repeat with a second A-profile to confirm no cross-user bleed in the bell and
   queues.

Measure before/after on `/my-queue` and `/reception/new` and record it in the
092 spec. If Phase 3 does not produce a visible win, revert Phase 3 and keep
Phases 1–2 — they have no staleness downside.
