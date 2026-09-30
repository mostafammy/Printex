# Feature Specification: Navigation Responsiveness & Server-Side Fetch Efficiency

**Feature Branch**: `092-performance`

**Created**: 2026-09-29

**Status**: Draft

**Input**: `PERFORMANCE_INVESTIGATION.md` (merged as PR #92 / `5daff9d`), the Spec & Plan Linear issue for the performance/navigation feature (ID placeholder — see `LINEAR_PERFORMANCE_ISSUES.md`). Constitution: `.specify/memory/constitution.md` v1.0.0. This is a **cross-cutting quality feature**, not a PRD feature: it changes how existing features are loaded and fetched, never what they mean.

**Evidence convention**: every problem statement below cites a section of `PERFORMANCE_INVESTIGATION.md` (e.g. §6.1). Findings marked CONFIRMED there were traced through executing code paths. Recommendations from that report are adopted here only where they agree with the current codebase, the constitution, and the LAN-first deployment model.

---

## Clarifications

### Session 2026-09-29

- Q: Should the navigation loading overlay be removed entirely, or kept visible with its delay/exit timers zeroed out for navigation? → A: Removed entirely — the navigation arming path is deleted, boot-only loading remains, and there is zero loading UI on any navigation (Option A). The zeroed-timer variant was considered and rejected.
- Q: The bell's targeted re-read is specified as a `revalidate` prop returning `Promise<void>` — once polling stops calling `router.refresh()`, how does the bell's count and rows actually get updated from that re-read? → A: The prop type changes to `() => Promise<{ count, rows }>` and the bell sets its local state from the return value (Option A); the `revalidate` seam is kept, `router.refresh()` is not needed on any success path, and mark-read gets an immediate server-authoritative count re-read with zero route-tree re-execution. The direct-server-action alternative, the mark-read-only `router.refresh()` split, and the wait-for-next-tick variants were rejected.
- Q: When FR-029's bound is applied to the review-queue query that `paginateInMemory` pages over, what happens to `WAITING_REVIEW` backlog rows beyond that bound? → A: Server-side pagination rework (Option A) — the queue query is bounded per page at the source, every backlog row stays reachable through paging, and queue statistics describe the same full backlog as the paged rows. Fixed-cap truncation, page-window-only `take` (stranding rows), and "transition-fetch only" (leaving the unbounded scan) were rejected.
- Q: What maximum query count must AC-009/T018 allow for designer-eligibility loading on a 5-work-item, 4-designer order? → A: A constant ceiling of **≤ 10 total queries** regardless of work-item and designer counts (Option A) — set-based batching lands around 5–7, and ≤ 10 fails the banned constant-per-item fan-out (3 × 5 = 15) on the exact fixture AC-009 names. Linear-in-W growth (B), a loose ≤ 20 ceiling (C), and growth-only with no numeric bound (D, which lets the banned pattern pass) were rejected.
- Q: After the navigation overlay is removed, how should route changes announce themselves to assistive technology? → A: Skeleton `aria-busy` only — no focus move and no `aria-live` announcement (Option A, SR-003 as written). Live-region announcements, post-commit focus moves, and holding focus on the unmounting skeleton were rejected as new UX outside this feature's scope.

---

## Problem Statement

Printex navigation feels slow for **two independent reasons**, and they must not be collapsed into one problem:

**1. Perceived latency is self-inflicted by the client loading experience.**

- The navigation-triggered `AppBootLoader` arms on `pointerdown` — before routing starts — and the phase machine enforces `SHOW_DELAY_MS (180) + MIN_VISIBLE_MS (500) + COMPLETE_MS (620)` even after the target page has rendered, behind an opaque, input-blocking full-viewport overlay. That is an enforced floor of ~1.3 seconds on **every** navigation regardless of server speed (§6.1, CONFIRMED).
- The authenticated shell has **no** `loading.tsx`, **no** `Suspense` boundary, and **no** streaming fallback anywhere (§6.2, CONFIRMED: zero `loading.tsx`, zero `error.tsx`, only two `fallback={null}` Suspense uses in `(auth)`). A soft navigation therefore freezes the old route until the entire target RSC payload — layout waterfall included — has resolved, then pops in.

**2. Actual server-side latency comes from how queries are issued, not from any single slow query.**

- The shell layout runs a **3-phase sequential waterfall on every authenticated navigation**, including a provable duplicate user read (§6.3, CONFIRMED: `getActor` → duplicate `db.user.findUnique(name, username)` → parallel notifications, in `src/app/(shell)/layout.tsx:37-82`).
- `/orders/[orderId]` is a **10-phase serial waterfall with an await-in-loop N+1** — ~95 round-trips for a 5-item order (§6.4, CONFIRMED: `page.tsx:452-537`, `assignment.ts:82-127`).
- `/my-queue` issues **2 queries per row** for phase durations — ~50 queries per page (§6.5, CONFIRMED: `my-queue/page.tsx:38-43`, `timer.ts:165-199`).
- A **15-second notification poll calls `router.refresh()`**, re-running layout **and** page queries in the background while the user is trying to navigate (§6.6, CONFIRMED: `NotificationBell.tsx:58-66`, `use-notification-stream.ts:38,71`); the cheap targeted `revalidate` prop exists but is never wired (§6.6).
- The board's SCREEN drop performs a **full document reload** via `window.location.href` (§6.8, CONFIRMED: `createBoardController.ts:130`).
- Indexes and the migration source of truth are **unverified**: two migration trees exist and the live database was unreachable during the investigation (§6.10, LIKELY; §2 blocked on `P1001`).

**Deployment context (mandatory framing).** Today's development/MVP environment points `DATABASE_URL` at a remote Supabase pooler, which **magnifies** every sequential round-trip and is useful purely as a waterfall-exposing multiplier (§6.9). The **target production reality is a local LAN** in the print shop (constitution VII: core system runs fully on a local LAN server). This feature therefore:

- does **NOT** treat "move the database off Supabase" as a solution — topology is out of scope;
- **DOES** fix pathological query orchestration, because it is equally wasteful on LAN and is what the remote environment made visible;
- keeps every database/index change explicitly **gated on real-environment verification**, because the investigation could not reach the live database.

---

## Current Behavior

| #   | Behavior                                                                                                                                                                                                           | Evidence                                                                                                              | Dimension          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Any internal-anchor `pointerdown` arms an opaque, input-blocking overlay that survives `MIN_VISIBLE_MS + COMPLETE_MS` after the new page has rendered (~1.3–1.6 s floor per click)                                 | §6.1 (`app-boot-loader.tsx:65-99`, `loading-config.ts:6-15`, `loading-experience.tsx:120-149`, `globals.css:801-814`) | Perceived          |
| 2   | The skip-link `<a href="#main-content">` trips the same overlay for a zero-latency hash jump; `router.push` navigations are not detected at all — the loader is inconsistent in both directions                    | §6.1                                                                                                                  | Perceived          |
| 3   | No `loading.tsx` / `Suspense` in `(shell)` → old route stays frozen until the full target payload resolves, then pops in                                                                                           | §6.2                                                                                                                  | Perceived          |
| 4   | Every authenticated navigation re-runs the layout's 3 sequential phases (session → RBAC graph → **duplicate** `name`/`username` read → parallel notification pair)                                                 | §6.3, §13 (duplicate #1), §10                                                                                         | Actual             |
| 5   | Two request-level session caches never share: `getSession` is `cache()`-wrapped in `better-auth/server.ts:5`, but `getActor` calls `auth.api.getSession` directly                                                  | §6.3 secondary, §13 (duplicate #2)                                                                                    | Actual             |
| 6   | `/orders/[orderId]` serializes ~10 phases (`:453 → :454 → :456 → :471 → :495 → :506 loop → :522 → :530`), awaits designers in a `for` loop, then renders `<OrderFinancePanel>` and N × `<SpecHistory>` unsuspended | §6.4, §12(b)                                                                                                          | Actual             |
| 7   | `/my-queue` runs `phaseDurations` per row (2 queries each) as a third serial phase — 50 queries for a 25-row page                                                                                                  | §6.5                                                                                                                  | Actual             |
| 8   | Notification bell polls every 15 s (and on tab refocus) and calls `router.refresh()`, re-executing layout **and** page queries; on `/my-queue` that re-triggers the 50-query N+1                                   | §6.6                                                                                                                  | Actual + Perceived |
| 9   | Marking one notification read calls `revalidatePath("/", "layout")`, dropping every route's cached RSC payload                                                                                                     | §6.7 (`notifications/actions.ts:16-20`)                                                                               | Actual             |
| 10  | Board SCREEN drop (`WAITING_PRICING → READY_FOR_PRODUCTION`) navigates via `window.location.href` — full HTML download, re-parse, re-hydration                                                                     | §6.8                                                                                                                  | Perceived + Actual |
| 11  | Review queue fetches the whole `WAITING_REVIEW` backlog with **all** transitions per row to `.find()` one element; pagination is in-memory                                                                         | §6.11 (`review/queue.ts:37-49,63,111`)                                                                                | Actual             |
| 12  | Finance code calls `getCurrentPrice` in serial `for` loops (3 sites) — W serial round-trips inside money paths                                                                                                     | §6.12                                                                                                                 | Actual             |
| 13  | `customers/[id]` includes every column of every order ever placed for a page that reads 3 fields                                                                                                                   | §7.1                                                                                                                  | Actual             |
| 14  | Two migration trees exist (`prisma/migrations/` with 6 entries incl. `workitem_order_perf_indexes`, `prisma/schema/migrations/` with 4); live index state unverified (`P1001`)                                     | §6.10, §9, §21.1                                                                                                      | Actual (unproven)  |
| 15  | Raw internal `<a href>` in `finance/daily-cash` (×3) and `admin/audit` (clear-filter) bypass the client router; `IconRail` links to non-existent `/orders` and `/settings` → 404                                   | §7.7, §7.9                                                                                                            | Perceived          |

What is already healthy and **must not be disturbed** (§10): `getActor` is `React cache()`-wrapped (one execution per request); `authorize()` is pure in-memory `Set` membership with **0 DB queries**; shell chrome (`IconRail`, `CommandBar`, `ShellHeader`) is `"use client"` and issues no server queries of its own; `unreadCount` is a single indexed count; `listNotifications` already runs its reads in one `Promise.all`.

---

## Desired Behavior

1. **Navigation is never blocked by a full-screen overlay.** Clicking any internal link starts routing immediately; the target route paints as soon as its shell can render; nothing opaque covers the screen or delays interaction after content has rendered. Initial application boot keeps its loading treatment (first paint is the one moment a blocking overlay is legitimate).
2. **Authenticated routes stream.** The shell exposes a loading boundary so navigation shows a skeleton instead of a frozen old page; expensive async panels stream in behind their own fallbacks; fallbacks are honest skeletons, never stale operational data.
3. **Every authenticated navigation issues fewer, non-duplicated, non-serialized reads** while authentication and RBAC stay exactly as authoritative as today — resolved per request on the server, `isActive` enforced, `Actor` semantics preserved.
4. **The worst routes stop amplifying latency**: `/orders/[orderId]` runs independent reads concurrently and batches its per-item loops; `/my-queue` computes the whole page's phase durations from batched reads with byte-identical semantics.
5. **Passive notification polling updates the bell only** — no route-tree re-execution; server actions remain authoritative for mark/read/unread.
6. **Board SCREEN drop navigates in-app** with query parameters and destination preserved, without a document reload.
7. **No schema or index changes ship before the deployed schema, migration source of truth, and actual indexes are verified** against the real environment; index recommendations R1–R3 are applied only if verification shows them missing.
8. **Correctness is untouched**: workflow FSM, audit emission, pricing math, permissions, and freshness of operational data are behaviorally identical before and after — provable by the existing test suite plus new equivalence tests.

---

## User Scenarios & Testing

### User Story 1 - Staff move through the app without a blocking spinner (Priority: P1) 🎯 MVP

A receptionist or production operator clicks "My Queue" from the board. Today: the screen dims behind an opaque overlay at pointer-down, the old page freezes until the entire new payload is ready, the new page pops in, and the overlay keeps covering the already-rendered page for its minimum-visible window plus a 620 ms exit (~1.3+ s of enforced wait). After this change: the click starts routing immediately, the shell skeleton appears, the new page paints as soon as it can, and **nothing ever covers the screen with an opaque input-blocking layer during navigation**. First-ever application boot still shows the boot loading experience.

**Why this priority**: this is the single highest-leverage fix in the investigation (Rank 1 + Rank 2, both CRITICAL, CONFIRMED) — it removes an artificial floor from _every_ click and needs zero server-side risk.

**Independent Test**: Deploy only this story. Navigate between authenticated routes and confirm: no pointerdown-armed overlay appears, no post-render hold, the old route is replaced by a skeleton rather than freezing, and a hard reload of the app still shows the boot loading treatment.

**Acceptance Scenarios**:

1. **Given** an authenticated user on `/board`, **when** they click a sidebar link to `/my-queue`, **Then** no opaque full-screen overlay appears, input is never blocked after the click, and the target route shows a loading skeleton until its content is ready.
2. **Given** the same navigation completing very fast, **when** the new route has rendered, **then** there is no enforced minimum-visible hold and no exit animation delaying interaction (the ~1.3 s floor is gone).
3. **Given** a first visit to the application (cold boot), **when** the app initializes, **then** the initial boot loading experience still shows and clears as it does today.
4. **Given** the skip link (`#main-content`), **when** it is activated, **then** no navigation overlay appears (hash jumps were never navigations).
5. **Given** a route whose data is slow, **when** the user navigates to it, **then** a non-blocking skeleton is visible and the user can click elsewhere / go back — the page never becomes un-interactable by the loading UI.

---

### User Story 2 - Every authenticated navigation does less redundant server work (Priority: P1)

The shell layout is re-executed on every soft navigation. Today it runs three sequential phases including a duplicate read of `name`/`username` that the session query already returned. After this change the duplicate read is gone, the phases that can overlap do, and the display name still reaches the header — while session resolution, `isActive` enforcement, RBAC graph resolution, and `authorize()` behavior are untouched and still executed fresh on the server for every request.

**Why this priority**: Rank 3/14 (CRITICAL) — it runs on _every_ authenticated navigation and is the largest server-side win that carries no per-route risk; it also removes a provable duplicate rather than merely reordering work.

**Independent Test**: With query logging on, navigate between any two authenticated routes and confirm the layout issues no `user.findUnique`-shaped display-name read, the phase count drops (3 → ≤2), total layout queries drop (5 → ≤4), and an inactive user is still refused, an unauthenticated request still redirects to `/auth/required`, and `authorize()` results are unchanged for every role fixture.

**Acceptance Scenarios**:

1. **Given** an authenticated navigation, **when** the shell layout executes, **then** it issues no duplicate read of the current user's display fields (they are sourced from the already-loaded session/RBAC user row).
2. **Given** the display-name read is removed, **when** the header renders, **then** the user's name (or the existing Arabic fallback name when absent) is unchanged.
3. **Given** a deactivated (`isActive = false`) user with a live session, **when** any authenticated route renders, **then** they are still refused exactly as today.
4. **Given** an unauthenticated request, **when** the shell layout runs, **then** it still redirects to `/auth/required`.
5. **Given** the same request, **when** `getActor()` is called by the layout and by the page, **then** it still executes once per request (existing request-level memoization preserved).

---

### User Story 3 - Opening an order does not serialize independent reads (Priority: P2)

A manager opens `/orders/[orderId]` for a 5-work-item order with 4 eligible designers. Today: ~10 sequential phases plus an await-in-a-loop that issues 1+1+3 queries per candidate designer (~95 round-trips), then unsuspended async panels render one after another. After this change: reads that do not depend on each other start together, per-work-item designer eligibility is fetched with real batched data access (fewer round-trips, not dozens of concurrent single queries), and finance/history panels stream behind fallbacks — with **every** workflow, pricing, and audit semantic byte-identical.

**Why this priority**: Rank 5 (HIGH) — the worst route in the app, but scoped to one page; it depends on nothing else in this feature and is testable in isolation.

**Independent Test**: Open a fixture order with several work items under query logging: assert the page issues no awaited call inside a loop, independent phases overlap (concurrency observable in the query timeline), designer eligibility for N work items costs O(few) queries rather than O(N × designers), and the full existing order-detail test suite passes unchanged.

**Acceptance Scenarios**:

1. **Given** an order page load, **when** the reads that share no dependency are executed, **then** they are not serialized behind each other (creation-event, assignee, rework-count, department, and pending-change-request reads are not ordered where they need not be).
2. **Given** an order with W assignable work items and D candidate designers each, **when** eligibility is loaded, **then** the number of queries does not grow as W × (1 + 1 + 3×D); it grows with batched set reads.
3. **Given** any order, **when** its detail page renders, **then** pricing values, audit events, FSM-derived states, and permission gating are identical to before the change (existing tests pass with no semantic edits).
4. **Given** the finance panel and per-work-item history, **when** the page first paints, **then** they render behind skeleton fallbacks instead of blocking the whole page.

---

### User Story 4 - My Queue computes durations for the whole page at once (Priority: P2)

A designer opens `/my-queue`. Today the page runs `phaseDurations` per row (2 queries × 25 rows = 50 queries) after its page/stats fetch. After this change the whole page's durations come from a constant number of batched reads, producing **exactly** the same numbers per row, computed only from the actor's own visible rows.

**Why this priority**: Rank 6 (HIGH) — a clean, contained N+1 with a precise equivalence requirement; independent of every other story.

**Independent Test**: On a fixture with mixed timing states, compare batch output against the existing per-row function row-by-row (queue ms, active ms, total-phase ms, and null cases); assert query count is constant as page size grows; assert a second user's work items never appear in the batched query.

**Acceptance Scenarios**:

1. **Given** a 25-row queue page, **when** durations load, **then** the page issues a constant, page-size-independent number of duration queries (not 2 per row).
2. **Given** any fixture row, **when** batched and per-row results are compared, **then** `queueTimeMs`, `activeTimeMs`, and `totalPhaseDurationMs` (including `null`) are identical.
3. **Given** user A's queue, **when** the batch runs, **then** only work-item IDs already scoped to A's queue rows are queried — no cross-user row can enter the batch.
4. **Given** durations are computed, **when** the values are displayed, **then** they remain derived from persisted timestamps (constitution III) — no client-side stopwatch logic is introduced.

---

### User Story 5 - The notification bell refreshes itself, not the whole app (Priority: P2)

A user works on a route while the bell polls every 15 s (and on tab refocus). Today each tick calls `router.refresh()`, re-running the shell layout **and** the page's queries — on `/my-queue` that re-triggers the 50-query N+1 — so navigation latency becomes stochastic (slow exactly when the poll collides). After this change the poll performs a targeted server re-read of count + first page and updates only the bell; marking read/unread still runs through server actions with their audit behavior; the existing error + retry surface keeps working.

**Why this priority**: Rank 7 (HIGH) — it makes every other page's latency _stable_, and the targeted `revalidate` seam already exists in the code (plumbed, never wired), so this is connection work rather than new design.

**Independent Test**: With a spy on route-tree execution (or query-log deltas), let the poll tick on `/my-queue` and assert layout + page queries do **not** re-run while the bell count/rows do update; mark one read and assert the server action still writes its audit event and the count drops; break the re-read and assert the error surface + retry path behaves as today.

**Acceptance Scenarios**:

1. **Given** a poll tick or SSE signal, **when** it fires, **then** the bell's count and first page update from a targeted server read and the current route tree is not re-executed.
2. **Given** a mark-read / mark-unread / mark-all action, **when** it runs, **then** it remains a server action with unchanged authorization and audit semantics (server is the only authority for read state — constitution V).
3. **Given** a failed re-read, **when** the client detects it, **then** the existing inline error + retry affordance appears and a retry re-attempts the targeted read (polling continues meanwhile).
4. **Given** the tab is refocused, **when** visibility returns, **then** the bell re-reads through the same targeted path — still without a route-tree refresh.

---

### User Story 6 - Board SCREEN drop keeps the user in the app (Priority: P3)

An operator drags a card from `WAITING_PRICING` to `READY_FOR_PRODUCTION`. Today the controller's default `navigate` fires `window.location.href`, tearing down the document (full HTML, re-parse, re-hydration, loader re-arm — seconds). After this change the drop performs a client-side navigation to the same destination with its query parameters intact (`/pricing?workItem=…`).

**Why this priority**: Rank 11 (HIGH but single-edge) — small, targeted, converts a multi-second reload into a normal navigation; independent of everything else.

**Independent Test**: Drive the SCREEN drop through the controller with an injected navigation spy: assert it receives the target href (query string preserved) and that no `window.location.href` assignment occurs; manually confirm the pricing screen opens with the work item selected.

**Acceptance Scenarios**:

1. **Given** a SCREEN drop, **when** navigation is triggered, **then** the app performs a client-side (soft) navigation — no document unload/reload.
2. **Given** the destination built by the drop policy, **when** navigation runs, **then** the path **and** query parameters (e.g. `?workItem=`) arrive unchanged.
3. **Given** any other board interaction, **when** no navigation is required, **then** behavior is unchanged (only the `navigate` implementation changes).

---

### User Story 7 - Operators can trust what is actually deployed before indexes change (Priority: P2)

Before any index or migration work, an operator verifies — against the real environment — which migration tree is the deploy source of truth, what schema and indexes the deployed database actually has, and how representative navigation-path queries plan (`EXPLAIN` / `EXPLAIN ANALYZE` where available). Only then may index creation/removal become an implementation task. If verification shows `migrate deploy` would miss tables or indexes that only exist in the non-active migration tree, that is reported as a **deployment-correctness** dependency for 091 — not smuggled in as a performance fix.

**Why this priority**: Rank 8 (HIGH, LIKELY) — it gates the only _irreversible_ changes in this feature; it must precede any DDL but blocks nothing else (all other stories are read-shape changes).

**Independent Test**: Run the verification procedure; produce the evidence artifact (queries + results + plans, or an explicit "database unreachable" record). If the live schema already contains R1–R3's indexes, no index task runs at all and the feature still ships.

**Acceptance Scenarios**:

1. **Given** this feature, **when** any index creation/removal task is considered, **then** a recorded verification of migration source-of-truth, deployed schema, and actual indexes exists first.
2. **Given** a reachable database, **when** verification runs, **then** it records `pg_indexes` for the navigation-path tables and at least one representative plan per candidate index (board lane sort, notification list, order-detail audit probe).
3. **Given** an unreachable database (as during the investigation, `P1001`), **when** verification cannot complete, **then** every DDL task stays blocked and the finding is documented — no index is assumed missing.
4. **Given** verification reveals the migration-directory split causes deploy drift, **when** the finding is recorded, **then** it is filed against 091's migration-baseline work (dependency), not applied ad hoc here.

---

### Edge Cases

- **Hash / same-page links**: `#main-content` skip link and any same-path anchors must never trigger loading UI (they are not navigations).
- **`router.push` navigations** (command bar) never had overlay detection; after this feature the absence of an overlay is uniform for every navigation mechanism — Link, push, or programmatic.
- **Poll during navigation**: if a bell re-read lands while a navigation is in flight, only bell state updates; it must not cancel, restart, or re-run the in-flight route render.
- **Failed targeted re-read** (network blip): inline error + retry; polling keeps ticking; never a full-route refresh as a fallback.
- **Batched duration edge rows**: rows with no `QUEUE`/`ACTIVE` segments, rows whose `DESIGN_COMPLETED` has no preceding start transition (`totalPhaseDurationMs = null`), and rework-restarted phases must match per-row output exactly.
- **Order with zero assignable work items**: designer batch is skipped entirely (no empty IN query storm).
- **Session valid but user deactivated**: unchanged refusal — no caching layer may mask it.
- **Display name absent**: header falls back to the existing Arabic default string, exactly as today.
- **Database unreachable during index verification**: DDL tasks remain blocked; everything else ships.
- **Poll tick while the dropdown is open**: rows refresh in place; dropdown open state and scroll position are not reset by the targeted update.
- **Board drop policy declines** (not a SCREEN edge): no navigation call at all — unchanged.
- **Review backlog larger than one page**: server-side pagination keeps every `WAITING_REVIEW` row reachable and queue statistics cover the same full backlog — no fixed-cap truncation hides waiting reviews (FR-029).
- **Finance price batching on money paths**: if the batch cannot reproduce effective-dating semantics exactly (per `getCurrentPrice`), the batching task is abandoned and the serial loop stays — correctness outranks round-trips.

---

## Scope

The feature boundary: **improve navigation responsiveness and server-side data-fetch efficiency without weakening correctness, security, freshness, auditability, workflow guarantees, or the local-first architecture.**

**In scope:**

- **A. Navigation loading UX** — remove/neutralize the navigation-triggered blocking `AppBootLoader` path; preserve initial boot loading; no replacement blocking overlay; optional non-blocking route-progress indicator (product sign-off required, not part of acceptance).
- **B. Shell streaming** — authenticated `(shell)/loading.tsx`; Suspense boundaries for expensive async sections; honest skeleton fallbacks.
- **C. Shell request optimization** — eliminate the duplicate display-user lookup; preserve per-request authoritative RBAC, `isActive`, server-side authorization, and `Actor` semantics; request-level memoization where appropriate.
- **D. `/orders/[orderId]` performance** — remove unnecessary serial ordering; parallelize independent reads; eliminate the await-in-loop N+1 via real batch data access; preserve workflow/pricing/audit semantics.
- **E. `/my-queue` performance** — batched phase-duration loading with exact semantic equivalence and no cross-user exposure.
- **F. Notification refresh architecture** — passive polling stops re-running the route tree; targeted re-read seam (already in the code) becomes the path; server actions stay authoritative; retry/error behavior defined.
- **G. Board navigation** — SCREEN drop replaces full-document navigation with client navigation, preserving query parameters.
- **H. Database/index verification & migration hygiene** — explicit verification of migration source of truth, deployed schema, actual indexes, and representative plans; DDL only after verification; migration-split findings routed to 091 as deployment correctness.
- **I. Smaller mechanical improvements** — review-queue transition over-fetch, bounded customer-order loading, raw internal `<a>` → `Link`, dead navigation links, finance price-lookup batching (money-path gated).

## Out of Scope

- Changing where the database runs (Supabase → LAN or any topology change); connection-string/pooler tuning as a _solution_ (measurement notes only).
- Introducing or tuning persistent caching: `staleTimes`, `unstable_cache` on operational data, long `revalidate`, tag-based caching of queues/pricing/RBAC.
- Adding middleware, edge runtimes, or a new auth/session mechanism.
- Any business-rule, FSM, gate, audit, or pricing-calculation change ("make it faster by allowing X" is automatically out of scope).
- Client-side authorization or client-computed authority of any kind.
- New features (UI redesign, new screens, new permissions, new notification types).
- Deleting or rewriting the boot loading experience (it stays).
- Applying index recommendations without verification; reconciliation of migration trees beyond filing/coordination with 091.
- `pg_trgm` GIN search index, admin-audit virtualization, background outbox/scheduler re-tuning, login-callback redirect hop (ranked secondary in §7/§18 — measured, not built, unless a later spec pulls them in).
- Broad refactors of page components beyond the reads this spec names.

---

## User-Facing Impact

- **Positive**: navigation feels immediate (no dimming, no frozen page, no post-render hold); slow routes show a skeleton instead of a dead screen; the bell no longer causes the page behind it to stutter; the board SCREEN drop no longer "reboots" the app.
- **Neutral/unchanged**: every screen's content, permissions, Arabic-first RTL presentation, and workflow behavior; boot loading on first visit; mark-read flows.
- **Deliberately changed UX**: the anti-flicker navigation polish (constants commented "eliminate visual flicker") is removed — that polish is the bug (§20). This is a product-visible change; removal is clarified as decided (Session 2026-09-29, Option A), with sign-off retained only as a courtesy product flag (see Assumptions).
- **Risk to UX if done wrong**: a skeleton that shows stale or misleading data, or a progress indicator that blocks input — both explicitly prohibited below.

---

## Requirements

### Functional Requirements

**Navigation loading UX (A)**

- **FR-001**: The system MUST NOT arm, show, or hold any blocking full-screen overlay in response to client-side navigation (pointer-down or otherwise), and MUST NOT enforce a minimum-visible or exit-animation delay after a target route has rendered.
- **FR-002**: The system MUST preserve the initial application boot loading experience (first paint), driven only by the boot signal — boot and navigation loading MUST NOT share an armed path.
- **FR-003**: The system MUST NOT replace the navigation overlay with any other input-blocking full-screen loading layer.
- **FR-004**: The system MAY provide a lightweight non-blocking route-progress indicator; if present it MUST NOT intercept input, MUST NOT cover content, and MUST NOT be required for acceptance (approval by the project owner before it ships; it is never acceptance-blocking).

**Shell streaming (B)**

- **FR-005**: The authenticated `(shell)` route segment MUST expose a loading boundary so a soft navigation renders a skeleton instead of holding the previous route frozen.
- **FR-006**: Expensive async sections of the order detail page (finance panel; per-work-item spec history) and the customer balance tab MUST render behind Suspense fallbacks rather than gating their parent's paint.
- **FR-007**: Loading fallbacks MUST be honest skeletons. They MUST NOT present stale operational data (previous route content, cached queue rows, cached prices) as if it were current.

**Shell request optimization (C)**

- **FR-008**: The authenticated layout MUST NOT issue a second read of the current user's display fields when the session/RBAC load already returned them; the header's displayed name and its existing fallback MUST be unchanged.
- **FR-009**: Session resolution, the `isActive` check, the RBAC graph resolution, and `authorize()` MUST remain server-side, per-request, and authoritative — no flow may skip or defer them for speed.
- **FR-010**: `Actor` semantics MUST be preserved; widening `Actor` with display-only fields (name/username) sourced from data the session query already loads is permitted and is NOT an authorization change.
- **FR-011**: Request-level memoization (React `cache()`, promise coalescing within one render) MUST be used for duplicated reads where correctness is preserved; the layout's notification reads MUST NOT be serialized behind reads they do not depend on.
- **FR-012**: The existing single-execution-per-request behavior of `getActor()` (layout + page) MUST be preserved; session caches that exist MUST be unified rather than duplicated.

**`/orders/[orderId]` (D)**

- **FR-013**: Reads on the order-detail page that share no data dependency MUST NOT be serialized behind one another; each genuinely dependent read MUST still await its prerequisite.
- **FR-014**: Per-work-item loops that issue queries (`getEligibleDesigners` per work item) MUST be replaced with real batched data access (set-based reads grouped across work items), not merely widened concurrency over per-item query storms.
- **FR-015**: Order-detail changes MUST be read-shape only: FSM-derived state, pricing values, audit records, permission gating, and every business rule MUST be behaviorally identical before and after.

**`/my-queue` (E)**

- **FR-016**: Phase durations for a queue page MUST be produced from a page-size-independent number of queries (batched), replacing the per-row two-query pattern.
- **FR-017**: Batched durations MUST be semantically identical to the current per-row computation for every row, including `null` total-phase cases, rework-restarted phases, and queue/active filtering.
- **FR-018**: The batch MUST be scoped to work-item IDs from the requesting actor's own already-authorized queue rows; cross-user rows MUST NOT be includable.

**Notification refresh (F)**

- **FR-019**: Passive notification refresh (poll tick, SSE signal, tab refocus) MUST NOT call a full route refresh (`router.refresh()`) or otherwise re-execute the current route tree; it MUST update only notification UI through a targeted server re-read.
- **FR-020**: The existing targeted re-read seam (the bell's `revalidate` prop) MUST be wired to a server-side source that returns the current user's unread count and first page, and the prop's return value MUST deliver `{ count, rows }` to the bell's local state — the prop type changes from `Promise<void>` to `Promise<{ count: number; rows: NotificationView[] }>` so state updates require no route refresh (Clarifications 2026-09-29).
- **FR-021**: Mark-read, mark-unread, and mark-all-read MUST remain server actions and stay the authority for read state, with unchanged authorization and audit behavior (constitution V).
- **FR-022**: Poll/stream error behavior MUST be defined: a failed targeted re-read surfaces the existing inline error + retry, polling continues, and retries re-attempt the targeted read — never a route refresh fallback.
- **FR-023**: Notification actions MUST stop invalidating the entire route tree (`revalidatePath("/", "layout")`); invalidation MUST be scoped to what the action actually changed.

**Board navigation (G)**

- **FR-024**: The board controller's navigation MUST use Next.js client navigation (soft navigation) instead of `window.location.href`, preserving the destination path and query parameters exactly.

**Database / index verification (H)**

- **FR-025**: Before any index creation, removal, or migration change, the system MUST record a verification of: the actual migration source of truth, the deployed schema, the actual indexes on navigation-path tables, and representative `EXPLAIN`/`EXPLAIN ANALYZE` plans where the environment permits.
- **FR-026**: Index recommendations R1 (`WorkItem(state, createdAt, id)`), R2 (`notification(userId, archivedAt, createdAt DESC)`), R3 (`audit_event(entityId, action, createdAt)`) MUST be applied only where verification shows them missing; the free duplicate-index drop (`FileObject_sha256_idx`) is likewise verification-gated.
- **FR-027**: If verification shows the migration-directory split would cause `migrate deploy` to miss tables/indexes, that finding MUST be recorded and routed to 091's migration-baseline work as a deployment-correctness dependency — never fixed ad hoc as a performance change.
- **FR-028**: If the database is unreachable, verification MUST record the failure and ALL DDL tasks remain blocked; no index may be assumed absent.

**Mechanical improvements (I)**

- **FR-029**: The review queue MUST fetch only the transition it actually reads (`to = WAITING_REVIEW`, most recent, one per row), and MUST paginate server-side: the full row payload is fetched for only one page's rows at the source (the fetch-everything-payload + `paginateInMemory` shape MUST NOT remain) while a scalar sort-key pass over the backlog (id, created-at, priority, one transition timestamp — the minimum that preserves the displayed comparator) is permitted; **every** backlog row remains reachable through paging, queue statistics describe the same full backlog, and no fixed `take` ceiling may strand rows (Clarifications 2026-09-29). The displayed entered-queue timestamp is preserved.
- **FR-030**: Customer profile order loading MUST select only the fields rendered and bound the row count, preserving the displayed values.
- **FR-031**: Internal navigation anchors (`finance/daily-cash`, `admin/audit` clear-filter) MUST use client-side navigation; dead rail links MUST be removed or pointed at routes that exist (no silent 404s).
- **FR-032**: Finance `getCurrentPrice` serial loops MAY be batched ONLY if the batch reproduces current-price/effective-dating semantics exactly, verified by the pricing test suite (`pnpm test:pricing`); otherwise the loops stay.
- **FR-033**: No low-risk cleanup task may alter the semantics of the surface it touches; every mechanical change is behavior-preserving or explicitly test-covered.

### Technical Requirements

- **TR-001**: All changes stay within the existing stack (TypeScript strict, Next.js App Router, React, Prisma/PostgreSQL, Better Auth, pnpm). No new framework, ORM, datastore, auth mechanism, or runtime (constitution "Stack"; Complexity Tracking required otherwise — none planned).
- **TR-002**: No new top-level package, dependency, or persistent store may be introduced; no backup-scope expansion is needed (constitution "Backups").
- **TR-003**: Architecture stays hexagonal: page/layout components orchestrate reads; service modules under `src/server/*` own query shape; the client never receives authority it does not already have.
- **TR-004**: Loading/streaming artifacts live at the route segment level (`(shell)` loading boundary + Suspense inside pages/components); no global blocking layer is introduced anywhere.
- **TR-005**: Concurrency changes are read-side only: no new write paths, no transaction-boundary changes, no changes to how audit events commit.
- **TR-006**: The targeted notification re-read must be served by an existing request boundary (server action or route handler) that authenticates like every other server entry point; it introduces no new auth mechanism. Design decision: a **server action only, no GET route** (research Decision: bell re-read transport).
- **TR-007**: Verification artifacts (schema/index evidence) are stored with the feature documentation, not in application code.
- **TR-008**: `pnpm check` (lint + typecheck) and the test suite MUST pass for every slice (constitution Development Workflow).

### Business & Correctness Constraints

- **BC-001**: No business rule may change for speed. Gates (review, pricing-before-delivery, urgent-no-bypass), FSM transitions, and audit emission are untouched (constitution II, III, V).
- **BC-002**: Durations remain computed from persisted timestamps; batching is a read-shape change only (constitution III).
- **BC-003**: Money math keeps exact Decimal semantics; finance batching is gated on pricing tests (constitution "Money").
- **BC-004**: Timestamps stay UTC-stored; no time semantics change.
- **BC-005**: Arabic-first RTL presentation is untouched; loading skeletons use existing styling conventions and logical properties (constitution IX).
- **BC-006**: Configuration-over-hard-coding (constitution VI) is unaffected: no new hard-coded business values; loader timing constants are removed for navigation, not repurposed as config.
- **BC-007**: Local-first (constitution VII): nothing here may add an Internet dependency or weaken LAN operation; the remote DB in dev is treated as a measurement environment, not an architecture to preserve.

### Performance Requirements

Measured as **properties**, not invented millisecond SLAs (baselines come from measurement per §21 of the investigation):

- **PR-001**: Navigation incurs **zero** enforced overlay time: no pointerdown-armed layer, no minimum-visible hold, no exit animation after render (removes the code-derived ≥1300 ms floor).
- **PR-002**: Shell layout query count per authenticated navigation drops from 5 to **≤ 4**, with sequential phases reduced from 3 to **≤ 2**, and **zero** duplicate current-user reads.
- **PR-003**: `/my-queue` duration queries are **O(1) per page**, not O(rows): constant (2 batched queries) regardless of page size (today: 2 × pageSize).
- **PR-004**: `/orders/[orderId]` designer-eligibility queries scale with **batches, not W × (2 + 3×D)** — a constant ceiling of **≤ 10 total queries** for a 5-work-item × 4-designer order, independent of W and D (Clarifications 2026-09-29); no `await` occurs inside a loop over work items; independent page phases overlap rather than chain.
- **PR-005**: Passive notification refresh executes **0** route-tree re-executions per tick (today: layout 5-query waterfall + page queries every 15 s and on refocus).
- **PR-006**: Board SCREEN drop performs **0** full document reloads.
- **PR-007**: No internal navigation link triggers a full document request (raw `<a>` count for internal routes → 0).
- **PR-008**: Query counts and shapes are verifiable in tests (query-log assertions), so regressions are caught mechanically.

### Navigation Behavior Requirements

- **NB-001**: All in-app navigation mechanisms (Link, `router.push`, board controller navigation) behave uniformly: no blocking overlay, no document reload for same-origin destinations.
- **NB-002**: Hash-only and same-path navigations never produce loading UI.
- **NB-003**: Navigation state that remains (if any) MUST be driven by actual route commitment, not by pointer-down anticipation, and MUST NOT gate rendering or input.
- **NB-004**: Board SCREEN navigation preserves path + query string exactly as the drop policy built them.
- **NB-005**: Existing soft-navigation behavior for every other route stays as-is (Link-based, prefetch untouched).

### Streaming Requirements

- **SR-001**: A soft navigation to any `(shell)` route paints the shell + loading skeleton without waiting for the target page's full data resolution.
- **SR-002**: Below-the-fold / panel-level async components (finance panel, spec history, balance tab) stream behind their own fallbacks and do not block their parent.
- **SR-003**: Fallbacks are skeletons with `aria-busy`-style semantics; they never render prior data as current. Route changes announce **nothing else** — no `aria-live` region and no focus movement is introduced for navigation (Clarifications 2026-09-29); existing landmarks and the skip link remain the assistive-navigation affordances.
- **SR-004**: Streaming must not change what data is authorized — every streamed fragment resolves under the same server-side `getActor`/`authorize` rules.

### Data-Fetching Requirements

- **DF-001**: Independent reads run concurrently; dependent reads keep their dependency; no "parallelize everything" that would fire queries whose inputs do not exist yet.
- **DF-002**: Batch over N+1 wherever a set-based read exists (durations, designer eligibility, price lookups), and prefer fewer round-trips over wider fan-out.
- **DF-003**: Duplicated reads within one request are collapsed via request-level memoization; duplicated reads across requests are never cached.
- **DF-004**: Over-fetch is trimmed to rendered fields + explicit bounds (review transitions, customer orders).
- **DF-005**: Read-shape changes MUST NOT alter result sets as observed by the UI (same rows, same fields, same values) except where a bound now limits rows that were previously unbounded — and then only with UI-visible paging/limits already present or added.

### Security Requirements

- **SEC-001**: Authentication flow, session checks, and the `isActive` refusal are unchanged and remain the first gate of every touched server path.
- **SEC-002**: `authorize()` stays server-side with identical permission vocabulary; no permission keys are added, removed, or re-mapped.
- **SEC-003**: The targeted notification re-read authenticates the caller and scopes rows to that caller exactly as `listNotifications`/`unreadCount` do today — it is a new surface, so it is covered by a test proving another user's notifications are unreachable.
- **SEC-004**: No client-side authorization, no client-computed permission state, no client-held RBAC.
- **SEC-005**: No new public or unauthenticated route; no change to file access, CSRF posture, or server-action validation (Zod at boundaries stays).

### Freshness & Caching Requirements

- **FC-001**: **Request-level memoization** (React `cache()`, promise coalescing, shared RSC-render data) is the approved optimization class for this feature.
- **FC-002**: **Persistent cross-request caching** (`unstable_cache`, long `revalidate`, `staleTimes`, tag caches) MUST NOT be introduced for RBAC, workflow state, queues, pricing, financial authority, or permissions — any such caching requires a future spec defining an acceptable consistency model.
- **FC-003**: `staleTimes` tuning is out of scope here entirely (investigation §18.12: measure first; after scoped revalidation).
- **FC-004**: Bell data (count + first page) is display-only but still server-computed on every targeted re-read — never a stale cache serving as authority.
- **FC-005**: Every operational read touched by this feature still reflects committed database state per request; no read may serve data older than its request.

### Database & Index Verification Requirements

- **DB-001**: Verification procedure MUST answer, with evidence: (a) which migration directory `migrate deploy` actually uses given `package.json`'s Prisma schema path and the `prismaSchemaFolder` setting; (b) what indexes exist on `WorkItem`, `notification`, `audit_event`, `order`, `FileObject` in the deployed database; (c) whether R1–R3 are present; (d) representative plans for the three navigation-path query patterns.
- **DB-002**: Evidence artifact (commands + results, or explicit failure) is committed under the feature docs before any DDL task is marked actionable.
- **DB-003**: DDL (create/drop index) ships as a Prisma migration with the same review bar as any schema change (constitution Development Workflow); destructive migration rules apply to any table touch.
- **DB-004**: The migration-split finding, if confirmed, is tracked as a 091 dependency (deployment correctness), keeping performance scope clean.
- **DB-005**: Write-cost notes from the investigation (R1 state churn, R3 hot table) are reviewed at DDL time; indexes are not added "just in case".

---

## Key Entities

No new persistent entities. Existing entities touched read-side only:

- **Actor**: authenticated identity + RBAC snapshot; MAY gain display-only fields (`name`, `username`) already present on the loaded user row; MUST keep `userId`, `roles`, `permissions`, `departmentIds` and per-request resolution.
- **NotificationView / unread count**: bell payload returned by the targeted re-read; same shape the layout already renders (`{ count, rows }` semantics).
- **PhaseDurations**: per-work-item derived duration values; batched loader MUST return the identical structure (`queueTimeMs`, `activeTimeMs`, `totalPhaseDurationMs`).
- **EligibleDesigner**: designer-eligibility rows for assignment; batched loader MUST return the same per-work-item lists as today's per-item calls.
- **Verification evidence** (documentation artifact, not a table): migration source-of-truth + `pg_indexes` + plans.

---

## Dependencies

**Consumes (read / coordination):**

- **001** — `getActor`, `getActorForSession`, `authorize`, `Actor` type; session via Better Auth (`src/server/better-auth/*`). Display-field widening touches 001-owned code and needs its tests green.
- **002** — app shell layout, outbox/delay-scheduler boot hooks (must remain idempotent, untouched), core `Actor` bridging.
- **011 / 016** — order detail page, `getOrderDetail`, `findPendingChangeRequestIds`, spec history rendering.
- **012** — `phaseDurations` (`src/server/designers/timer.ts`), `getMyQueuePage`/`getMyQueueStats`, `getEligibleDesigners` (`assignment.ts`).
- **013** — review queue fetch (`src/server/review/queue.ts`).
- **017** — board controller (`createBoardController.ts`), `ScreenDropPolicy`, `BoardProvider`.
- **051 / 052** — `getCurrentPrice` semantics and `pnpm test:pricing` gate; finance panel component (`OrderFinancePanel`).
- **053** — notification bell, `useNotificationStream`, notification actions, `listNotifications`/`unreadCount`, stream contract (`specs/053-notifications/contracts/`).
- **091** — migration baseline plan (`0_baseline` fold, `migrate deploy` in `compose.md`): owns reconciliation if the split is a deploy gap; 092 must not duplicate it.
- **PERFORMANCE_INVESTIGATION.md** — evidence base; §21 measurement list informs verification.

**Provides:**

- Blocking-overlay-free navigation UX; `(shell)/loading.tsx` loading boundary; Suspense-wrapped async panels.
- Duplicate-free shell layout read path with widened display-capable `Actor`.
- Batched `phaseDurations` and eligible-designer loaders (reusable by other queue surfaces later).
- Wired bell targeted re-read (`revalidate` seam) + scoped notification invalidation.
- Board soft-navigation `navigate` implementation.
- Verification evidence artifact + conditional index migration(s).
- No changes to any contract's public behavior — every consumer sees identical results.

**Cross-feature blockers:** none for slices A–G/I. Slice H's DDL tasks are blocked on verification (environment) and possibly on 091's baseline work (only if drift is confirmed).

---

## Contracts

Contract identifiers below are interface names in the repo's house style (see 051/052 specs) — they pin _shape and guarantees_, not implementation.

1. **`Actor` (display-capable)** — `Actor` MAY carry `name: string | null` and `username: string | null` populated from the session's user row; `userId`/`roles`/`permissions`/`departmentIds` unchanged; resolution remains per-request in `getActor`.
2. **Shell loading boundary** — `src/app/(shell)/loading.tsx` exists and is the single inherited loading surface for all `(shell)` routes; skeleton markup only, `aria-busy` semantics, no data.
3. **Bell targeted re-read** — server-side source returning `{ count: number, rows: NotificationView[] }` for the _calling_ user only; consumed through the bell's `revalidate` prop, whose type becomes `() => Promise<{ count: number; rows: NotificationView[] }>` (clarified 2026-09-29) on `NotificationBell` (and `notification-list.tsx`); the client sets `count`/`rows` state **from that return value**, never via `router.refresh()`; on failure the existing error/retry surface shows. A late-arriving response MUST NOT overwrite newer local state (latest response wins).
4. **`phaseDurationsByIds(actor, ids)`** — returns `Map<workItemId, PhaseDurations>` (or aligned array) with per-row output identical to `phaseDurations(actor, id)` for every row; inputs restricted to caller-authorized IDs; constant query count.
5. **`getEligibleDesignersBatch(actor, workItemIds)`** — returns the same per-work-item `EligibleDesigner[]` lists as repeated `getEligibleDesigners`, with `authorize(workitem.assign_designer)` enforced once server-side and set-based reads; empty input → empty result, no queries.
6. **Board `navigate` option** — `createBoardController(..., { navigate })` receives a client-navigation implementation from `BoardProvider` (`href` → soft navigation); default `window.location.href` fallback MUST be removed or made unreachable in production paths.
7. **Notification invalidation scope** — mark/unmark actions invalidate `/notifications` (and a bell-specific tag/fetch if introduced) — never `revalidatePath("/", "layout")`.
8. **Verification evidence artifact** — `specs/092-performance/` holds the DB verification record (commands, outputs, plans, or explicit unreachable failure) gating all DDL tasks.

---

## Acceptance Criteria

- **AC-001**: No navigation (Link, `router.push`, board drop) renders an opaque input-blocking overlay; a pointerdown on an internal anchor produces zero loading UI (test: unit/DOM assertion on `AppBootLoader` + manual navigation).
- **AC-002**: The boot loading experience still appears on initial application load and clears as today (test: existing boot behavior covered by a component test; manual cold load).
- **AC-003**: `src/app/(shell)/loading.tsx` exists; navigating to any `(shell)` route renders the skeleton instead of freezing the previous page (test: file presence + navigation render test).
- **AC-004**: `<OrderFinancePanel>`, `<SpecHistory>` rows, and `<CustomerBalanceTab>` render inside Suspense with skeleton fallbacks (test: render/structure assertion).
- **AC-005**: The shell layout issues **no** duplicate current-user display read; layout queries ≤ 4 and sequential phases ≤ 2 per navigation (test: query-log assertion).
- **AC-006**: Shell authentication remains authoritative: unauthenticated → redirect to `/auth/required`; `isActive = false` → refused; `authorize()` fixtures unchanged (test: existing auth tests + explicit regression test).
- **AC-007**: `getActor()` still executes once per request across layout + page (test: spy/count assertion).
- **AC-008**: `/orders/[orderId]` retains no unnecessary sequential ordering of independent reads, and no `await` in a loop over work items (test: code-structure assertion + query-count/concurrency test).
- **AC-009**: Designer eligibility for W work items costs batched queries — on a 5-work-item × 4-designer fixture the total eligibility query count is **≤ 10**, and the count stays constant as W and D vary (test: query-log assertion at that fixture plus a second, larger fixture; fails the 15-query per-item fan-out).
- **AC-010**: Order-detail results (states, prices, audits, permissions) match pre-change behavior — full existing order tests pass unmodified (test: `pnpm test`).
- **AC-011**: `/my-queue` issues a constant number of duration queries regardless of page size — no per-row phase-duration query (test: query-log assertion at 1 row vs N rows).
- **AC-012**: Batched durations equal per-row durations on fixtures covering all `null`/rework/queue-active cases (test: equivalence test).
- **AC-013**: The duration batch is scoped to the actor's own queue rows — a cross-user work item cannot appear (test: two-user fixture).
- **AC-014**: Notification polling updates bell state **without** re-executing the route tree (test: route-execution spy / query-log delta across a tick).
- **AC-015**: Mark-read/unread/mark-all remain server actions with unchanged authorization + audit output (test: existing notification action tests pass; no semantic edits).
- **AC-016**: Failed targeted re-read shows the existing error + retry; retry re-attempts the targeted read; polling continues (test: component test with failing fetch).
- **AC-017**: Notification actions no longer call `revalidatePath("/", "layout")` (test: code assertion / behavior test that other routes' caches are untouched).
- **AC-018**: Board SCREEN drop performs a client navigation with `path + query` preserved and no `window.location.href` assignment (test: controller navigation spy).
- **AC-019**: Schema/index verification evidence exists in the feature docs **before** any index task is executed; if verification shows R1–R3 already present, zero index DDL ships (test: documentation gate reviewed in PR).
- **AC-020**: If the migration split is confirmed as deploy drift, a tracked 091 dependency exists — no ad hoc migration rewrite inside this feature (test: review gate).
- **AC-021**: Review queue fetch reads exactly one transition per row for the field it displays, paginates server-side with every backlog row reachable across pages (no silent truncation), and queue statistics stay consistent with the full backlog the pages cover (test: query-shape assertion, page-through fixture larger than one page, displayed timestamp unchanged).
- **AC-022**: Customer profile order loading selects only rendered fields with a bound (test: query-shape assertion; UI unchanged).
- **AC-023**: Zero raw internal `<a href>` navigations in `finance/daily-cash` and `admin/audit`; no `IconRail` link targets a non-existent route (test: grep-style lint assertion + click-through).
- **AC-024**: Finance price batching (if shipped) passes `pnpm test:pricing` unmodified; if it cannot, the serial loop remains and AC-024 is waived with a recorded note (test: pricing suite).
- **AC-025**: `pnpm check` passes and the full test suite passes with no skipped/edited semantic tests (test: CI).

---

## Test Expectations

Constitution requires automated tests for permission checks, audit emission, and gate behavior — every touched surface that carries those must be covered on the **server path**:

1. **Shell authz regression** (AC-006/007): unauthenticated redirect, `isActive` refusal, single `getActor` execution, display-name fallback — `tests/integration/` or `tests/contract/` against the layout path.
2. **Query-count assertions** (AC-005/009/011): a small query-logging helper (Prisma `query` event capture in tests) asserting counts/scalar shapes for: shell navigation, my-queue at two page sizes, order detail with W items × D designers.
3. **Duration equivalence** (AC-012): fixture-driven table test, batch vs per-row, covering queue/active filters, rework restart, `null` totals.
4. **Batch scoping** (AC-013): two-user fixture — user B's work items never enter user A's batch.
5. **Notification targeted refresh** (AC-014/016): tick does not re-execute route; re-read failure → error surface; retry path; mark-read audit unchanged (reuse 053's action tests).
6. **Board navigation** (AC-018): controller-level spy asserting href (with query) and absence of document navigation.
7. **Order detail** (AC-008/010): existing suite must pass unmodified; add a structure/concurrency assertion for the new orchestration.
8. **Mechanical** (AC-021/022/023): query-shape assertions + a static/lint check for raw internal anchors and dead rail hrefs.
9. **Pricing gate** (AC-024): `pnpm test:pricing` before/after any finance batching.
10. **No tests are deleted or weakened** to make a change pass; fixtures are extended, not edited to lower expectations.

New tests live under the existing layout (`tests/{unit,integration,contract,performance}/`) and follow Vitest conventions (`pnpm test`, DB-backed tests use `DATABASE_URL_TEST`).

---

## Success Criteria

- **SC-001**: Navigating between authenticated sections never blocks the screen or input behind a loading layer, and there is no enforced delay after content renders (the code-derived ≥1.3 s navigation floor is eliminated).
- **SC-002**: A soft navigation shows a loading skeleton instead of a frozen previous page on every authenticated route.
- **SC-003**: First application load still presents the boot loading experience (no regression to cold start).
- **SC-004**: Each authenticated navigation performs at most one current-user display lookup — zero duplicates — and no more than two sequential server phases in the shell.
- **SC-005**: Opening an order issues no queries from inside a per-work-item loop; query count for eligibility stops scaling with work-items × designers.
- **SC-006**: My Queue's duration query count is the same for a 1-row page and a 25-row page, and every displayed duration matches the previous computation exactly.
- **SC-007**: In a minute of idle background polling, zero route-tree re-executions occur; the bell still shows correct, server-computed counts.
- **SC-008**: Dropping a card on the SCREEN station never triggers a full page reload; the user stays in the running app.
- **SC-009**: Every index change (if any) is backed by recorded evidence of the deployed schema and plans; if evidence shows indexes already exist, no DDL ships.
- **SC-010**: The full existing test suite passes with no semantic test edits; new equivalence/authorization tests pass; `pnpm check` is green.
- **SC-011**: All changes remain correct under the LAN production target — no optimization assumes the remote dev database (topology-independence).

---

## Assumptions

- **Product sign-off on loader removal**: clarified 2026-09-29 (Session, above) — the navigation overlay path is **removed entirely** (Option A): boot-only overlay retained, zero loading UI on any navigation, zeroed-timer navigation variant explicitly rejected as dead weight for a feature being deleted. Sign-off remains a courtesy product flag (the overlay was deliberate anti-flicker polish, constants commented as such, §20), but the spec no longer offers a fallback variant.
- **Optional progress indicator**: deferred; not part of acceptance; would need its own product decision (FR-004).
- **Notification re-read mechanism**: server action vs. route handler is an implementation choice (TR-006); what is now fixed (Clarifications 2026-09-29) is the delivery shape — `revalidate()` returns `{ count, rows }` and the bell applies it directly to state, with scoping and no-route-refresh behavior unchanged.
- **Remote DB stays as-is for now**: dev/MVP may keep pointing at Supabase; nothing in this feature depends on RTT, and nothing is optimized _for_ RTT.
- **091 owns migration reconciliation**: the baseline fold plan in `specs/091-deploy-backup` is the intended fix for tree drift; 092 verifies and files, and only applies DDL for _indexes_ shown missing (DB-001…DB-005).
- **Index recommendations may be moot**: R1–R3 are code-derived; the deployed DB may already have them (CI `db push` environments do). Verification first is the whole point.
- **`getCurrentPrice` batching is conditional**: if effective-dating semantics cannot be proven equivalent, loops stay (FR-032) — accepted as a known remaining cost.
- **No `staleTimes` in this feature**: measurement of client route-cache behavior is deferred to a future spec (FC-003).
- **Background loops (outbox/scheduler) are out of scope**: their tick cost is noted in the investigation (§7.3) but not tuned here.
- **Suspense scope**: only the panels named in FR-006 (finance, spec history, balance tab) plus the shell boundary; per-lane board content and other parent→child serializations (§12c) are candidates a later slice may add if measurement shows value — not required here.
- **Dead links**: `/orders` and `/settings` rail entries are removed (routes don't exist) rather than new routes built — creating those pages is product scope beyond this feature.

---

## Rollout & Verification Considerations

- **Slice-by-slice delivery**: every plan slice is independently reviewable and revertible; the loader change (S1) is a one-file revert; the shell streaming (S2) is additive; query-shape slices (S3–S5) are each localized to one layout/page/service; DDL (S8) ships last and alone.
- **Verification-first ordering**: the DB verification slice can _start_ immediately (it is read-only) but its DDL outputs land after evidence; all other slices have zero schema coupling and are not blocked by an unreachable database.
- **Measurement**: use `PRISMA_LOG_QUERIES=1` (dev, no code change) and browser DevTools per investigation §21 to confirm before/after query counts and the disappearance of the overlay floor; record numbers in the PR description of each slice, not as SLAs.
- **Regression gates**: `pnpm check`, `pnpm test`, `pnpm test:pricing` (only if finance batching ships), plus the CI `Check & Test` workflow.
- **Risk containment**: no slice changes write paths; a bad slice reverts without data migration. The only irreversible step (index DDL) is gated on evidence and ships as a normal reviewed migration.
- **Environment note for testers**: dev may run against the remote pooler — do not attribute residual latency to regressions without the §21 measurements; LAN target numbers come at deploy time (091).
- **Documentation update**: README performance notes / investigation report get a "resolved by 092" pointer when each ranked finding closes.

---

## Notes for Planning

- The investigation's Fix letters (A–J) and rank numbers are the traceability backbone: plan slices S1–S10 map to them; tasks cite both.
- Request-level memoization is explicitly pre-approved (FC-001); persistent caching is explicitly out (FC-002) — the plan must not "solve" latency with caches.
- `authorize()`'s 0-query in-memory design and `getActor`'s `cache()` wrapper are assets — plan must not regress them while reordering reads.
- The bell's `revalidate` prop and the board controller's `navigate` option are **existing seams**: prefer wiring them over inventing new abstractions (YAGNI).
- Keep low-risk cleanup (slice S9) last so it never obscures the major objectives in review.
