# Research: Navigation Responsiveness & Server-Side Fetch Efficiency

Phase 0 for `/speckit-plan`. Every open technical choice plan.md's slices depend on is resolved here. Evidence base: `PERFORMANCE_INVESTIGATION.md` (§6 bottlenecks, §17 fixes, §21 measurements); decisions cite spec IDs (FR-/AC-/PR-/contract #) and the Clarifications Session 2026-09-29 instead of restating prose.

## Decision: Overlay removal is a boot-only split by deletion — the navigation arming path is removed, not zeroed

**Decision**: In `src/components/loading/app-boot-loader.tsx` delete the `pointerdown` effect, `isNavigating` state, `navTimeoutRef`/`NAV_FALLBACK_TIMEOUT_MS`, and the pathname-commit clear effect; render `<LoadingExperience isLoading={isBooting} />`. `SHOW_DELAY_MS`/`MIN_VISIBLE_MS`/`COMPLETE_MS` remain only inside the boot branch of the phase machine (FR-002). No overlay element, armed state, or timer is reachable from any navigation mechanism (FR-001, FR-003, NB-001).

**Rationale**: Clarifications Q1 chose Option A and explicitly rejected the zeroed-timer variant. Zeroing (`MIN_VISIBLE_MS = 0` for navigation) keeps the entire arming mechanism alive — a mounted overlay element with flash-prone transitions, an input-blocking class one bad branch away, and a full set of constants/effects whose only purpose is the feature being deleted: dead weight whose maintenance cost is permanent and whose benefit is "still looks like code for a feature we removed" (BC-006: loader constants are removed for navigation, never repurposed). Deletion also makes the edge cases structural rather than filter-dependent: the skip-link hash jump and `router.push` uniformity (NB-002) hold because there is no listener to mis-classify a click, in either direction (§6.1 confirmed the old filter was wrong both ways). Boot is a separate signal (double-rAF `isBooting`) rendering the same component, so AC-002 holds by construction.

**Alternatives considered**:

- Zeroed timers for navigation (investigation §17 Fix A's "safer variant") — rejected per Clarifications Q1: dead code, flash-prone mounted overlay, stale constants for a deleted behavior.
- Replacement progress indicator — out of scope as a dependency: FR-004 is MAY gated on product sign-off (T010*), never part of acceptance; shipping it in the same change would put new navigation UI in front of the removal this story exists to land.

## Decision: Bell re-read transport is a server action behind the existing `revalidate` seam

**Decision**: A no-input server action beside the mark-read actions in `src/app/(shell)/notifications/actions.ts` (e.g. `revalidateBellAction`): `getActor()` → `Promise.all([unreadCount(actor), listNotifications(actor, { page: 1, pageSize: 10 })])` → return `{ count, rows }`. The shell layout passes it as the bell's `revalidate` prop; the prop type widens to `() => Promise<{ count: number; rows: NotificationView[] }>` (Clarifications Q2, contract #3); the bell applies the resolved payload to local `count`/`rows` with latest-response-wins and drops `router.refresh()` on every success path (FR-019, FR-020). The re-read itself is never cached (FC-004).

**Rationale**:

- **The seam vs. the transport are different questions.** Clarifications Q2 fixed the delivery shape (prop returns `{count, rows}`; the rejected "direct server-action alternative" was the bypass-the-seam variant) and left mechanism behind the seam open per TR-006. plan.md S6 says "choose server action unless the stream contract favors a route": the 053 stream contract states only that "Server Actions and route handler in the same feature own the fallback" — no preference, so the tie breaks to the house pattern.
- **Ownership and precedent**: `ui.md:142` already documents this exact file as 053's action surface (`revalidatePath("/notifications")` + refresh shell count). The post-mark-read immediate count re-read required by Clarifications Q2 then runs through the same boundary as the mutation it follows — one surface, one auth path, one error path.
- **Auth/scoping (SEC-003, TR-006)**: `getActor()` inside the action is the identical entry-point authentication `markReadAction` already uses; row scoping is inherited verbatim from `unreadCount`/`list` (`userId = actor.userId`, `archivedAt: null`).
- **FC-004 structurally**: a server action is a POST executed per call — an HTTP cache can never serve it. A GET route would depend on remembering `Cache-Control: no-store` on every deployment, and notification data on a shared shop-LAN browser profile is exactly the data that must never be cached by accident.
- **No new surface (SEC-005)**: a server action adds no route of any kind; a GET `/api/notifications/bell` would be a new authenticated endpoint with its own scoping-test surface for zero behavioral gain.
- **Failure path unchanged (FR-022, AC-016)**: a rejected action lands in the bell's existing `catch` → `setError(true)` → retry re-calls the same action; polling continues. `toView()` already emits ISO strings, so `{count, rows}` crosses the action boundary with no shape work.

**Alternatives considered**:

- GET route handler `/api/notifications/bell` (investigation Fix F) — rejected: pairs with the SSE route but creates a second authenticated read surface, needs no-store header discipline, and the stream contract shows no route preference; the 053-owned action file already exists.
- Client-side fetch of notification data — rejected (SEC-004: the read path is the single authority; the stream deliberately sends identifiers only, `use-notification-stream.ts`).
- `router.refresh()` retained for mark-read only — rejected per Clarifications Q2 (mark-read gets the targeted re-read too).

## Decision: Review queue paginates with offset `skip`/`take` over a lightweight sort-key pass — page-number URLs preserved

**Decision**: `getReviewQueuePage` keeps the existing house engine (`PageRequest`/`PageResult` from `src/server/pagination.ts` — `nextCursor` is contractually a plain page number, `?page=N` links everywhere) and replaces fetch-everything-then-`paginateInMemory` with a two-step bounded fetch:

1. **Key pass**: `state = "WAITING_REVIEW"` selecting only `id`, `createdAt`, `order.priority`, and `transitions: { where: { to: "WAITING_REVIEW" }, orderBy: { at: "desc" }, take: 1, select: { at } }` — exactly the one transition the code reads (FR-029 first clause; kills §6.11's full-history over-fetch).
2. Sort keys in memory with the **identical comparator** (URGENT first, then oldest `enteredQueueAt`; `enteredQueueAt` = that transition's `at` ?? `createdAt`), slice `[skip, skip + pageSize + 1]`.
3. **Row pass**: fetch the full payload (`order`+customer, `productType`, rework `groupBy`) only for the sliced IDs, re-ordered into key order → `PageResult.fromOverfetch`.

`getReviewQueueStats` (full-backlog count aggregates) is untouched — statistics and paged rows describe the same backlog (FR-029). No cap exists anywhere: offset over the full key list ⇒ every backlog row reachable across pages (Clarifications Q3, AC-021). The frozen `getReviewQueue` plain-array export (013 contract, exercised only by `tests/contract/review`) keeps its full-backlog semantics and gains the `take: 1` transition shape; no production render path calls it — `review/page.tsx` uses `getReviewQueuePage` exclusively.

**Rationale**: the sort spans a relation (`order.priority`) plus a derived timestamp (transition history) — the file's own comment documents this cannot be one Prisma `orderBy`, so a key pass is the _minimum_ work that preserves displayed ordering and the entered-queue timestamp exactly (DF-005, AC-021's timestamp assertion). The key pass moves only scalar columns per backlog row; the expensive row payload is bounded at source to one page. Reusing `PageRequest` keeps URL semantics, clamping, and `hasMore` math identical — zero UI or contract churn.

**Alternatives considered**:

- Cursor/keyset pagination — rejected: `PageResult.nextCursor` is contractually a plain page number (`pagination.ts`: "every caller in this codebase renders a `?page=N` link"), and the two-part sort key (relation priority + derived timestamp) has no stable column set to cursor on.
- Raw SQL `ORDER BY` with joins reproducing urgent-first/`enteredQueueAt` — rejected: reimplements the contract-tested comparator in SQL (drift risk vs `tests/contract/review`) for no query-count win; house `$queryRaw` is used for locks/health, not list semantics.
- Fixed-cap `take` or page-window-only `take` — rejected per Clarifications Q3 (truncation / stranded rows).
- Transition `take: 1` only, keep whole-backlog row fetch + `paginateInMemory` — rejected per Clarifications Q3: leaves the unbounded scan (full order/customer/productType payload for the entire backlog every request).

## Decision: Designer eligibility is five set-based reads — constant ≤ 10 on the 5×4 fixture

**Decision**: `getEligibleDesignersBatch(actor, workItemIds)` added to `src/server/designers/assignment.ts` (single-item export retained). `authorize(actor, "workitem.assign_designer")` runs first (in-memory, 0 queries); empty input → `{}` with zero queries (contract #5). Then exactly five reads in one `Promise.all` (all `IN`-shaped, none per-item):

| #   | Read                                                                                                                                                                                                                                                | Single-path parity                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `workItem.findMany({ where: { id: { in: ids } }, select: { id, state, order.customerId } })`                                                                                                                                                        | per-id `findUnique`; missing id → `WORK_ITEM_NOT_FOUND`, non-assignable → `NOT_ASSIGNABLE` thrown from the batch (same abort semantics as the sequential loop)          |
| 2   | `findActiveDesignWorkHolders()` (unchanged shared helper)                                                                                                                                                                                           | candidate base                                                                                                                                                          |
| 3   | `workItem.groupBy({ by: ["assigneeId"], where: { assigneeId: { in: designerIds }, state: { notIn: [...TERMINAL] } }, _count })`                                                                                                                     | per-designer `activeWorkItemCount` (absent key → 0)                                                                                                                     |
| 4   | `workItem.groupBy({ by: ["assigneeId"], where: { assigneeId: { in: designerIds }, state: { in: ["DELIVERED","COMPLETED"] }, order: { customerId } }, _count })`                                                                                     | `pastJobsForCustomer`; the order page passes one order ⇒ one customer ⇒ 1 query. Multi-customer input ⇒ one query per distinct customer (never produced by the page)    |
| 5   | `$queryRaw` `SELECT DISTINCT ON (wi."assigneeId") wi."assigneeId", t."at" FROM "WorkItemTransition" t JOIN "WorkItem" wi ON wi."id" = t."workItemId" WHERE t."to" = 'ASSIGNED' AND wi."assigneeId" = ANY($1) ORDER BY wi."assigneeId", t."at" DESC` | latest `ASSIGNED` transition per designer — same predicate as single-path `findFirst({ where: { to: "ASSIGNED", workItem: { assigneeId } }, orderBy: { at: "desc" } })` |

Assembly and `suggestDesigner` are pure JS (`suggestion.ts` takes `DesignerLoadCandidate[]`): per-item suggestion runs against the shared candidate base — with one order customer every item's candidates are identical (customer-scoped `pastJobsForCustomer` constant), matching what repeated single-path calls compute byte-for-byte.

**Total: 5 queries, constant in W and D** — clears Clarifications Q4's ≤10 ceiling with margin on the exact 5-item × 4-designer fixture (AC-009), and the banned constant-per-item fan-out (3 × 5 = 15) fails the ceiling by construction. Independent of W: every read is one `IN` over the full ID set; independent of D: no per-designer query exists.

**Rationale**: Prisma `groupBy` accepts relation filters in `where` while grouping on the model's scalars — that is the native set-based form of the three per-candidate counts, with automatic 0-defaults matching `count` semantics. Read #5 must be `$queryRaw` because Prisma `distinct` cannot target a relation field (`workItem.assigneeId`) and `groupBy` cannot return "max `at` per assignee" across the join; house precedent for `$queryRaw` exists (`admin/health.ts`, `core/aspects/transition.ts`, `changes/*` locks). Per-row error parity is defined on single-bad-id inputs (what the contract test exercises); mixed assignable/non-assignable batches are the caller's pre-filtered responsibility — the order page already filters `DESIGNER_ASSIGNABLE_STATES` before calling (FR-014's loop is exactly that filter's current home).

**Alternatives considered**:

- `Promise.all` over per-item `getEligibleDesigners` (investigation Fix D's fallback) — rejected: still O(W × D) queries — "wider fan-out over a per-item storm," explicitly banned by FR-014; exceeds the ≤10 ceiling.
- Per-designer `findFirst` loop for #5 (D queries) — rejected: not constant in D (AC-009 requires the count constant as W **and** D vary).
- `findMany` all ASSIGNED transitions + JS reduce for #5 — rejected: unbounded history transfer — precisely the §6.11 anti-pattern ("fetch whole history to read one element") this feature exists to remove.
- Raw SQL for all five reads — rejected: only #5 needs SQL; the rest are typed, greppable Prisma.
- Three separate per-candidate `Promise.all`s widened to the batch (the current `assignment.ts:91-109` shape over D designers) — rejected: same fan-out, just re-timed.

## Decision: `phaseDurationsByIds` = 2 queries + a shared pure compute helper

**Decision**: In `src/server/designers/timer.ts`: (a) extract the pure math from `phaseDurations` (:165-199) into `computePhaseDurations(segments, transitions)` — `QUEUE_COUNTED_PHASES`/active filtering, `calculatePhaseDurationMs`, and the `DESIGN_COMPLETED`-vs-last-`ASSIGNED`/`REWORK_REQUIRED` `totalPhaseDurationMs` incl. its `null` case — so single and batch share one implementation (FR-017 by construction); (b) `phaseDurationsByIds(actor, ids)` runs exactly two queries in one `Promise.all`: `phaseTiming.findMany({ where: { workItemId: { in: ids } } })` and `workItemTransition.findMany({ where: { workItemId: { in: ids }, to: { in: ["DESIGN_COMPLETED","ASSIGNED","REWORK_REQUIRED"] }, orderBy: { at: "asc" } })` — group by `workItemId` in JS → `Map<id, PhaseDurations>` (contract #4).

**Rationale**: query count is page-size-independent (PR-003/AC-011: 2 at one row, 2 at N rows). A global `orderBy at asc` preserves each item's sub-order, so grouped rows hit `computePhaseDurations` in exactly the order the single-path query returns — equivalence (AC-012) is the shared helper plus identical inputs, not a re-implementation under test. Scoping (FR-018/AC-013): the loader's `where` contains only the passed IDs; the page passes `rows.map(r => r.workItemId)` from `getMyQueuePage`'s actor-scoped rows (`assigneeId = actor.userId`), and the loader widens nothing — cross-user IDs cannot enter unless the caller passes them, and the caller's rows are already authorization-filtered. Empty segments/transitions degrade to the same defaults the single path computes from empty reads (`0/0/null`). Display-only posture unchanged — no `authorize` added or removed (matches the existing helper's documented stance).

**Alternatives considered**:

- SQL-side duration aggregation — rejected: moves constitution-III duration math (BC-002: persisted timestamps) into a second implementation, defeating FR-017's shared-helper guarantee.
- Extending `getMyQueuePage`'s `include` to cover full durations — rejected: it already includes a _differently-shaped_ `phaseTimings` slice (`kind: ACTIVE, endedAt: null` for `hasOpenTimer`); a second divergence-prone shape on the same relation is how drift starts, and the 2-query batch is contract-pinned (#4).
- Keeping per-row `Promise.all` — status quo, O(rows) round-trips (the thing PR-003 bans).

## Decision: Shell layout lands at ≤4 queries / ≤2 phases via duplicate deletion + display-field widening + session-cache unification

**Decision**: The post-change layout path:

- **Phase 1** `await getActor()` — two genuinely sequential queries: (i) session lookup, now through the existing `cache()`-wrapped `getSession()` (`src/server/better-auth/server.ts:5`) instead of `auth.api.getSession` directly, so `/` (`page.tsx`), `/auth/required`, and the shell share one request cache (FR-012); (ii) `getActorForSession`'s RBAC include query (dependent on (i)'s `userId`). `Actor` widens with `name: string | null` / `username: string | null` populated from **that same include row** (`include` without `select` already returns the scalars; the current return drops them at `getActor.ts:77`) — zero new queries (FR-010, contract #1). `isActive` throw, expiry checks, and `UnauthenticatedError` paths untouched (SEC-001).
- **Phase 2** `await Promise.all([unreadCount(actor), listNotifications(actor, { page: 1, pageSize: 10 })])` — unchanged parallel pair.
- `layout.tsx` deletes the `db.user.findUnique({ select: { name, username } })` block entirely; header reads `actor.name ?? "مستخدم برينتكس"` (FR-008; AC-006's Arabic fallback unchanged). The `CoreActor` bridge is untouched — display fields are additive (FR-010). Instrumentation idempotent backstops (:65-66) untouched.

Result: **4 queries, 2 phases, zero duplicate current-user reads** (PR-002, AC-005). The deleted read was provable redundancy — both upstream rows already carried the fields (§6.3, §13 #1/#2); session-cache unification removes the latent second lookup (§13 #3).

**Rationale**: notifications depend on `actor.userId` (end of phase 1) but not on the RBAC graph, so a theoretical overlap exists — but reaching it requires `getActor`'s `cache()`-wrapped API to surface an intermediate `userId`, a new seam that complicates the once-per-request guarantee AC-007 pins. The 2-phase baseline already removes everything measured as waste; the overlap variant is measurement-gated (plan S3: "if measurements show benefit").

**Alternatives considered**:

- Phase-overlap variant (notifications fired after session while RBAC still resolves) — deferred, not rejected: adopt only if §21 measurement post-change shows the layout still dominates; costs an API seam for a second-order win.
- Taking display fields from Better Auth's session `result.user` instead of the RBAC row — rejected: same query count but two possible sources for one field (drift risk); one source, the row already loaded.
- Any persistent cache for actor/session, or enabling Better Auth `cookieCache` — rejected (FC-002): a cached session can mask `isActive` refusals (spec edge case: "session valid but user deactivated — no caching layer may mask it").
- Reading `name`/`username` with a third narrow query — rejected: that is the duplicate being deleted (AC-005).

## Decision: Query-count tests capture Prisma `query` events at the `db` singleton through one shared helper

**Decision**: `tests/helpers/queryCount.ts` — the only new test infra (plan Complexity Tracking). It formalizes the pattern already living inline in `tests/contract/changes/guards.test.ts:15-24` and `tests/integration/changes/approverQueue.test.ts`: a factory for `vi.mock("~/server/db", …)` that swaps the app singleton for a test `PrismaClient` (`datasourceUrl: process.env.DATABASE_URL_TEST`, `log: [{ emit: "event", level: "query" }]`, `$on("query", …)` appending SQL strings to a shared buffer), plus `resetQueries()`, `queries()`, and `captureQueries(fn)` → `{ result, queries }`.

Methodology rules:

- Seed with `testDb` (uninstrumented) **before** capturing; capture only the SUT window (buffer resets at capture start).
- AC-005's "no duplicate display read" is a **shape** assertion: no captured statement matches the deleted query's exact projection (`SELECT "name", "username" FROM "User"`) — deterministic, no timing.
- Phase bounds are **happens-before edges** in issue order (session ⇒ RBAC ⇒ notification pair), which awaited sequential phases guarantee; the notification pair's parallelism is additionally a source-level `Promise.all` assertion. No wall-clock thresholds anywhere — flaky under pooler latency and a backdoor for invented ms values.
- AC-009/AC-011 count within the same window at two fixture sizes (5×4 and larger; 1 row vs N rows) asserting ceiling/constancy constants.

**Rationale**: PR-008 and Test Expectations §2 require query counts to be mechanically assertable; capturing at the singleton sees every service query regardless of call depth. `vi.mock` is file-scoped, so the mock must be declared per test file — exporting the factory keeps three (now N) copies from drifting into different instrumentation, and the app's `db.ts` keeps its deliberate stdout-only dev logging (`PRISMA_LOG_QUERIES=1`) untouched.

**Alternatives considered**:

- Adding `emit: "event"` to the app `db.ts` client — rejected: changes production/dev logging config for tests and still wouldn't reach tests that construct their own clients.
- Instrumenting `testDb` — rejected: services import `~/server/db`, not `testDb`; capture would see zero SUT queries.
- Parsing `PRISMA_LOG_QUERIES=1` stdout — rejected: dev-only, untyped, no per-call grouping.
- Per-test ad-hoc mock copies — rejected: already duplicated twice; a third pattern is drift (plan Complexity Tracking names this).

## Decision: Both `(shell)/loading.tsx` and targeted Suspense — they fire at different moments

**Decision**: Both, with disjoint jobs: (1) `src/app/(shell)/loading.tsx` — one inherited segment boundary, skeleton markup only, `aria-busy`, no data (SR-001, contract #2, AC-003). (2) `<Suspense fallback={skeleton}>` at exactly the three FR-006 sites — `<OrderFinancePanel>`, per-row `<SpecHistory>` (the `detail.workItems.map` region ~`page.tsx:1059`), `<CustomerBalanceTab>` (SR-002, AC-004).

**Rationale**: `loading.tsx` governs the _soft-navigation paint_: without a segment boundary the router holds the old route until the entire target RSC render resolves (§6.2) — one file fixes all 25+ `(shell)` routes at once. Once page rendering has started, `loading.tsx` has done its job; an async child with no boundary of its own still blocks the remainder of the payload (`SpecHistory` is 2 serial queries × N rows inside a `.map`), so in-page Suspense is what lets panels stream _after_ shell paint. Neither substitutes for the other: `loading.tsx`-only leaves SR-002 unmet (finance/history/balance gate page completion), and Suspense-only means either hand-wrapping `{children}` in the layout (reimplementing the loading boundary per segment) or wrapping each of 25+ pages individually — many edits to recreate one file, while still needing the three panel wraps.

**Alternatives considered**:

- `loading.tsx` alone — rejected (SR-002/AC-004 fail).
- Suspense-only — rejected (above; also loses the idiomatic file Next's router uses for instant segment fallbacks).
- Wider Suspense coverage (per-lane board content, other §12c serializations) — out: spec Assumptions scopes those to a later slice if measurement shows value; FR-006 names three sites.

## Decision: Route-change a11y is skeleton `aria-busy` only

**Decision**: `aria-busy` skeleton semantics on `(shell)/loading.tsx` and the three panel fallbacks; nothing else. No `aria-live` region, no focus movement, no focus retention on unmounting content (Clarifications Q5, SR-003 as written). Existing landmarks (`main#main-content`, banner) and the skip link remain the assistive-navigation affordances; NB-002 makes the skip link overlay-free for free.

**Rationale**: the overlay removal deletes a _visual_ interruption; announcements are new UX the clarification explicitly declined to invent. An `aria-live` route announcer would fire on every soft navigation (~25 routes' worth of skeleton noise for RTL screen-reader users); a post-commit focus move steals focus mid-task; retaining focus on an unmounting skeleton is focus loss by definition. `aria-busy` is the one semantic that honestly describes a skeleton (FR-007 "honest skeletons") with zero behavioral surface — and it reuses existing shell styling/logical properties (BC-005).

**Alternatives considered**: `aria-live` announcements — rejected (Q5); post-commit focus moves — rejected (Q5); focus held on the unmounting skeleton — rejected (Q5); document-level `aria-busy` — rejected: landmark-level busy on the skeleton region is sufficient and would also misfire during boot.

## Decision: DB verification is a four-step evidence ladder with DDL hard-gated behind step 2

**Decision**: Everything lands in `specs/092-performance/db-verification.md` (contract #8, TR-007); DDL tasks are unactionable until it exists (FR-025, AC-019):

1. **Repo evidence (no DB; starts day one)**: prove which tree `migrate deploy` consumes — `package.json` `prisma.schema = "prisma/schema"` + `prismaSchemaFolder` (confirmed `prisma/schema/schema.prisma:9`) → `prisma migrate status` (reports the migrations directory it resolved) plus full inventory of `prisma/migrations/` (6 dirs, incl. `workitem_order_perf_indexes` and `WorkItem_state_idx`) vs `prisma/schema/migrations/` (4 dirs), 091's `0_baseline` plan, compose `migrate deploy` (`specs/091-deploy-backup/contracts/compose.md`), CI's `db push`. Conclude which tree a production deploy actually consumes (DB-001a).
2. **DB evidence (needs reachability)**: `prisma migrate status` against the target; `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('workitem','order','notification','audit_event','file_object')` (DB-001b); `EXPLAIN (ANALYZE, BUFFERS)` for the three navigation-path patterns — board lane sort (`lanePage`), notification list (`center.ts`), order-detail audit probe (`orders/[orderId]/page.tsx:456`) (DB-001d).
3. **P1001 handling**: unreachable → record the verbatim failure and **stop**; every DDL task stays blocked and no index is assumed missing (FR-028, AC-019). Slices S1–S7/S9 ship untouched — verification gates only its own DDL.
4. **Conditional DDL**: only if step 2 shows R1 (`WorkItem_state_createdAt_id_idx`), R2 (`Notification_userId_archivedAt_createdAt_idx`), R3 (`audit_event_entityId_action_createdAt_idx`) absent and/or `FileObject_sha256_idx` still present → **one** migration in the tree step 1 proved authoritative (never `db push` over prod — 091 rules), with DB-005 write-cost notes (R1 state churn, R3 hot table) reviewed at DDL time and a drop-index companion plan. Any deploy-drift finding is filed against 091's baseline work — never reconciled inside 092 (FR-027, DB-004, AC-020).

**Rationale**: the migration-split premise is LIKELY, not proven (§6.10 blocked on `P1001`), and CI `db push` environments may already carry R1–R3 — speculative DDL risks re-creating existing indexes or writing into the wrong tree, and DDL is the feature's only irreversible step. The ladder separates what is provable from files alone (step 1) from what needs a live database (step 2), so progress never waits on environment while safety always does.

**Alternatives considered**:

- Applying R1–R3 speculatively ("code-derived, clearly missing") — rejected (FR-026: verification first is the entire point; §9 labels them provisional until the SQL runs).
- `prisma db push` to reconcile trees — rejected: 091 owns migration reconciliation; `db push` over prod is forbidden (091 rules).
- Skipping step 1 and creating in the newer-looking tree — rejected: that _is_ the drift risk step 1 exists to defuse.
- Bundling index work into S1–S7 — rejected: would make every read-shape slice depend on an environment nobody controls (spec: verification blocks only its own DDL).

## Decision: Measurement is query-count properties + DevTools observations — no millisecond SLAs anywhere

**Decision**: three instruments, each mapped to properties already written as falsifiable counts:

1. **Deterministic query counts in CI** via the queryCount helper (AC-005/009/011, PR-008) — the regression gate; counts at two fixture sizes per surface.
2. **`PRISMA_LOG_QUERIES=1`** in dev (`src/server/db.ts` already supports it) for before/after per-surface SQL counts and slowest-statement identification (investigation §21.3) — recorded in each slice's PR description.
3. **Browser DevTools** for the perceived rows: pointerdown → loader-unmount showing the overlay floor is gone (PR-001), RSC-fetch TTFB per route (§21.2), poll-vs-navigation interference (§21.6). Plus "resolved-by 092" pointers per rank in `PERFORMANCE_INVESTIGATION.md` (T045).

**Rationale**: every PR-001…PR-008 is a count or zero-ness property — queries ≤4, phases ≤2, duration queries O(1), eligibility ≤10, route re-executions 0, document reloads 0, raw internal anchors 0, overlay time 0 — each mechanically assertable or directly observable, none needing a time budget to be falsifiable. ms targets would be unverifiable across the remote-pooler-vs-LAN topology spread (SC-011: no optimization assumes the remote dev DB) and would contradict the spec's explicit "properties, not invented millisecond SLAs."

**Alternatives considered**:

- Millisecond budgets ("nav < X ms") — rejected (spec Performance Requirements preamble; topology variance makes any fixed number a coin flip).
- Synthetic benchmark suite — rejected (YAGNI: before/after counts per PR plus the acceptance flows cover it).
- "Feels faster" manual judgment — rejected as sole evidence (§14: dev-mode compile/render overhead distorts feel; numbers come from the three instruments).

## Decision: Explicit non-choices the plan will not reopen

**Decision**: Settled constraints, restated so plan-time "optimizations" cannot relitigate them:

- **No persistent caching** (FC-002): no `unstable_cache`, tag caches, long `revalidate`, or Better Auth `cookieCache`. Operational reads (RBAC, workflow, queues, pricing, permissions) reflect committed state per request (FC-005); a cached session can mask `isActive` (SEC-001). Only request-level memoization (FC-001) — the pre-existing `cache()` pattern on `getActor`/`getSession`.
- **No `staleTimes` tuning** (FC-003): client route-cache behavior is measure-then-specify in a future feature (§18.12); defaults stay.
- **No topology change** (BC-007, SC-011): no pooler/RTT/connection-string work as a fix; the remote dev DB remains a measurement amplifier only, and every fix must read identically on the LAN target.
- **Progress indicator deferred** (FR-004 MAY, T010*): product-sign-off-gated, absent from acceptance, must not share a slice with the overlay removal (no two indicators coexist).
- **`getCurrentPrice` batching stays conditional** (FR-032, BC-003): `pnpm test:pricing` green unmodified or the serial loops remain — the task carries no commitment to ship.
- **No new entities, write paths, dependencies, or routes**: Key Entities = none new; TR-002 (no new package/store), TR-005 (read-side concurrency only), SEC-005 (no new route).

**Rationale**: spec Notes for Planning calls this out directly — "the plan must not 'solve' latency with caches" — and each item is a decided spec constraint (citations above), not an open question. Recording them here is what stops a slice from "helpfully" widening scope.

**Alternatives considered**: none — these are constraints, not choices.

## Stack facts verified

| Fact                                                                                                                                                                                                                                                                                                              | Evidence                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Next.js 15.5.25** installed (`^15.2.3` declared) — App Router, `loading.tsx`/Suspense/RSC streaming semantics                                                                                                                                                                                                   | `node_modules/next`; every authenticated route `ƒ (Dynamic)` (§11)                                                      |
| **React 19.3.0** — `cache()` available and already in use                                                                                                                                                                                                                                                         | installed; `getActor.ts:93`, `better-auth/server.ts:5`                                                                  |
| **Prisma 6.19.3** (CLI + client), multi-file schema via `prismaSchemaFolder` (`prisma/schema/schema.prisma:9`), `package.json` `prisma.schema: "prisma/schema"`, generated client at `generated/prisma`                                                                                                           | installed / files read                                                                                                  |
| **Vitest 5.0.1** — node env, `fileParallelism: false`, `maxWorkers: 1`, 20 s timeout, `DATABASE_URL_TEST` via `tests/setup-env.ts`; query-event mock precedent exists                                                                                                                                             | `vitest.config.ts`, `guards.test.ts`, `approverQueue.test.ts`                                                           |
| **Better Auth ^1.3** session path: `auth.api.getSession({ headers })` → session+user join (1 DB hit; no `cookieCache` configured) → `getActorForSession` RBAC include (1 query); `getActor` is `cache()`-wrapped; cached `getSession` consumed today by `/` and `/auth/required` but bypassed by `getActor`       | `getActor.ts:46-99`, `better-auth/server.ts:5`, `src/app/page.tsx`, `src/app/auth/required/page.tsx`, investigation §10 |
| House seams exist and are unconsumed: bell `revalidate` prop (`NotificationBell.tsx:40`, layout omits it), controller `navigate` option (`createBoardController.ts:130` falls back to `window.location.href`), offset pagination engine (`src/server/pagination.ts`), `NotificationView.toView` ISO serialization | files read                                                                                                              |
| `PRISMA_LOG_QUERIES=1` dev opt-in already implemented                                                                                                                                                                                                                                                             | `src/server/db.ts:11-16`                                                                                                |

**Open questions: none blocking** — (1) the layout phase-overlap variant is measurement-gated, not decision-gated (2-phase baseline is accepted); (2) S8's DDL outcome is evidence-gated by design (conditional tasks T037/T038 carry the branch). Both are conditional paths the tasks already encode.
