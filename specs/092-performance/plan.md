# Implementation Plan: Navigation Responsiveness & Server-Side Fetch Efficiency

**Branch**: `092-performance` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/092-performance/spec.md`; evidence from `PERFORMANCE_INVESTIGATION.md` (PR #92).

## Summary

092 removes the self-inflicted navigation floor (blocking overlay + zero streaming) and fixes pathological query orchestration (shell waterfall + duplicate read, order-detail serial N+1, my-queue per-row durations, poll-driven route refresh, board full reload), while verification-gating all index/migration work. Read-shape and UI-loading changes only: no business-rule, FSM, audit, pricing, or auth semantics change, and no persistent caching is introduced. Deployment framing: dev may run against a remote pooler (useful as a waterfall amplifier); production is the shop LAN — every fix must be topology-independent.

## Technical Context

**Language/Version**: TypeScript 5.8 strict, Node 22.

**Primary Dependencies**: Next.js 15 App Router (RSC, `loading.tsx`, Suspense, `router.refresh` semantics), React 19 (`cache()`), Prisma 6 / PostgreSQL, Better Auth, Vitest. **No new dependencies** (TR-002).

**Storage**: none added. Read-shape changes only against existing Prisma models; optional index DDL as a normal Prisma migration, verification-gated (spec §Database & Index Verification).

**Module boundary**: pages/layouts orchestrate; `src/server/*` services own query shape; client components receive data as props. Touch surfaces: `src/components/loading/*`, `src/app/(shell)/layout.tsx` + new `loading.tsx`, `src/server/auth/getActor.ts`, `src/app/(shell)/orders/[orderId]/page.tsx`, `src/app/(shell)/my-queue/page.tsx` + `src/server/designers/*`, `src/components/notifications/*` + `src/app/(shell)/notifications/actions.ts`, `src/components/board/BoardProvider.tsx`, small mechanical files (spec §Contracts lists the pinned interfaces).

**Testing**: Vitest (`pnpm test`); DB-backed tests via `DATABASE_URL_TEST` against one Postgres (`tests/helpers/testDb.ts`); query-count assertions via Prisma `query`-event capture; `pnpm test:pricing` gates any finance batching; `pnpm check` (lint + tsc) mandatory (constitution).

**Performance Goals** (properties, not ms SLAs — spec PR-001…PR-008): overlay floor → 0; shell 5 queries/3 phases → ≤4/≤2 with 0 duplicates; my-queue durations O(rows) → O(1); order designer loop O(W×D) → batched; poll route re-executions → 0; board document reloads → 0.

**Constraints**: spec BC-001…BC-007 (no rule changes, UTC, Decimal, RTL, local-first); FC-001/FC-002 (request-memo yes, persistent cache no); SEC-001…SEC-005 (auth/authorize unchanged).

**Scale/Scope**: ~25+ authenticated routes inherit one loading boundary; hot paths touched: every navigation (layout), `/orders/[orderId]`, `/my-queue`, bell (every client), board SCREEN drop (edge), review/customers/finance read shapes.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after design (below)._

| Principle                               | Result                                                                                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Order → Work Item canonical model    | PASS: no schema/entity changes; order detail and queues read the same objects; no parallel sources of truth introduced.                                                                                                      |
| II. Business gates inviolable           | PASS: read-shape only — review/pricing/delivery gates, FSM edges, and preconditions untouched; no "faster path" around a gate exists in scope.                                                                               |
| III. History append-only                | PASS: no audit write-path change; durations still computed from persisted timestamps (BC-002); batching changes how rows are _read_, never written.                                                                          |
| IV. Files immutable/private             | PASS: no file-path change; `<SpecHistory>`/finance panels only gain Suspense wrappers.                                                                                                                                       |
| V. Server is the only authority         | PASS: auth/`isActive`/`authorize` stay server-side per-request (FR-009); bell targeted re-read authenticates + scopes like existing reads (SEC-003); mark-read stays server actions (FR-021); no client authorization added. |
| VI. Configuration over hard-coding      | PASS: no new business constants; loader timing constants are _removed_ for navigation (not turned into config); optional progress-bar delay (if ever built) would be a constant tied to UX, not business policy.             |
| VII. Local-first, isolated integrations | PASS: no Internet dependency added; no topology assumption in any fix (spec SC-011); remote dev DB is treated as measurement environment only.                                                                               |
| VIII. AI optional                       | PASS: no AI features.                                                                                                                                                                                                        |
| IX. Arabic-first, task-oriented UX      | PASS: skeletons/fallbacks reuse existing RTL shell styling and logical properties; no layout redesign; navigation simply gets faster and less intrusive.                                                                     |

**Post-design re-check (after this plan)**: PASS — slices S1–S10 introduce no new stores, dependencies, permission keys, or write paths. The only judgment calls (removing the deliberate navigation overlay; wiring existing seams instead of new abstractions) are recorded in Complexity Tracking as non-violations with rationale.

## Architecture and delivery slices

Recommended order preserved from the spec (perceived → worst actual → gated DDL → cleanup → verification). Each slice is one reviewable PR.

### S1 — Neutralize the navigation overlay (Fix A, spec US1)

- **Architecture impact**: client-only. `AppBootLoader` drives `LoadingExperience` from the boot signal alone; the `pointerdown` anticipation listener, `isNavigating` state, and nav fallback timeout are deleted (or reduced to a no-op comment trail). Skip-link/hash behavior becomes correct for free (NB-002).
- **Files**: `src/components/loading/app-boot-loader.tsx`, `src/components/loading/loading-experience.tsx` (only if nav-specific branches exist there), `src/components/loading/loading-config.ts` (constants stay for boot; navigation references removed), `src/styles/globals.css` (no change expected — overlay class stays for boot), related tests under `tests/components/`.
- **Data flow**: none (no server interaction). `isLoading = isBooting` only.
- **Concurrency**: n/a.
- **Caching**: none.
- **Security**: none (no data, no auth surface).
- **Test strategy**: component test — pointerdown on internal anchor renders no overlay; boot still shows overlay; manual: navigate 5 routes, zero overlays; hash jump clean.
- **Rollback**: single-file revert; no state, no schema.
- **Depends on**: nothing.

### S2 — Shell loading boundary + Suspense (Fix B, spec US1)

- **Architecture impact**: additive routing artifact. New `src/app/(shell)/loading.tsx` becomes the inherited streaming boundary for all `(shell)` routes (SR-001). Suspense wraps `<OrderFinancePanel>`, per-row `<SpecHistory>` (rendered at `orders/[orderId]/page.tsx:1059` region), and `<CustomerBalanceTab>` (SR-002).
- **Files**: `src/app/(shell)/loading.tsx` (new), `src/app/(shell)/orders/[orderId]/page.tsx`, `src/components/finance/order-finance-panel.tsx` (or its call site), `src/app/(shell)/customers/[id]/page.tsx` / `src/components/customers/customer-balance-tab.tsx`, spec-history render site.
- **Data flow**: parent paints with skeleton; async child resolves its own reads then streams in. Fallbacks are static skeletons (FR-007) — no props carrying stale data into fallbacks.
- **Concurrency**: implicit — child queries now overlap the parent's paint (not a code-level `Promise.all` change).
- **Caching**: none (FC-004 respected: no stale substitution).
- **Security**: streamed fragments resolve under the same server `getActor`/`authorize` (SR-004); no data crosses to the client earlier than today's authorization would allow.
- **Test strategy**: structure tests (boundary file exists, Suspense present at the three sites); navigation render test (skeleton appears); manual RTL check of skeletons.
- **Rollback**: delete the boundary + unwrap Suspense — purely additive.
- **Depends on**: none (pairs naturally with S1; ship S1 first so skeletons are never hidden behind the overlay).

### S3 — Shell request optimization (Fix C, spec US2)

- **Architecture impact**: removes the layout's phase-2 duplicate read and unifies session caching. (1) `getActor`/`getActorForSession` populate display fields (`name`, `username`) on `Actor` from the rows already loaded (session user → RBAC user include); (2) `layout.tsx` deletes `db.user.findUnique(...)` and reads `actor.name`; (3) `getActor` delegates to the existing `cache()`-wrapped `getSession` in `src/server/better-auth/server.ts` so both request caches become one; (4) layout phases collapse: `await getActor()` then `Promise.all([unreadCount, listNotifications])` — notifications already parallel; they can start inside the actor's `.then` if measurements show benefit, otherwise 2 clean phases.
- **Files**: `src/server/auth/getActor.ts` (Actor interface + population), `src/app/(shell)/layout.tsx:68-82`, `src/server/better-auth/server.ts` (consumed, likely untouched), `src/server/core` `Actor` bridge if type duplication exists (layout maps to `CoreActor` — display fields are additive, bridge unchanged).
- **Data flow**: session → RBAC user (one joined query) → actor {identity, RBAC, display} → header + notifications in parallel.
- **Concurrency**: phases 3 → 2; no new parallelism beyond dropping the duplicate.
- **Caching**: request-level only (`cache()` reuse, FC-001). **No** persistent cache of actor/RBAC (FC-002).
- **Security**: `isActive` throw stays in `getActorForSession` (getActor.ts:59-61); redirect-on-unauthenticated stays in layout; `authorize()` untouched; display fields are NOT authorization inputs (FR-010).
- **Test strategy**: query-log assertion (≤4 layout queries, zero duplicate display read, ≤2 phases); authz regression (unauthenticated redirect, inactive refusal, `getActor` single-execution spy); header name + Arabic fallback unchanged.
- **Rollback**: revert commit — layout re-reads user; `Actor` widening is additive so reverting layout alone suffices if needed.
- **Depends on**: none strictly; ships after S1/S2 for review clarity (all "every navigation" wins together).

### S4 — Order-detail query orchestration (Fix D, spec US3)

- **Architecture impact**: reorders page-level reads and adds one batch service. Orchestration target: `Promise.all([getOrderDetail, creationEvent])` → then `Promise.all([assigneeRows, reworkCounts])` (both need only IDs from detail) → `departments` and `findPendingChangeRequestIds` joined where independent → designer eligibility via **`getEligibleDesignersBatch(actor, ids)`** replacing the `for … await` (FR-014).
- **Batch design (evidence: `assignment.ts:82-127` = 1 work-item read + `findActiveDesignWorkHolders` + per-candidate `Promise.all` of 3)**: one work-item state/customer read for all IDs; one designers read; **set-based** aggregates (active counts per assignee, past-jobs-per-customer per assignee, last `ASSIGNED` transition per assignee) via grouped queries (`groupBy`/conditional aggregation) instead of per-candidate queries; `suggestDesigner` runs per work item on the shared candidate base (customer-scoped `pastJobs` differs per order customer → group by (designer, customerId) for the involved customers, or per-customer batch when the order has one customer — the common case). Preserve exact eligibility lists and suggestion output (contract §5).
- **Files**: `src/app/(shell)/orders/[orderId]/page.tsx:452-537`, `src/server/designers/assignment.ts` (new batch export; keep single-item function), possibly `src/server/orders/detail.ts` if read grouping is cleaner there; Suspense wraps come from S2 (dependency for paint, not for queries).
- **Data flow**: detail → derived-ID reads in parallel → batched eligibility → render; finance/spec-history stream (S2).
- **Concurrency**: independent phases overlap; per-item fan-out replaced by set reads (DF-002).
- **Caching**: none. Reads stay per-request.
- **Security**: `authorize(workitem.assign_designer)` enforced once in the batch (same key, same server path); `getOrderDetail`'s own authorization unchanged; no data added to the client beyond what is rendered today (DF-005).
- **Test strategy**: existing order suite passes unmodified (AC-010); query-count/concurrency test (AC-008/009); equivalence test batch vs single `getEligibleDesigners` on fixtures (same lists, same suggestion); manual: assign dialog unchanged.
- **Rollback**: revert page orchestration + drop batch export; single-item function is retained so revert is clean.
- **Depends on**: none (S2 improves its paint but is not a code dependency). Start after S3 to keep "every-nav" changes merged first.

### S5 — My-queue batch durations (Fix E, spec US4)

- **Architecture impact**: new `phaseDurationsByIds(actor, ids)` in `src/server/designers/timer.ts`: two queries (`phaseTiming` `where workItemId in ids`, `workItemTransition` `where workItemId in ids AND to in [...] order by at asc`), grouped in JS by work item, then **the same pure duration math** extracted from `phaseDurations` (shared helper so semantics cannot drift — FR-017). Page calls it once with the page's own row IDs.
- **Files**: `src/server/designers/timer.ts` (extract `computePhaseDurations(segments, transitions)` pure fn + batch loader), `src/app/(shell)/my-queue/page.tsx:38-43`.
- **Data flow**: page rows (already actor-scoped by `getMyQueuePage`) → IDs → 2 queries → map → render.
- **Concurrency**: replaces O(rows) overlapping calls with 2 queries; outer `Promise.all` with page/stats stays.
- **Caching**: none.
- **Security**: batch input IDs come only from the actor's authorized queue rows (FR-018); loader does not widen `where` beyond passed IDs; no `authorize` removal (existing function is display-only — keep posture).
- **Test strategy**: equivalence table test (AC-012); two-user leakage test (AC-013); query-count constant at 1 vs N rows (AC-011); existing my-queue tests pass.
- **Rollback**: revert page call to per-row loop (keep batch export or delete).
- **Depends on**: none; natural follow to S4 (same batch-over-N+1 pattern).

### S6 — Notification targeted refresh (Fix F + H, spec US5)

- **Architecture impact**: reconnects an existing seam. (1) The bell re-read is a **no-input server action in `src/app/(shell)/notifications/actions.ts`** returning `{ count, rows }` for the caller (research Decision: bell re-read transport — POST is structurally uncacheable per FC-004; no GET route; must authenticate + scope, SEC-003, TR-006). (2) `layout.tsx` passes `revalidate` into `NotificationBell` (prop already exists, `layout.tsx:97-102` currently omits it) and its type widens from `Promise<void>` to `Promise<{ count, rows }>` (spec Clarifications 2026-09-29). (3) `NotificationBell.refresh` does `setCount`/`setRows` from the resolved payload and **drops `router.refresh()`** on the success path (latest response wins for ordering); same for `notification-list.tsx` where applicable. (4) `notifications/actions.ts` stops calling `revalidatePath("/", "layout")` — scope to `/notifications` (+ bell tag/fetch invalidation if the re-read is cached — it must not be, FC-004). Keep mark-read server actions authoritative (FR-021).
- **Files**: `src/components/notifications/NotificationBell.tsx:58-66`, `use-notification-stream.ts` (no structural change — its `onNotification` already delegates to the bell), `src/app/(shell)/layout.tsx` (wire prop), `src/app/(shell)/notifications/actions.ts:16-20` (scoped invalidation + new `revalidateBellAction`), `notification-list.tsx` if it also refreshes.
- **Data flow**: tick/SSE/refocus → targeted server read → local `count`/`rows` state update. Poll interval (15 s) and SSE transport semantics unchanged (053 contract §Client contract).
- **Concurrency**: background ticks no longer contend with navigation for the query pool via route re-execution (PR-005).
- **Caching**: the re-read is per-call server execution — no `unstable_cache` (FC-002/FC-004).
- **Security**: re-read runs `getActor` + same scoping as `listNotifications`/`unreadCount`; test proves user B's rows unreachable (SEC-003). Mark-read authorization/audit untouched (AC-015).
- **Test strategy**: route-execution spy/query-log delta across a tick (AC-014); failing re-read → error + retry, polling continues (AC-016); actions no longer blanket-invalidate (AC-017); reuse 053 action tests.
- **Rollback**: revert wiring (drop `revalidate` prop, restore `router.refresh`) — behavior returns to today's full refresh.
- **Depends on**: none; **should land before S9's revalidation cleanup is considered "done"** (S6 owns the actions.ts change).

### S7 — Board soft navigation (Fix G, spec US6)

- **Architecture impact**: `BoardProvider` supplies `navigate: (href) => router.push(href)` to `createBoardController`; the `window.location.href` default (`createBoardController.ts:130`) is removed or made a test-only escape hatch. `useRouter` in the provider; controller factory signature already supports `options.navigate` (seam exists — no new abstraction).
- **Files**: `src/components/board/BoardProvider.tsx:29-37`, `src/lib/board/createBoardController.ts:130`, `ScreenDropPolicy.ts` untouched (it only builds the href).
- **Data flow**: drop → policy builds `/pricing?workItem=…` → soft navigation → pricing page reads query param as today.
- **Concurrency**: n/a.
- **Caching**: standard client router behavior; no `staleTimes` change (FC-003).
- **Security**: destination + authorization unchanged — soft nav hits the same server page with the same session.
- **Test strategy**: controller navigation spy asserting href-with-query and no document navigation (AC-018); manual SCREEN drop lands on pricing with selection; regression: other drops unaffected.
- **Rollback**: one-line revert to previous default.
- **Depends on**: none; ships well after S1 so the overlay never interacts with the drop navigation during review.

### S8 — DB / migration / index verification (Fix I, spec US7) — GATED

- **Architecture impact**: **none to application code until evidence exists.** Read-only investigation, then optionally one migration.
  - **Step 1 (immediate)**: reconcile _understanding_ — `package.json` `"prisma": { "schema": "prisma/schema" }` + `prismaSchemaFolder` vs `prisma/migrations/` (6 dirs incl. `workitem_order_perf_indexes`) vs `prisma/schema/migrations/` (4 dirs) vs 091's baseline plan (`0_baseline` fold under `prisma/migrations/`) vs compose `migrate deploy`. Output: which tree a deploy actually consumes.
  - **Step 2 (needs DB)**: `SELECT indexname, indexdef FROM pg_indexes …` for `workitem`, `order`, `notification`, `audit_event`, `file_object`; `EXPLAIN ANALYZE` for board lane sort, notification list, order-detail audit probe; `prisma migrate status`.
  - **Step 3 (conditional)**: only if R1–R3 (or the `FileObject_sha256_idx` drop) are missing → author one migration in the tree Step 1 proved authoritative; never `db push` over prod (091 rules).
  - **Step 4 (conditional)**: if Step 1 shows deploy drift (indexes/tables only in the inactive tree) → file against 091; do not fix here (FR-027).
- **Files**: `specs/092-performance/db-verification.md` (evidence artifact, contract §8); conditionally `prisma/<proven-tree>/<ts>_nav_perf_indexes/migration.sql`.
- **Data flow / Concurrency / Caching / Security**: n/a for verification; DDL changes query plans only — no semantic change; migration follows constitution review rules (DB-003).
- **Test strategy**: documentation gate in review (AC-019/020); if a migration ships, `pnpm test` against migrated test DB + drift check.
- **Rollback**: verification is documentation; an index migration reverts with a companion drop migration (reviewed).
- **Depends on**: environment reachability (P1001 during investigation); 091 coordination if drift found. **Blocks only its own DDL tasks** — S1–S7, S9 are independent.

### S9 — Mechanical optimizations (Fix J, spec FR-029…FR-032)

One small PR, or split by file if review prefers; each item behavior-preserving:

1. `src/server/review/queue.ts:47` — `transitions: { where: { to: "WAITING_REVIEW" }, orderBy: { at: "desc" }, take: 1 }` + **server-side pagination** per research Decision "Review queue": a scalar sort-key pass over the backlog (id, created-at, priority, transition timestamp — preserves the urgent-first/`enteredQueueAt` comparator exactly) plus the full row payload fetched for one page's ids only; every backlog row reachable across pages; stats cover the same full backlog; no fixed `take` ceiling — spec Clarifications 2026-09-29 — replacing the fetch-everything-payload-then-`paginateInMemory` shape; entered-queue timestamp unchanged.
2. `src/server/customers/service.ts:35-38` — `orders: { select: { id, number, createdAt, priority }, take: 20 }` (verify rendered fields on `customers/[id]/page.tsx:25-39` before finalizing the select).
3. `src/app/(shell)/finance/daily-cash/page.tsx:89,128,134` and `src/app/(shell)/admin/audit/page.tsx:206` — raw `<a href>` → `next/link` (`Link`), preserving hrefs incl. query strings.
4. `src/components/shell/IconRail.tsx:51-52,129` — remove dead `/orders` and `/settings` entries (routes don't exist; spec assumption).
5. Finance batching (conditional): `src/server/finance/summaries.ts:81`, `profitability.ts:73`, `payments.ts:202` — one `priceHistory.findMany({ where: { workItemId: { in: ids } } })` grouped to latest-per-item **iff** semantics match `getCurrentPrice` exactly; ship only with `pnpm test:pricing` green (FR-032). Note `payments.ts:202` sits inside a `$transaction` — the batch must read within the same tx semantics.

- **Files / Concurrency / Caching / Security**: as listed; no auth changes; bounded reads only (DF-004/DF-005).
- **Test strategy**: query-shape assertions (one transition per row; selected fields only); grep-style check for raw internal anchors + dead hrefs (AC-021…AC-023); `pnpm test:pricing` for item 5.
- **Rollback**: per-item revert (items are independent).
- **Depends on**: S6 for item-sharing `notifications` scope only if it touched the same lines (it doesn't — actions.ts is S6). Otherwise independent; **kept last** so cleanup never obscures S1–S7 in review.

### S10 — Verification & regression testing

- **Content**: full `pnpm check` + `pnpm test` (+ `pnpm test:pricing` if S9.5 shipped); before/after query-count records per PR (investigation §21 tooling: `PRISMA_LOG_QUERIES=1`, DevTools); manual pass of the seven acceptance flows (overlay-free nav, boot, skeleton, inactive-user refusal, my-queue equivalence feel, bell idle minute, SCREEN drop); confirm no test was edited to weaken expectations; update investigation report with "resolved-by 092" pointers per rank.
- **Depends on**: S1–S9 as landed; S8 only for the DDL-related rows.

## Integration dependencies

- **001**: `getActor`/`Actor` widening + session-cache unification live in 001-owned files; permission vocabulary untouched; authz tests must stay green.
- **002**: layout structure, instrumentation idempotent backstops (layout.tsx:65-66) — do not touch.
- **011/016**: order page orchestration + spec-history render site; change-control query (`findPendingChangeRequestIds`) keeps its contract.
- **012**: `phaseDurations` extraction + batch; `getEligibleDesigners` batch sibling; my-queue page.
- **013**: review queue fetch shape.
- **017**: board controller navigation seam; drop policies untouched.
- **051/052**: `getCurrentPrice` semantics + pricing suite gate; finance panel Suspense.
- **053**: bell/stream contract (poll interval, SSE payload, transport indicator, error surface stay); actions scope change must respect 053's `ui.md` revalidate note (`revalidatePath("/notifications")` + shell count — S6 aligns actions _to_ that contract).
- **091**: owns migration baseline/reconciliation; compose `migrate deploy` stays authoritative; 092 files drift findings there.
- **CI**: `.github/workflows/ci.yml` unchanged (Check & Test already gates PRs).

## Project structure

### Documentation (this feature)

```text
specs/092-performance/
├── spec.md                       # This feature's specification
├── plan.md                       # This file
├── tasks.md                      # Dependency-ordered implementation tasks
├── research.md                   # Phase 0 output (decisions + alternatives)
├── data-model.md                 # Phase 1 output (no new entities; payload shapes)
├── quickstart.md                 # Phase 1 output (validation guide)
├── contracts/                    # Phase 1 output
│   ├── loading-streaming.md
│   ├── query-batching.md
│   ├── notification-refresh.md
│   └── navigation.md
├── db-verification.md            # S8 evidence artifact (created during implementation)
├── checklists/requirements.md    # Spec quality checklist
└── LINEAR_PERFORMANCE_ISSUES.md  # Ready-to-copy Spec & Implement issue bodies
```

### Source Code (repository root)

```text
src/
├── components/loading/           # S1: AppBootLoader, LoadingExperience, loading-config
├── app/(shell)/
│   ├── loading.tsx               # S2: NEW streaming boundary
│   ├── layout.tsx                # S3: drop duplicate read, coalesce phases; S6: wire revalidate
│   ├── orders/[orderId]/page.tsx # S4: parallelize + batch eligibility; S2: Suspense wraps
│   ├── my-queue/page.tsx         # S5: batch durations
│   ├── customers/[id]/page.tsx   # S2: Suspense (balance tab); S9: bounded orders select
│   ├── notifications/actions.ts  # S6: scoped invalidation
│   ├── finance/daily-cash/page.tsx # S9: Link
│   └── admin/audit/page.tsx      # S9: Link
├── server/
│   ├── auth/getActor.ts          # S3: display fields on Actor
│   ├── better-auth/server.ts     # S3: consumed cached getSession
│   ├── designers/timer.ts        # S5: extract pure math + phaseDurationsByIds
│   ├── designers/assignment.ts   # S4: getEligibleDesignersBatch
│   ├── review/queue.ts           # S9: take:1 transitions + server-side pagination (key pass + page payload)
│   ├── customers/service.ts      # S9: select+take orders
│   ├── finance/{summaries,profitability,payments}.ts  # S9 (conditional): price batch
│   └── notifications/            # S6: re-read source (or app/(shell)/notifications)
├── components/notifications/     # S6: NotificationBell refresh without router.refresh
├── components/board/BoardProvider.tsx  # S7: navigate → router.push
└── lib/board/createBoardController.ts  # S7: drop location.href default

prisma/<authoritative-tree>/<ts>_nav_perf_indexes/   # S8 ONLY if verification shows gaps
tests/
├── helpers/queryCount.ts         # S3/S4/S5: Prisma query-event capture helper (new)
├── integration/…                 # authz, durations equivalence/leakage, bell tick
├── contract/…                    # batch vs single eligibility equivalence
└── components/…                  # loader/boot/skeleton behavior
```

**Structure Decision**: single-project web app (existing layout). 092 follows the repo's cross-cutting pattern (like 002/091): no new barrels, no new directories beyond `(shell)/loading.tsx`, the S8 evidence file, and one test helper. Hexagonal boundaries hold — no page talks to Prisma directly for anything new (batches live in `src/server/*`).

## Delivery and sequencing

1. **S1 → S2 → S3** merge first (the investigation's "Fix First" trio): perceived floor removed, streaming live, every-navigation reads trimmed. Each is independently revertible; S1 alone already changes the felt experience.
2. **S4, S5** next (worst routes; same batch-over-N+1 pattern; independent of each other — parallelizable across two people).
3. **S6** then **S7** (stabilize background load; fix the one full-reload edge).
4. **S8 Step 1** can run from day one (read-only); Steps 2–3 when a reachable DB exists; **no S9/S10 sign-off depends on S8 DDL**.
5. **S9** last (cleanup that must not obscure the majors), with finance batching sub-item optional and pricing-gated.
6. **S10** continuous per-PR + final full pass.

**Risk notes**: the only product-visible judgment (overlay removal) lands in S1 with the Assumptions-recorded sign-off; the only irreversible change (DDL) is S8 and gated; no slice touches a write path, so rollback is always `git revert` + (if shipped) a drop-index migration.

## Complexity Tracking

> No Constitution Check violations to justify. Recorded judgment calls (not violations):

| Item                                                                                     | Why not a violation                                                                                                       | Simpler alternative rejected because                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removing the navigation overlay (deliberate UX feature)                                  | Client UX only; boot path preserved; no data/auth/correctness surface (spec FR-001…FR-004; clarified 2026-09-29 Option A) | The `MIN_VISIBLE_MS = 0` navigation variant was clarified away (spec §Clarifications): zeroed timers leave a flash-prone overlay element and dead constants for a feature being deleted |
| Wiring existing seams (`revalidate` prop, `navigate` option) instead of new abstractions | Both seams already exist in shipped code (YAGNI ladder rung 5)                                                            | A new notification-context provider or board-navigation service would be unrequested abstraction                                                                                        |
| `Actor` gaining display fields                                                           | Display-only, sourced from rows the per-request load already returns; authorization inputs unchanged (FR-010)             | A second display-user query is exactly the waste being removed                                                                                                                          |
| One test helper for query counting                                                       | Test-only, needed to make AC-005/009/011 mechanically assertable                                                          | Ad-hoc per-test Prisma clients would duplicate and drift                                                                                                                                |
