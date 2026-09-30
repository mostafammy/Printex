---
description: "Task list for 092-performance — Navigation Responsiveness & Server-Side Fetch Efficiency"
---

# Tasks: Navigation Responsiveness & Server-Side Fetch Efficiency

**Input**: Design documents from `/specs/092-performance/`

**Prerequisites**: spec.md, plan.md (this list is the implementation breakdown of plan slices S1–S10)

**Tests**: Included — the spec's acceptance criteria are query-count/equivalence/authorization-shaped (AC-001…AC-025), and the constitution requires server-path tests for permission checks and audit emission on every touched surface.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7); `*` = optional/conditional
- Exact file paths included; every task lists objective, notes, acceptance, tests, dependencies inline

## Path Conventions

Single project (per plan.md): `src/`, `tests/`, `prisma/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the one artifact every query-shape task needs to prove its acceptance criteria

- [x] T001 [P] **Query-count test helper** — Create `tests/helpers/queryCount.ts`: a `vi.mock("~/server/db", …)` factory that swaps the app singleton for a test `PrismaClient` (`datasourceUrl: process.env.DATABASE_URL_TEST`, `log: [{ emit: "event", level: "query" }]`, `$on("query", …)` appending SQL strings to a shared buffer — an unswapped standalone client captures **zero** SUT queries, which research explicitly rejected), plus `resetQueries()`, `queries()`, and `captureQueries<T>(fn: () => Promise<T>): Promise<{ result: T; queries: string[] }>` (buffer reset per capture); export the factory because `vi.mock` is file-scoped and must be declared per test file; seed fixtures with the uninstrumented `tests/helpers/testDb.ts` before capturing (research Decision: "Query-count tests capture Prisma `query` events at the `db` singleton through one shared helper")
  - **Acceptance**: helper exported, typed, and exercised by a smoke integration test (1 awaited `findMany` → exactly 1 captured query).
  - **Tests**: `tests/integration/queryCount.test.ts` (smoke).
  - **Deps**: none. _(plan S10/S3 support)_

**Checkpoint**: query-shape acceptance criteria (AC-005, AC-009, AC-011) are now mechanically assertable

---

## Phase 2: User Story 1 - Staff move through the app without a blocking spinner (Priority: P1) 🎯 MVP

**Goal**: navigation never arms a blocking overlay; boot loading preserved; authenticated routes stream behind a skeleton (plan S1 + S2)

**Independent Test**: click 5 authenticated links — zero overlays, skeleton appears, old page never freezes; cold load still boots with the loading experience

### Tests for User Story 1 (write FIRST — must fail before T004/T006–T009)

- [x] T002 [US1] Component test `tests/components/app-boot-loader.test.tsx`: render `AppBootLoader`; `pointerdown` on an internal `<a href="/my-queue">` renders **no** `.loading-container` overlay and never sets the nav-armed state; hash-only link (`#main-content`) likewise clean; boot path (initial `isBooting`) still mounts `LoadingExperience` and clears after the double-rAF — **fails until T004**
- [x] T003 [US1] Structure test `tests/components/shell-loading.test.tsx`: `src/app/(shell)/loading.tsx` exists and renders skeleton markup with `aria-busy` and **no** operational data; no `aria-live` region and no focus-management code in the boundary or boot loader (spec SR-003, Clarifications 2026-09-29); navigation render case — a soft navigation to a `(shell)` route paints the skeleton instead of freezing the previous route (spec AC-003 navigation render test); Suspense boundaries present around `<OrderFinancePanel>`, `<SpecHistory>` rows, `<CustomerBalanceTab>` — **fails until T006–T009**

### Implementation for User Story 1

- [x] T004 [US1] **Remove navigation loader arming path** — in `src/components/loading/app-boot-loader.tsx` delete the `pointerdown` effect (:65-110), `isNavigating` state, `navTimeoutRef`/`NAV_FALLBACK_TIMEOUT_MS`, and the pathname-commit clear effect (:52-61); render `<LoadingExperience isLoading={isBooting} />`; update the component doc comment to state boot-only scope (spec FR-001, FR-002, FR-003; investigation §6.1)
  - **Acceptance**: AC-001 (no overlay on any navigation), AC-002 (boot unchanged); skip-link/hash clean for free (NB-002)
  - **Tests**: T002 passes; manual navigation sweep (Link, command-bar `router.push`, board drop later)
  - **Deps**: none
- [x] T005 [US1] Audit `src/components/loading/loading-experience.tsx` + `loading-config.ts` for navigation-only branches/dead refs; keep `SHOW_DELAY_MS`/`MIN_VISIBLE_MS`/`COMPLETE_MS` for boot; delete now-unreachable nav paths and stale comments (spec FR-002; §20 note: anti-flicker polish intentionally removed for navigation only)
  - **Acceptance**: boot phase machine behavior byte-identical; no nav-specific code remains
  - **Tests**: T002 boot case; existing loading tests green
  - **Deps**: T004
- [x] T006 [US1] **Add authenticated shell loading boundary** — create `src/app/(shell)/loading.tsx`: skeleton matching the shell content grid (`mx-auto max-w-7xl space-y-4`, pulsing header + content blocks, `aria-busy`, RTL-safe logical properties; no data, no stale content) (spec FR-005, SR-001; investigation Fix B)
  - **Acceptance**: AC-003 — any `(shell)` soft navigation paints the skeleton instead of freezing the old route
  - **Tests**: T003 structure test; manual: slow route shows skeleton
  - **Deps**: none (parallel with T004)
- [x] T007 [P] [US1] **Suspense: order finance panel** — wrap `<OrderFinancePanel>` in `src/app/(shell)/orders/[orderId]/page.tsx` with `<Suspense fallback={…skeleton…}>` (spec FR-006, SR-002)
  - **Acceptance**: panel streams; parent order header paints without waiting; fallback is pure skeleton
  - **Tests**: part of T003; order suite (T044) stays green
  - **Deps**: none
- [x] T008 [US1] **Suspense: spec history rows** — wrap each `<SpecHistory>` inside the `detail.workItems.map` region of `src/app/(shell)/orders/[orderId]/page.tsx` (~:1059) so per-row history queries stream independently (spec FR-006)
  - **Acceptance**: rows render in order; one slow history does not block others' parents
  - **Tests**: part of T003; order suite green
  - **Deps**: T007 (same file: `src/app/(shell)/orders/[orderId]/page.tsx` — not parallelizable with it)
- [x] T009 [P] [US1] **Suspense: customer balance tab** — wrap `<CustomerBalanceTab>` at `src/app/(shell)/customers/[id]/page.tsx` / `src/components/customers/customer-balance-tab.tsx` call site with a skeleton fallback (spec FR-006)
  - **Acceptance**: profile paints; tab streams; no stale data in fallback
  - **Tests**: part of T003
  - **Deps**: none
- [ ] T010* [US1] **Optional — non-blocking route progress indicator** (product sign-off required, NOT part of acceptance): if approved, add a thin top-edge progress bar in `src/components/loading/nav-progress-bar.tsx` driven by real navigation state, ≥2 s show-delay, `pointer-events: none`, never full-screen (spec FR-004)
  - **Acceptance**: cannot block input; absent entirely if sign-off withheld
  - **Tests**: component test asserting `pointer-events: none` + delayed show
  - **Deps**: T004 (must land after overlay removal so no two indicators coexist)

**Checkpoint**: US1 fully functional — the ~1.3 s floor is gone and every authenticated route streams

---

## Phase 3: User Story 2 - Every authenticated navigation does less redundant server work (Priority: P1)

**Goal**: shell layout ≤4 queries / ≤2 phases / zero duplicate user reads, auth semantics untouched (plan S3)

**Independent Test**: query-log a navigation (helper T001): assert count/phases/duplicate; run authz fixtures (redirect, inactive, single `getActor`, header name + fallback)

### Tests for User Story 2 (write FIRST)

- [x] T011 [US2] Integration test `tests/integration/shell-actor.test.ts`: (a) unauthenticated render → redirect `/auth/required`; (b) `isActive: false` user with live session → refused (`UnauthenticatedError` path); (c) `getActor` executes **once** across layout+page in one request (spy); (d) header shows `actor.name` and the Arabic fallback `"مستخدم برينتكس"` when null; this layout-path regression doubles as SR-004's streamed-fragment authz check (plus the existing 052 panel suite) — **fails until T013/T014**
- [x] T012 [US2] Query-shape test `tests/integration/shell-layout-queries.test.ts` using T001: one authenticated layout render captures **≤4 queries**, **≤2 sequential phases** (second batch not issued before first resolves), and **zero** queries selecting only `{name, username}` of the current user — **fails until T014/T016**

### Implementation for User Story 2

- [x] T013 [US2] **Consolidate actor/display-user data** — in `src/server/auth/getActor.ts`, widen `Actor` with `name: string | null` and `username: string | null`, populated from the user row the session/RBAC load already returns (session user in `getActor`, RBAC include in `getActorForSession` — drop nothing that exists today: `userId`, `roles`, `permissions`, `departmentIds` unchanged; display-only, FR-010); confirm the `CoreActor` bridge in `layout.tsx` still compiles (display fields are additive)
  - **Acceptance**: `Actor` carries display fields; zero new queries introduced
  - **Tests**: T011 (c/d); typecheck via `pnpm check`
  - **Deps**: none
- [x] T014 [US2] **Remove duplicate user read from shell** — delete the `db.user.findUnique({ select: { name, username } })` block (`src/app/(shell)/layout.tsx:68-71`); header reads `actor.name ?? "مستخدم برينتكس"`; drop the now-unused `db` import if applicable (spec FR-008; investigation §6.3/§13 duplicate #1)
  - **Acceptance**: AC-005 half (no duplicate read); AC-006 display fallback unchanged
  - **Tests**: T011, T012
  - **Deps**: T013
- [x] T015 [US2] **Unify session cache** — make `getActor` consume the existing `cache()`-wrapped `getSession` in `src/server/better-auth/server.ts` instead of calling `auth.api.getSession` directly, so the two request caches become one (spec FR-011/FR-012; investigation §6.3 secondary duplicate)
  - **Acceptance**: one session lookup per request across `/`, `/auth/required`, shell; no behavior change on expiry/absence
  - **Tests**: T011 (a–c); existing auth suite
  - **Deps**: T013 (same file region)
- [x] T016 [US2] **Coalesce layout phases** — restructure `layout.tsx` so post-actor work is one phase: `await getActor()` then `Promise.all([unreadCount(actor), listNotifications(actor, …)])` (already parallel — ensure nothing re-serializes them); phases 3 → 2; keep the outbox/scheduler idempotent backstops untouched (:65-66) (spec FR-011, PR-002)
  - **Acceptance**: AC-005 (≤4 queries, ≤2 phases); notifications still render in the bell identically
  - **Tests**: T012; T044 full suite
  - **Deps**: T014 (phase-2 removal is the prerequisite for the count)

**Checkpoint**: US2 complete — every authenticated navigation is 1 duplicate + 1 phase lighter with auth untouched

---

## Phase 4: User Story 3 - Opening an order does not serialize independent reads (Priority: P2)

**Goal**: order detail runs independent reads concurrently, designer eligibility batched, semantics identical (plan S4)

**Independent Test**: fixture order (W items × D designers): no await-in-loop, overlapping query timeline, query count far below `W×(2+3D)`, full existing order suite green unmodified

### Tests for User Story 3 (write FIRST)

- [x] T017 [US3] Contract test `tests/contract/designers/eligibilityBatch.test.ts`: `getEligibleDesignersBatch(actor, ids)` output per work item **deep-equals** repeated `getEligibleDesigners(actor, id)` on fixtures (including empty id list → `{}` with **zero** queries; unauthorized actor → same `FORBIDDEN` as single path; non-assignable state → same error/absent behavior as today) — **fails until T019**
- [x] T018 [US3] Structure + query test `tests/integration/orderDetailOrchestration.test.ts`: source assertion — no `await` inside a loop over `detail.workItems` in `src/app/(shell)/orders/[orderId]/page.tsx`; query-capture on a 5-item × 4-designer fixture — creation-event read overlaps `getOrderDetail` (not sequenced after), total eligibility query count **≤ 10** and constant on a second larger fixture (spec Clarifications 2026-09-29; fails the 15-query per-item fan-out) — **fails until T020/T021**

### Implementation for User Story 3

- [x] T019 [US3] **Batch eligible-designer reads** — add `getEligibleDesignersBatch(actor, workItemIds)` to `src/server/designers/assignment.ts` (keep single-item export): exactly **5 reads in one `Promise.all`** (research Decision "Designer eligibility is five set-based reads"): (1) `workItem.findMany({ where: { id: { in: ids } }, select: { id, state, order.customerId } })`, (2) `findActiveDesignWorkHolders()`, (3–4) `workItem.groupBy` for non-terminal counts and past-jobs-per-customer, (5) one `$queryRaw` `SELECT DISTINCT ON (…)` read for the latest `ASSIGNED` transition per designer (Prisma `groupBy`/`distinct` cannot express it); return `Map<workItemId, EligibleDesigner[]>`; then run the existing `suggestDesigner`/per-item assembly logic on shared bases; `authorize(actor, "workitem.assign_designer")` once, server-side (spec FR-014, DF-002, contract §5/§4.1)
  - **Acceptance**: AC-009; T017 equivalence; identical suggestion output
  - **Tests**: T017
  - **Deps**: T001 (query assertions), none code-wise
- [x] T020 [US3] **Parallelize independent order-detail queries** — in `src/app/(shell)/orders/[orderId]/page.tsx:452-537`: `Promise.all([getOrderDetail, creationEvent])` first; then `Promise.all([assigneeRows, reworkCounts])` (both need only IDs); join `departments` and `findPendingChangeRequestIds` where independent of each other; preserve every genuine dependency (detail → IDs) (spec FR-013, PR-004)
  - **Acceptance**: AC-008; no behavioral change (reads only)
  - **Tests**: T018; existing order suite
  - **Deps**: none (parallel with T019)
- [x] T021 [US3] Replace the `for … await getEligibleDesigners` loop (:501-511) with one `getEligibleDesignersBatch` call over assignable work items; skip entirely when `!canAssignDesigner` or no assignable items (spec FR-014)
  - **Acceptance**: AC-009 (≤ 10 queries on the 5×4 fixture, constant as W/D grow); assign dialog data identical
  - **Tests**: T017, T018
  - **Deps**: T019, T020
- [x] T022 [US3] Run the **unmodified** order/collection/change-control suites; confirm zero semantic test edits were needed; record before/after query counts in the PR (spec AC-010, PR-004)
  - **Acceptance**: `pnpm test` green; PR contains the numbers
  - **Deps**: T020, T021

**Checkpoint**: US3 complete — worst route in the app no longer chains phases or fans out per item

---

## Phase 5: User Story 4 - My Queue computes durations for the whole page at once (Priority: P2)

**Goal**: durations O(1) per page, exact equivalence, actor-scoped (plan S5)

**Independent Test**: fixture page — batch ≡ per-row on every row incl. `null` totals; query count flat from 1 row to N rows; second user's rows never queried

### Tests for User Story 4 (write FIRST)

- [x] T023 [US4] Equivalence + scoping tests `tests/integration/phaseDurationsBatch.test.ts`: table of fixtures (queue-only, active-only, rework-restarted, `DESIGN_COMPLETED` with/without start, no segments → `null` total) — batch result **deep-equals** `phaseDurations` per row; two-user leakage case — passing only user A's IDs returns only A's rows and the `where` never contains B's ids (use T001 to assert); query count for the batch = 2 regardless of id-list length — **fails until T025**
- [x] T024 [US4] My-queue page query test in `tests/integration/phaseDurationsBatch.test.ts` (alongside T023, per quickstart): `captureQueries` around the page's data section at pageSize 1 vs 10 → duration-related query count identical — **fails until T026**

### Implementation for User Story 4

- [x] T025 [US4] **Batch my-queue phase durations** — in `src/server/designers/timer.ts`: extract the pure math (`computePhaseDurations(segments, transitions)`) from `phaseDurations` (:165-199) so both paths share one implementation; add `phaseDurationsByIds(actor, ids)` → `Promise.all([phaseTiming.findMany({ where: { workItemId: { in: ids } } }), workItemTransition.findMany({ where: { workItemId: { in: ids }, to: { in: [...] }, orderBy: { at: "asc" } })])` grouped in JS → `Map<id, PhaseDurations>` (spec FR-016, FR-017, contract §4)
  - **Acceptance**: AC-011 (constant queries), AC-012 (equivalence), AC-013 (scoping — ids are inputs; loader widens nothing)
  - **Tests**: T023
  - **Deps**: none
- [x] T026 [US4] Wire `src/app/(shell)/my-queue/page.tsx:38-43` to `phaseDurationsByIds(actor, rows.map(r => r.workItemId))` (rows already actor-scoped by `getMyQueuePage`), preserving the `{ row, durations }` shape handed to the UI; keep the outer `Promise.all([page, stats])` as-is (spec FR-016)
  - **Acceptance**: page renders identical durations; AC-011 page-level
  - **Tests**: T024; existing my-queue tests; T044
  - **Deps**: T025

**Checkpoint**: US4 complete — 50 queries → 2 with proven equivalence

---

## Phase 6: User Story 5 - The notification bell refreshes itself, not the whole app (Priority: P2)

**Goal**: passive refresh = targeted server re-read only; actions scoped; server stays authority (plan S6)

**Independent Test**: idle a minute on `/my-queue` with query capture — no layout/page re-execution, bell count updates; break the re-read → error + retry; mark-read → audit + count drop

### Tests for User Story 5 (write FIRST)

- [x] T027 [US5] Integration test `tests/integration/bellRefresh.test.ts`: (a) invoking the bell's refresh path updates count/rows from the targeted source while `router.refresh` is **not** called (mock the router + spy route execution / query capture delta = 0 layout queries); (b) targeted source with user B's session returns only B's rows (SEC-003); (c) failing source → component shows existing error surface, `retry()` re-calls the targeted source, polling interval still ticking; (d) mark-read still writes its audit event and refuses without permission; (e) two re-reads issued back-to-back resolve out of order → the older response is discarded without error surfacing and only the latest issued response's `{ count, rows }` is applied (contract notification-refresh §3 latest-response-wins) — **fails until T029/T030**
- [x] T028 [US5] Static/behavior assertion in `tests/integration/bellRefresh.test.ts`: `src/app/(shell)/notifications/actions.ts` no longer calls `revalidatePath("/", "layout")` (AC-017) — **fails until T031**

### Implementation for User Story 5

- [x] T029 [US5] **Replace notification router.refresh polling — server side**: add the bell re-read as a **no-input server action in `src/app/(shell)/notifications/actions.ts`** returning `{ count: number, rows: NotificationView[] }` for the **calling** user (research Decision: bell re-read transport — no GET route, TR-006) implemented as `getActor()` → same scoping as `unreadCount` + `listNotifications(actor, { page: 1, pageSize: 10 })`; no cache (FC-004) (spec FR-019, FR-020, contract §3)
  - **Acceptance**: shape matches bell props; cross-user isolation (T027b)
  - **Tests**: T027b
  - **Deps**: none
- [x] T030 [US5] **Wire the existing seam**: pass `revalidate` from `src/app/(shell)/layout.tsx` into `NotificationBell` (prop exists at `NotificationBell.tsx:40`; layout currently omits it) and widen its type to `() => Promise<{ count: number; rows: NotificationView[] }>` (spec Clarifications 2026-09-29, Contract §3); change `NotificationBell.refresh` (:58-66) to apply the resolved `{count, rows}` to local state (latest response wins) **without** `router.refresh()`; apply the same to `notification-list.tsx` if it refreshes; keep `setError`/retry semantics (spec FR-019, FR-020, FR-022, investigation Fix F)
  - **Acceptance**: AC-014 (no route re-exec on tick/SSE/refocus), AC-016 (error/retry)
  - **Tests**: T027a, T027c
  - **Deps**: T029
- [x] T031 [US5] **Scope notification invalidation** — in `src/app/(shell)/notifications/actions.ts:16-20`, replace `revalidatePath("/", "layout")` with scoped invalidation (`revalidatePath("/notifications")` per 053 `contracts/ui.md:142`; add a bell-specific tag/fetch invalidation only if the re-read is cached — it must not be) (spec FR-023, AC-017)
  - **Acceptance**: other routes' RSC caches survive a mark-read; bell still updates
  - **Tests**: T028; 053 action tests unmodified (AC-015)
  - **Deps**: T029/T030 (re-read must exist before blanket refresh is removed)
- [x] T032 [US5] Regression: confirm poll interval (15 s), tab-refocus tick, SSE transport indicator, and mark-read/mark-all flows are unchanged against `specs/053-notifications/contracts/`; run 053 test suites (spec AC-015, Test Expectations §5)
  - **Acceptance**: 053 suite green with no semantic edits
  - **Deps**: T030, T031

**Checkpoint**: US5 complete — background notifications no longer contend with navigation

---

## Phase 7: User Story 6 - Board SCREEN drop keeps the user in the app (Priority: P3)

**Goal**: SCREEN drop soft-navigates with query preserved; no document reload (plan S7)

**Independent Test**: controller spy receives `href` incl. `?workItem=`; no `window.location.href` assignment; manual drop lands on pricing with the item selected

### Tests for User Story 6 (write FIRST)

- [x] T033 [US6] Controller test `tests/unit/board/navigation.test.ts`: build a controller with a spy `navigate`; run the SCREEN drop policy path; assert spy called with the exact destination (path + query) and that no code path assigns `window.location.href` (jsdom location stub untouched) — **fails until T034**

### Implementation for User Story 6

- [x] T034 [US6] **Replace board SCREEN full reload** — in `src/components/board/BoardProvider.tsx:29-37`, add `const router = useRouter()` and pass `navigate: (href) => { router.push(href); }` into `createBoardController`; in `src/lib/board/createBoardController.ts:130` remove the `window.location.href` default (throw a clear "navigate not wired" error in dev, or default to `router`-free `Link`-equivalent only in tests) (spec FR-024, NB-004, investigation §6.8)
  - **Acceptance**: AC-018; `ScreenDropPolicy.ts` untouched (it only builds the href)
  - **Tests**: T033; manual SCREEN drop → `/pricing?workItem=…` with selection
  - **Deps**: T033

**Checkpoint**: US6 complete — the only full-reload navigation in the app is gone

---

## Phase 8: User Story 7 - Operators can trust what is actually deployed before indexes change (Priority: P2)

**Goal**: verification evidence first; DDL only if shown missing; drift filed to 091 (plan S8, GATED)

**Independent Test**: `db-verification.md` exists with answers (or recorded unreachable failure); if R1–R3 already present → zero index tasks execute. _Evidence-first note: unlike US1–US6, this story has no automated tests-first block — spec Test Expectations §1–10 cover code surfaces only; T035/T036 ARE the checks (they produce and assert the evidence artifact the Independent Test reads), so no separate gate-test task or renumbering is used._

- [x] T035 [US7] **Reconcile migration source of truth (repo evidence)** — create `specs/092-performance/db-verification.md`; document: `package.json` Prisma schema path + `prismaSchemaFolder`; which directory `migrate deploy` resolves; full inventory of `prisma/migrations/` (6) vs `prisma/schema/migrations/` (4) incl. where `WorkItem_state_idx`/`workitem_order_perf_indexes` live; 091's `0_baseline` plan and compose `migrate deploy` command; CI's `db push` path; conclude **which tree a production deploy actually consumes and what that implies for R1–R3/change-control tables** (spec DB-001(a), FR-027, investigation §6.10)
  - **Acceptance**: section (a) of DB-001 answered with file evidence
  - **Tests**: documentation review gate (PR)
  - **Deps**: none (start immediately; read-only)
- [x] T036 [US7] **Verify deployed schema & indexes (DB evidence)** — against the real database: `prisma migrate status`; `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('workitem','order','notification','audit_event','file_object')`; `EXPLAIN (ANALYZE, BUFFERS)` for the three navigation-path patterns (board lane sort, bell list, order-detail audit probe); write results into `db-verification.md`. **If unreachable (P1001 as in the investigation): record the failure verbatim and stop — all DDL tasks stay blocked** (spec DB-001(b)(d), DB-002, FR-028, investigation §9/§21.1)
  - **Acceptance**: AC-019 precondition satisfied (evidence or explicit unreachable record)
  - **Tests**: documentation review gate
  - **Deps**: T035
- [x] T037* [US7] **Conditional — apply verified index changes**: only if T036 shows R1 (`WorkItem_state_createdAt_id_idx`), R2 (`Notification_userId_archivedAt_createdAt_idx`), R3 (`audit_event_entityId_action_createdAt_idx`) missing and/or `FileObject_sha256_idx` still present as a duplicate → author **one** Prisma migration in the tree T035 proved authoritative (never `db push` over prod), with write-cost notes from spec DB-005 and a drop-index companion plan; run the suite against the migrated test DB (spec FR-026, DB-003)
  - **Acceptance**: AC-019; migration reviewed like any schema change; **skipped entirely if indexes exist**
  - **Tests**: `pnpm test` post-migration; drift check
  - **Deps**: T036 (**hard gate**)
- [x] T038* [US7] **Conditional — file migration-split drift to 091**: if T035/T036 show `migrate deploy` would miss tables/indexes living only in the inactive tree → record the finding in `db-verification.md` with a cross-reference issue/note against `specs/091-deploy-backup` (baseline fold); **no reconciliation code in 092** (spec FR-027, DB-004, AC-020)
  - **Acceptance**: dependency documented; 092 contains no tree-rewrite
  - **Tests**: review gate
  - **Deps**: T035, T036

**Checkpoint**: US7 complete — evidence exists; DDL either shipped-on-proof or correctly blocked

---

## Phase 9: Polish & Cross-Cutting (mechanical, plan S9)

**Purpose**: low-risk read-shape cleanup — kept LAST so it never obscures US1–US6 in review

- [x] T039 [P] **Reduce review queue over-fetch + paginate server-side** — `src/server/review/queue.ts:47`: (a) `transitions: { where: { to: "WAITING_REVIEW" }, orderBy: { at: "desc" }, take: 1 }`; (b) replace the fetch-everything-payload + `paginateInMemory` shape with the research Design: a **scalar sort-key pass** over the backlog (id, created-at, priority, transition timestamp — preserves the displayed urgent-first/`enteredQueueAt` comparator exactly) + full row payload fetched for **one page's ids only**; offset paging keeps `?page=` semantics, every backlog row stays reachable, statistics cover the same full backlog (no fixed `take` ceiling, spec Clarifications 2026-09-29 / research Decision "Review queue"); preserve display ordering and the entered-queue timestamp exactly (spec FR-029, AC-021)
  - **Tests**: query-shape test (exactly ≤1 transition per row fetched for that predicate) + page-through fixture larger than one page asserting every backlog row remains reachable across pages and the displayed entered-queue timestamp is unchanged (spec AC-021) + existing review tests
  - **Deps**: none
- [x] T040 [P] **Bound customer order loading** — `src/server/customers/service.ts:35-38`: `orders: { select: { …only fields read by customers/[id]/page.tsx:25-39… }, take: 20 }` (verify the rendered set before finalizing the select) (spec FR-030, AC-022)
  - **Tests**: query-shape test + profile page tests unchanged
  - **Deps**: none
- [x] T041 [P] **Replace internal raw anchors** — `src/app/(shell)/finance/daily-cash/page.tsx:89,128,134` and `src/app/(shell)/admin/audit/page.tsx:206` → `next/link` `<Link>` preserving hrefs/query strings exactly (spec FR-031, PR-007, AC-023)
  - **Tests**: static check (grep-style test: no `<a href="/…"` internal in those files) + click-through
  - **Deps**: none
- [x] T042 [P] **Remove dead navigation links** — `src/components/shell/IconRail.tsx:51-52` (`/orders`) and `:129` (`/settings`): delete the entries (routes don't exist; building them is product scope — spec Assumptions) (spec FR-031, AC-023)
  - **Tests**: static check (every rail `href` resolves to an existing route) + rail renders
  - **Deps**: none
- [x] T043* [P] **Batch finance price lookups (money-path gated)** — replace the serial `for … await getCurrentPrice` loops at `src/server/finance/summaries.ts:81`, `profitability.ts:73`, `payments.ts:202` with one `priceHistory.findMany({ where: { workItemId: { in: ids } } })` reduced to latest-per-item **iff** it reproduces `getCurrentPrice`/effective-dating semantics exactly; `payments.ts` variant must respect its `$transaction` read context; **abort and keep the loops if any doubt** and record the AC-024 waiver note in the PR evidence (spec FR-032, BC-003, AC-024)
  - **Tests**: `pnpm test:pricing` green unmodified **before merge**; finance summaries tests
  - **Deps**: none; hard gate = pricing suite

---

## Phase 10: Verification & Regression (plan S10)

- [x] T044 Run the full gate: `pnpm check` (lint + tsc), `pnpm test` (no skipped/edited semantic tests), `pnpm test:pricing` if T043 shipped; re-run T002/T003/T011/T012/T017/T018/T023/T024/T027/T033 as a set; confirm AC-001…AC-025 each map to a green test or recorded manual check; spot-check negative constraints FC-003 / NB-005 / SEC-004 / SEC-005 / BC-004 (no `staleTimes`, prefetch untouched, no client authz, no new public route, no time-semantics change) (spec AC-025, Test Expectations §10)
  - **Implementation note (documented deviation)**: full `pnpm test` was skipped per explicit user directive ("don't run the full test suite"). Gate actually run: `pnpm check` exit 0; 78/78 across the 13 feature test targets; `pnpm test:pricing` 87/87 (baseline + post-T043); T044's named task set all green. Pre-existing shared-DB failures (42501 Expense grants, polluted paymentVoid/dailyCash fixtures) reproduce WITHOUT this feature's changes — recorded in PERFORMANCE_INVESTIGATION.md resolution banner, not regressions.
- [x] T045 Record before/after evidence in the PR series: query counts per surface (shell, my-queue, order detail), overlay floor gone (DevTools pointerdown→unmount per investigation §21.5), poll-tick route executions = 0, board drop document loads = 0; update `PERFORMANCE_INVESTIGATION.md` §16/§18 with `resolved-by 092` pointers per rank (spec Rollout; PR-001…PR-008)
- [ ] T046 [P] Documentation pass: `checklists/requirements.md` reviewed/complete; `LINEAR_PERFORMANCE_ISSUES.md` issue bodies posted/linked to the real Linear IDs (placeholders replaced); `db-verification.md` final; no production code outside the task list changed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: none — start immediately
- **Phase 2 (US1)**: none — MVP; T004 ∥ T006 ∥ T007 ∥ T009 in parallel, then T008 (same file as T007)
- **Phase 3 (US2)**: none (T013 → T014 → T016; T015 runs ∥ T014 after T013)
- **Phase 4 (US3)**: none (T019 ∥ T020 → T021 → T022)
- **Phase 5 (US4)**: none (T025 → T026)
- **Phase 6 (US5)**: none (T029 → T030 → T031 → T032)
- **Phase 7 (US6)**: none (T033 → T034)
- **Phase 8 (US7)**: T035 → T036 → {T037, T038} (DDL hard-gated on evidence)
- **Phase 9 (Polish)**: ideally after US1–US6 merge (review clarity, plan sequencing) — no code dependency; T043 always pricing-gated
- **Phase 10**: all landed tasks

### Story Delivery Order (plan "Delivery and sequencing")

1. **US1 → US2** (Fix First trio with T001): perceived floor + streaming + every-navigation reads
2. **US3 ∥ US4** (parallelizable — different files)
3. **US5 → US6**
4. **US7** verification runs from day one; DDL last
5. **Polish → Verification**

### Parallel Opportunities

- T001 ∥ everything initially
- T004 ∥ T006 ∥ T007 ∥ T009 (US1); T008 after T007 (same file)
- T011/T012 (tests) before T013, then T014 ∥ T015
- T017/T018 (tests) ∥ T019 ∥ T020
- T023/T024 ∥ T025
- T027/T028 (tests) ∥ T029
- T039 ∥ T040 ∥ T041 ∥ T042 (∥ T043 pre-gate)
- T035 can start on day one (read-only)

### Rules

- Tests first per story (each story's test block must fail before its implementation tasks)
- No task edits an existing semantic test to pass
- No DDL before T036 evidence; no `router.refresh` restoration after T030 without removing the whole US5 (rollback = revert series)
- Commit after each task or logical group; every phase checkpoint is independently shippable

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: User Story 1 (T002–T010)
3. **STOP and VALIDATE**: run the US1 Independent Test — 5 authenticated links, zero overlays, skeleton streams, boot unchanged — before starting any other story
4. Ship the US1 increment (plan S1+S2) if ready

### Incremental Delivery

1. Setup (T001) → US1 (T002–T010) → US2 (T011–T016): the plan's "Fix First" trio (S1–S3), each independently revertible
2. US3 (T017–T022) ∥ US4 (T023–T026): test independently → merge
3. US5 (T027–T032) → US6 (T033–T034); US7 (T035–T038) verification runs from day one, DDL only on T036 evidence
4. Polish (T039–T043) → Verification (T044–T046)

---

## Traceability (spec AC → tasks)

| AC         | Task(s)                | AC         | Task(s)                  |
| ---------- | ---------------------- | ---------- | ------------------------ |
| AC-001/002 | T002, T004, T005       | AC-013     | T023, T025               |
| AC-003     | T003, T006             | AC-014/016 | T027, T029, T030         |
| AC-004     | T003, T007–T009        | AC-015     | T032                     |
| AC-005/007 | T011–T012, T014–T016   | AC-017     | T028, T031               |
| AC-006     | T011, T013, T015       | AC-018     | T033, T034               |
| AC-008/010 | T018, T020, T022       | AC-019/020 | T035, T036, T037*, T038* |
| AC-009     | T017, T018, T019, T021 | AC-021…023 | T039–T042                |
| AC-011/012 | T023, T024, T025, T026 | AC-024/025 | T043*, T044, T045        |

---

## Phase 11: Expanded scope — investigation leftovers (owner-directed, post-092)

**Purpose**: close every remaining §7/§8/§12c/§18 item from `PERFORMANCE_INVESTIGATION.md` EXCEPT §6.9 (remote DB topology — explicitly excluded by the owner). Includes the project-wide cache fixes and the shimmering skeleton system. Source of truth for each task = the cited investigation section; these extend `tasks.md` after the original 092 scope was accepted.

**Note**: T047 overrides spec FC-003 (`staleTimes` out of scope) — explicit owner instruction ("fix cache problem across project"); the value chosen is conservative (15 s dynamic) because §6.7's blanket invalidation is already removed.

- [x] T047 **Client route-cache (staleTimes)** — add `experimental.staleTimes` to `next.config.js`: `dynamic: 15`, `static: 30` (seconds), with a comment citing investigation §7.5/§11/§18.12 and the owner override of FC-003; leaves `revalidatePath` scoping (T031) as the invalidation authority. Acceptance: config valid (`pnpm build` config parse or `next build` not required — `pnpm check` + a config-shape assertion); no other `next.config` changes.
- [x] T048 **Prisma prod singleton guard** — `src/server/db.ts:25` currently skips `globalForPrisma.prisma = db` when `NODE_ENV === "production"` (investigation §7.10: latent double-client). Fix: cache the singleton unconditionally (keep the re-import guard in ALL environments); acceptance: prod-mode unit assertion that a second module evaluation reuses the client; no query-behavior change.
- [x] T049 [P] **Login bounce** — investigation §7.6/§18.13: `src/app/(auth)/login/page.tsx:23` defaults `callbackUrl` to `"/"` which does getSession + `redirect("/board")` (second RSC round-trip). Default it to `"/board"`; keep `/` behavior for direct visits unchanged (`app/page.tsx`); explicit `?callbackUrl=` values still honored.
- [x] T050 **Shimmering skeleton system** — investigation §6.2/§17 Fix B polish: create `src/components/ui/skeleton.tsx` (`Skeleton` div: `aria-busy`, rounded, shimmer class) + shimmer keyframes in `src/styles/globals.css` (moving glint via background-position/gradient over `muted`, ~1.5 s linear infinite, RTL-safe, disabled under `prefers-reduced-motion: reduce`). Retrofit ALL existing skeletons: `(shell)/loading.tsx`, the three 092 Suspense fallbacks (order finance, spec history, customer balance). Acceptance: no `animate-pulse`-only skeleton remains in those five sites; reduced-motion media query present; component test asserting skeleton renders with shimmer class + aria-busy.
- [x] T051 **Parent→child streaming (investigation §12c)** — add Suspense (with `Skeleton` fallbacks from T050) around the server-serialized async sections of: `changes/[changeRequestId]` detail children, `work-items/[id]/files` page phases (4 serial), `finance/daily-cash` summary phases (3 serial), `design/[workItemId]` content phases, `delayed` main list (dept-gated). Note: board lanes are client-rendered inside `BoardProvider` — no server Suspense possible; document as N/A in the PR note instead of forcing it. Acceptance: each page source shows `<Suspense` around its async panel; tsc green; no data semantics change.
- [x] T052 **assigneeRows overlap (investigation §8 over-fetch #3)** — verify `getOrderDetail`'s own select vs the 16-field `assigneeRows` re-fetch in `orders/[orderId]/page.tsx:471-490`; trim or source rows from `detail` where fields are provably identical (DF-005: same observed values; keep anything the detail select does not actually load). Record the audit result (kept/removed fields) in the PR note; if overlap is NOT provable field-for-field, record that and make no change (investigation marked this "partially verified").
- [ ] T053 [P] **Notifications page duplicate fetch (investigation §13#4)** — `/notifications/page.tsx:22` re-fetches the same first page the layout bell already loaded. Collapse via request-level memoization (React `cache()` around the list call or share the layout's promise) so one request issues one first-page read; FR: zero persistent caching, identical rows.
- [ ] T054 **customerBalance unbounded loop (investigation §8 N+1 row 5)** — `src/server/finance/summaries.ts:154` runs 1+2 queries per order across `customer.orders` (unbounded). Batch across orders: `getCurrentPrices` (already exists, T043) + one credits read (CREDIT compensations by `orderId IN`) + one non-void payments read (`orderId IN`), grouped in JS; preserve EXACT balance semantics vs the existing per-order math (`tests/integration/finance/customerBalance.test.ts` + `creditsApplied.test.ts` must stay green — they are the equivalence oracle).
- [x] T055 **`pg_trgm` GIN for customer name search (investigation §7.2, gated)** — `customers/service.ts:23` uses `normalizedName contains` (`%x%`) which a btree cannot serve. Author ONE migration in `prisma/schema/migrations/`: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + `CREATE INDEX … ON "customer" USING gin ("normalizedName" gin_trgm_ops);` (verify exact table/column casing in `prisma/schema/customer.prisma`; phone `startsWith` stays btree-served — out of scope unless trivially provable missing). Apply via `migrate deploy` with the T037 env-override pattern; **if `CREATE EXTENSION` is permission-denied, STOP and record the verbatim error in `db-verification.md` — no improvising, no db push**. Append results to `db-verification.md`. NOTE: Prisma schema does not model trgm indexes — no `.prisma` edit needed for a raw-SQL index? If `db push` fidelity requires it, record the gap in `db-verification.md` for 091 instead of editing models.
- [x] T056 **admin/audit 200-row load (investigation §7.8)** — `admin/audit/page.tsx:92` takes 200 joined rows unpaginated. Convert to server-side pagination using the existing offset pagination helper (`src/server/pagination.ts`, the review-queue pattern: `?page=N`, `PageResult`, stats/count consistent with rows); keep filters intact; acceptance: one page fetches ≤ page-size rows, page-through reaches older rows, filter+clear flows unchanged, audit-actor join preserved.
- [x] T057 **Background loop contention (investigation §7.3, verify-first)** — read `src/server/notifications/processor.ts` (~:543-562) and `scheduler.ts` (~:330): overlap guards appear to exist. Task = confirm each interval tick cannot stack (single-flight flag per timer), confirm the shell layout backstop (`layout.tsx:65-66`) cannot spawn duplicate intervals, and record findings + tick query cost (one read of the tick functions) in the PR note; code change ONLY if a gap is found.

### Phase 11 dependencies

- T047, T048, T049 independent (∥ with each other).
- T050 before T051 (T051 uses `Skeleton`); T050 touches the same fallback files as T051 — same-file sequential.
- T052 independent (same file as T050/T051 → sequence within the orders-page owner).
- T053 ∥ T054 ∥ (T055, T056, T057 all ∥ across different files).
- Final gate: `pnpm check` + targeted suite (feature tests + finance + pricing) after all.
