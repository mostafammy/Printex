# Quickstart: Navigation Responsiveness & Server-Side Fetch Efficiency

Validation guide for the 092 feature branch. Proves the spec's acceptance criteria end-to-end. Implementation details live in `tasks.md`; this file only says how to run and what to expect. Targets are **properties** (PR-001…PR-008), not ms SLAs.

## Prerequisites

- Repo dependencies installed (`pnpm install`), `pnpm check` green before starting.
- Test DB: `DATABASE_URL_TEST` set to a local Postgres (per `tests/helpers/testDb.ts`) — DB-backed tests fail without it.
- Optional query logging: `PRISMA_LOG_QUERIES=1 pnpm dev` for the count walkthroughs (US2–US4) — no code change (investigation §21.3).
- `pnpm test:pricing` required only if the finance batching task (T043*) ships; otherwise AC-024 is waived with a recorded note.
- No schema/migration needed for US1–US6; US7 DDL is conditional on evidence (AC-019).

## Commands

```bash
pnpm check                      # lint + typecheck gate (TR-008, AC-025)
pnpm test                       # full suite — no skipped/edited semantic tests
pnpm test:pricing               # only if T043 finance batching shipped (AC-024)

pnpm vitest run tests/integration/queryCount.test.ts        # T001 helper smoke
pnpm vitest run tests/components/app-boot-loader.test.tsx tests/components/shell-loading.test.tsx          # US1: T002, T003
pnpm vitest run tests/integration/shell-actor.test.ts tests/integration/shell-layout-queries.test.ts       # US2: T011, T012
pnpm vitest run tests/contract/designers/eligibilityBatch.test.ts tests/integration/orderDetailOrchestration.test.ts  # US3: T017, T018
pnpm vitest run tests/integration/phaseDurationsBatch.test.ts # US4: T023 + T024 (my-queue page query test)
pnpm vitest run tests/integration/bellRefresh.test.ts         # US5: T027 (+ T028 revalidatePath assertion)
pnpm vitest run tests/unit/board/navigation.test.ts           # US6: T033

pnpm dev                        # manual walkthrough at http://localhost:3000 (RTL shell)
```

**Expected outcomes**: tests are written first per story — T002/T003 fail until T004–T009; T011/T012 until T013–T016; T017/T018 until T019–T021; T023/T024 until T025/T026; T027/T028 until T029–T031; T033 until T034. After each story's implementation tasks its block turns green; at T044 the whole set is green with zero semantic test edits (AC-025).

## Validation scenarios (map to spec acceptance)

### 1. Navigation never blocks (AC-001, AC-002, AC-003, AC-004 — US1, PR-001)

1. Cold load the app → boot loading experience still shows and clears as today (AC-002).
2. Authenticated, navigate 5 times (rail link → `/my-queue`; command-bar `router.push` → `/board`; an order link; a customers link; back) → **zero** opaque overlays, input never blocked, old route replaced by the `(shell)` skeleton instead of freezing (AC-001, AC-003).
3. On a slow route, observe the skeleton (`aria-busy`, no operational data); finance panel, per-row spec history, and balance tab stream behind their own fallbacks (AC-004, SR-002).
4. Activate the skip link `#main-content` → no loading UI (NB-002).
5. Boundary contains no `aria-live` region and no focus-management code (SR-003, Clarifications 2026-09-29).

### 2. Shell does less redundant work (AC-005, AC-006, AC-007 — US2, PR-002)

1. `PRISMA_LOG_QUERIES=1 pnpm dev`; one navigation between authenticated routes → layout queries ≤ 4, sequential phases ≤ 2, zero queries selecting only `{name, username}` of the current user (AC-005).
2. Header shows `actor.name`, or `"مستخدم برينتكس"` when null — unchanged (AC-006).
3. Live session for `isActive = false` user → refused exactly as today; unauthenticated → redirect `/auth/required` (AC-006, SEC-001).
4. `getActor()` executes once per request across layout + page (AC-007, spy in T011).

### 3. Order detail stops serializing (AC-008, AC-009, AC-010 — US3, PR-004)

1. Fixture: 5 work items × 4 candidate designers. Open `/orders/[orderId]` under query capture.
2. Total eligibility queries ≤ 10; a second, larger fixture keeps the count constant — the 15-query per-item fan-out fails this (Clarifications 2026-09-29; AC-009).
3. Source scan: no `await` inside a loop over `detail.workItems`; creation-event read overlaps `getOrderDetail` (AC-008).
4. Finance panel + spec-history rows render behind skeletons (AC-004).
5. Full order/collection/change-control suites pass **unmodified** — pricing, FSM, audits, permissions identical (AC-010).

### 4. My-queue durations are constant (AC-011, AC-012, AC-013 — US4, PR-003)

1. Query capture at page size 1 and page size 10 → duration query count identical (2 batched queries), not 2 × rows (AC-011).
2. Batch vs per-row equivalence table: `queueTimeMs`, `activeTimeMs`, `totalPhaseDurationMs` (incl. `null`, rework-restart, queue-only/active-only) deep-equal (AC-012).
3. Two-user fixture: batch `where` contains only user A's IDs — user B's rows can never enter (AC-013, FR-018).

### 5. Bell refreshes itself, not the app (AC-014, AC-015, AC-016, AC-017 — US5, PR-005)

1. Idle a minute on `/my-queue` with route-execution spy / query capture → **zero** route-tree re-executions per tick; badge count and first-page rows still update (AC-014).
2. Break the targeted re-read (stub failure) → existing inline error + retry; retry re-attempts the targeted read; polling continues; no `router.refresh` fallback (AC-016, FR-022).
3. Mark one read → server action still writes its audit event, count drops; mark-all unchanged (AC-015, SEC-002 intact).
4. Assert `notifications/actions.ts` no longer calls `revalidatePath("/", "layout")`; other routes' caches survive (AC-017, contract #7).

### 6. Board SCREEN drop stays in-app (AC-018 — US6, PR-006)

1. Controller test: spy `navigate` receives the exact href including `?workItem=`; no `window.location.href` assignment (AC-018, contract #6).
2. Manual: drag `WAITING_PRICING → READY_FOR_PRODUCTION` → soft-navigates to `/pricing?workItem=…` with the item selected; Network tab shows no full document request (PR-006, NB-004).
3. A declined drop policy still navigates nowhere — unchanged (edge case).

### 7. DB verification before any DDL (AC-019, AC-020 — US7, DB-001)

1. `specs/092-performance/db-verification.md` exists with repo evidence: `package.json` Prisma schema path + `prismaSchemaFolder`, which tree `migrate deploy` consumes, inventory of `prisma/migrations/` vs `prisma/schema/migrations/` (DB-001(a)).
2. Against the real database:

   ```sql
   SELECT indexname, indexdef FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename IN ('workitem','order','notification','audit_event','file_object');
   ```

   plus `pnpm prisma migrate status`, and `EXPLAIN (ANALYZE, BUFFERS)` for board lane sort, bell list, order-detail audit probe → all results recorded (DB-001(b)(d), DB-002).

3. If R1–R3 already present → **zero** index DDL ships (AC-019). If missing → one migration in the tree Step 1 proved authoritative, reviewed like any schema change (DB-003).
4. Unreachable DB (`P1001` as during the investigation): record the failure verbatim and stop — **all DDL blocked**, no index assumed missing (FR-028).
5. Deploy drift confirmed → finding filed against 091; no tree rewrite inside 092 (AC-020, FR-027).

## Regression sweep + before/after measurement

Record numbers per PR (evidence, not SLAs), per investigation §21:

1. **Overlay floor** (§21.5): DevTools Performance panel → click an internal link → measure pointerdown → loader unmount. Before: ≥ 1300 ms even when RSC ≤ 300 ms. After: no loader element exists on navigation (PR-001).
2. **Query counts per surface** (§21.3): `PRISMA_LOG_QUERIES=1` for one navigation each — shell layout before 5 → after ≤ 4; `/my-queue` before ≈ 2 × rows → after constant 2; order detail before ≈ 95+ → eligibility after ≤ 10 on the 5×4 fixture (PR-002, PR-003, PR-004).
3. **RSC timing** (§21.2): Network `?_rsc=` requests for `/board`, `/my-queue`, `/orders/[orderId]`, `/production` — TTFB vs transfer, before vs after (skeleton paints earlier; TTFB gains come only from query cuts).
4. **Poll interference** (§21.6): two navigations 15 s apart — before, the tick-collision inflates TTFB; after, zero route re-execution makes both identical (PR-005).
5. **Board drop** (PR-006): Network tab — before a full document request; after only soft-nav/RSC requests.
6. **Raw anchors** (PR-007): grep-style test — zero raw internal `<a href>` in `finance/daily-cash` / `admin/audit`; no `IconRail` entry targeting a non-existent route (AC-023).
7. Full gate repeat (T044): `pnpm check` + `pnpm test` (+ `pnpm test:pricing` if applicable) green; no test edited to weaken expectations (AC-025). Add `resolved-by 092` pointers to `PERFORMANCE_INVESTIGATION.md` §16/§18 (T045).

## Rollout & revert

- **Slice-by-slice**: each plan slice is one independently revertible PR — S1 overlay removal (one-file `git revert`); S2 additive boundary + Suspense (revert = delete `loading.tsx`, unwrap Suspense); S3–S5 query-shape (revert commit; `Actor` widening is additive, so the layout alone can revert); S6 bell wiring (revert restores `router.refresh`); S7 board (one-line revert); S9 mechanical (per-item revert).
- **DDL last**: US7/S8 index migration ships alone after `db-verification.md` evidence, with a reviewed drop-index companion migration as its revert; never `db push` over prod (FR-026, DB-003).
- **Ordering**: US1 → US2 first (Fix First trio) → US3 ∥ US4 → US5 → US6; verification runs from day one (read-only); polish last; S10 continuous.
- **No write-path change anywhere** → any bad slice reverts with `git revert` and no data migration; the only irreversible step (index DDL) is evidence-gated and ships as a normal reviewed migration.
- **Environment note**: dev may run against the remote pooler — do not attribute residual latency to regressions without the §21 numbers; LAN target numbers come at deploy time (091).
