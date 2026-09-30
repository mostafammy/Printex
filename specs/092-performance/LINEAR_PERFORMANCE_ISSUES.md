# Linear Issue Bodies — 092-performance

Ready-to-copy descriptions for the two Printex Linear issues. Style follows existing Spec/Implement issues (PRI-16, PRI-17, PRI-32, PRI-64). **No IDs are invented**: real existing IDs are cited where verified (`PRI-20`/`PRI-36` = 091, `PRI-17`/`PRI-33` = 053, GitHub PR #92 = investigation); placeholders `[PRI-###]` mark IDs that don't exist yet.

---

## 1. Spec & plan issue

**Title**: `Spec & plan: 092-performance`

**Suggested labels**: `Spec` · priority High · project: _(create or reuse a performance/quality project — placeholder)_

---

## What you are doing in this issue

Writing the spec/plan/tasks (**docs only — no production code**) for **navigation responsiveness and server-side data-fetch efficiency**: every click currently pays a self-inflicted ~1.3 s blocking-overlay floor and every authenticated navigation re-runs a serial query waterfall with a provable duplicate read. Output: `specs/092-performance/`.

Evidence base: `PERFORMANCE_INVESTIGATION.md` (merged as GitHub PR #92). Read it fully first — but **do not** adopt its recommendations blindly: they must be re-checked against the current codebase, `.specify/memory/constitution.md`, existing specs, and the deployment model (dev may run on a remote Supabase pooler; **production is the shop LAN** — topology is never the fix).

Two problems, kept separate in the spec:

1. **Perceived**: navigation-triggered `AppBootLoader` (pointerdown-armed, opaque, min-visible + exit hold) + zero `loading.tsx`/`Suspense` in `(shell)` → frozen page then pop-in.
2. **Actual**: shell 3-phase waterfall incl. duplicate user read; `/orders/[orderId]` 10-phase serial + await-in-loop N+1; `/my-queue` 50-query durations N+1; 15 s bell poll → `router.refresh()` re-running the route tree; board SCREEN drop full reload; unverified indexes behind a migration-directory split.

---

## ✅ In scope — the spec MUST define

1. **Navigation loading UX**: remove/neutralize the navigation-blocking overlay path; keep initial boot loading; no replacement blocking overlay; optional non-blocking progress indicator (product-gated).
2. **Shell streaming**: authenticated `(shell)/loading.tsx` + Suspense for order finance panel, spec history, customer balance tab — honest skeletons only (never stale data).
3. **Shell request optimization**: kill the duplicate display-user read; collapse layout phases; unify session caches — while **preserving** per-request authoritative RBAC, `isActive`, server-side `authorize`, `Actor` semantics.
4. **`/orders/[orderId]`**: parallelize genuinely independent reads; replace the await-in-loop designer loop with real batch data access; keep workflow/pricing/audit semantics byte-identical.
5. **`/my-queue`**: batched phase durations — exact equivalence with current math, actor-scoped (no cross-user leakage), constant query count per page.
6. **Notification refresh**: passive poll/SSE/refocus stops calling `router.refresh()`; wire the existing-but-unused `revalidate` seam; mark-read stays a server action; defined error/retry; scoped `revalidatePath` (no `"/", "layout"`).
7. **Board navigation**: SCREEN drop → Next.js client navigation preserving `path + query`; no `window.location.href`.
8. **DB/index verification (gated)**: evidence artifact for migration source of truth, deployed schema, actual indexes, representative `EXPLAIN`; R1–R3 + `FileObject_sha256_idx` drop **only if shown missing**; migration-split drift filed against 091, not fixed here.
9. **Mechanical**: review-queue `take:1` transitions + server-side pagination (every row reachable, stats consistent), customers `orders` select+take, raw internal `<a>` → `Link`, dead `/orders`+`/settings` rail links, finance `getCurrentPrice` batching (pricing-suite gated).
10. **Caching model spelled out**: request-level memoization (React `cache()`, promise coalescing) approved; persistent caching (`staleTimes`, `unstable_cache`, tags on operational data) prohibited for RBAC/workflow/queues/pricing/finance/permissions.

## 🚫 Out of scope

- Moving/changing the database topology (Supabase → LAN is **not** the solution); pooler/connection tuning as a fix.
- Persistent caching or `staleTimes` tuning; middleware/edge; new auth mechanism.
- Any business-rule, FSM, gate, audit, or pricing-calculation change.
- Applying index/migration changes before live verification; rewriting migration trees (091 owns the baseline).
- Secondary items the investigation only measured: `pg_trgm` search, audit virtualization, outbox/scheduler re-tuning, login-callback hop.
- Production code in this issue — documentation only.

## 📏 Business/technical rules

- Constitution I–IX all PASS required in `plan.md`'s Constitution Check (gate before design, re-check after).
- Server is the only authority (V): no client authorization, no client-computed RBAC/permissions, mark-read stays server-side with audit.
- No persistent cache of RBAC, workflow state, queues, pricing, financial authority, permissions (request-level memoization only).
- Durations stay computed from persisted timestamps (III); money stays Decimal/exact (Money) — finance batching ships only with `pnpm test:pricing` green.
- Every perf claim is a **measurable property** (query counts, N+1 disappearance, overlay gone, streaming boundary exists, no full reload) — no invented millisecond SLAs.
- `pnpm check` + full test suite green; **no existing semantic test may be edited or weakened**.

## 🤝 Contract

Spec must pin these interface guarantees (names are house-style identifiers, not implementation prescriptions):

1. `Actor` MAY gain display-only `name`/`username` from rows the per-request load already returns — authorization inputs unchanged.
2. `(shell)/loading.tsx` exists as the single inherited loading boundary (skeleton, `aria-busy`, no data).
3. Bell targeted re-read: `{ count, rows }` for the calling user only, delivered through the `revalidate` prop whose type widens to `() => Promise<{count, rows}>` (clarified 2026-09-29); the bell applies the payload to its state (latest response wins); success path never calls `router.refresh()`.
4. `phaseDurationsByIds(actor, ids)` ≡ per-row `phaseDurations` for every row incl. `null` totals; constant query count; caller-scoped IDs only.
5. `getEligibleDesignersBatch(actor, ids)` ≡ repeated single calls; `authorize(workitem.assign_designer)` once server-side; empty input → 0 queries.
6. Board controller `navigate(href)` receives soft navigation; `window.location.href` default removed from production paths.
7. Notification actions invalidate `/notifications` scope only — never `revalidatePath("/", "layout")`.
8. `specs/092-performance/db-verification.md` = the evidence artifact gating all DDL.

## ❓ Decisions for clarify

1. ~~Navigation overlay removal~~ → **clarified 2026-09-29: Option A — remove the navigation path entirely, boot-only overlay, zero loading UI on any navigation; zeroed-timer variant rejected** (spec §Clarifications).
2. ~~Optional non-blocking progress indicator~~ → resolved: MAY, product-gated, not in acceptance.
3. ~~Bell re-read mechanism (server action vs GET route)~~ → resolved: contract pins shape/scoping/behavior; mechanism chosen in plan (server action default).

_(No `[NEEDS CLARIFICATION]` markers remain in spec.md.)_

## ✅ Acceptance

Spec must ship concrete, testable ACs covering at least: no opaque overlay on navigation; boot loading preserved; `(shell)` loading boundary exists; shell auth stays authoritative (redirect + `isActive`); duplicate display-user read gone; `/my-queue` not per-row duration queries (constant count + equivalence + scoping); `/orders/[orderId]` no serialized independent reads + no await-in-loop + batched eligibility; notification polling re-executes **zero** of the route tree; board SCREEN navigation causes no full document reload; schema/index state verified **before** any migration change; existing business semantics preserved (full suite green, no semantic test edits); raw internal anchors → `Link`; dead rail links gone.

Full AC list lives in `spec.md` §Acceptance Criteria (AC-001…AC-025), each traceable to tasks (tasks.md traceability table).

## ▶️ How to run it

1. Read `PERFORMANCE_INVESTIGATION.md` (PR #92) + `.specify/memory/constitution.md`.
2. Inspect conventions: `specs/052-finance/` (spec/plan/tasks/checklist quality bar), `specs/053-notifications/contracts/` (bell/stream contract), `specs/091-deploy-backup/` (migration baseline — dependency, not ours to duplicate).
3. Verify code evidence for each CRITICAL/HIGH claim (`src/app/(shell)/layout.tsx`, `src/components/loading/*`, `orders/[orderId]/page.tsx`, `my-queue/page.tsx`, `NotificationBell.tsx`, `createBoardController.ts`, `review/queue.ts`, both `prisma/*/migrations`).
4. Write `specs/092-performance/{spec.md, plan.md, tasks.md}` + `checklists/requirements.md` (+ this file).
5. Review all three docs against the constitution (Constitution Check table in plan.md); confirm tasks map 1:1 to ACs; run repo doc validation (`pnpm format:check` / prettier on the new files).
6. **Do not modify production code, schema, migrations, or tests.**

## 🎯 Done when

- [ ] `specs/092-performance/` contains spec.md, plan.md, tasks.md, checklists/requirements.md (all items `[x]` with notes), LINEAR_PERFORMANCE_ISSUES.md
- [ ] plan.md Constitution Check = PASS on I–IX, re-checked post-design; Complexity Tracking contains only documented judgment calls
- [ ] Every spec AC maps to ≥1 task/test (traceability table complete); zero `[NEEDS CLARIFICATION]` markers
- [ ] Deployment framing correct: remote-DB-as-multiplier only, LAN as target, all index work verification-gated
- [ ] `pnpm format:check` (or prettier) clean on the new files; git status shows **only** `specs/092-performance/**` (+ `.specify/feature.json`)
- [ ] This issue → Done; implement issue created and linked

## 🔗 Relationships

- **blocked-by**: GitHub PR #92 (`performance-investigation`, merged — `5daff9d`) — evidence input.
- **blocks**: `[PRI-###]` _Implement: 092-performance_ (to be created from §2 below).
- **coordinates with (no hard block)**: `PRI-20`/`PRI-36` (091 deploy-backup — owns migration baseline; any deploy-drift finding is filed there), `PRI-17`/`PRI-33` (053 notifications — bell/stream contract must stay green).

---

## 2. Implement issue

**Title**: `Implement: 092-performance`

**Suggested labels**: `Feature` · priority High · _(project = same as spec issue)_

---

## What you are doing in this issue

Building 092 Navigation Responsiveness & Server-Side Fetch Efficiency as specified in `specs/092-performance/`. Start after the spec issue `[PRI-###]` (Spec & plan: 092-performance) is Done. **Read `PERFORMANCE_INVESTIGATION.md` §6/§17 for the evidence behind each slice.** Sub-issues come from `tasks.md` (T001–T046).

## 🧱 Build slices (≈ one PR each, merge order)

1. **S1 · Navigation overlay removal** — delete the `pointerdown` arming path / `isNavigating` in `src/components/loading/app-boot-loader.tsx`; boot-only `LoadingExperience`; audit dead nav branches in `loading-experience.tsx`/`loading-config.ts`. (T002–T005, US1)
2. **S2 · Shell streaming** — new `src/app/(shell)/loading.tsx` skeleton; Suspense around `<OrderFinancePanel>`, `<SpecHistory>` rows, `<CustomerBalanceTab>`. (T003, T006–T009, US1)
3. **S3 · Shell query optimization** — widen `Actor` with display fields; delete layout's duplicate `db.user.findUnique`; unify session cache via cached `getSession`; collapse layout to 2 phases / ≤4 queries. (T011–T016, US2)
4. **S4 · Order detail orchestration** — `Promise.all` for independent phases; `getEligibleDesignersBatch` (set-based) replacing the await-in-loop; no semantic edits. (T017–T022, US3)
5. **S5 · My Queue batch durations** — extract pure duration math; `phaseDurationsByIds` (2 queries); wire page; equivalence + scoping tests. (T023–T026, US4)
6. **S6 · Notification targeted refresh** — bell re-read source `{count, rows}`; wire existing `revalidate` prop; drop `router.refresh()` from the passive path; scope `revalidatePath("/", "layout")` away. (T027–T032, US5)
7. **S7 · Board soft navigation** — `BoardProvider` passes `navigate: router.push`; remove `window.location.href` default in `createBoardController.ts`. (T033–T034, US6)
8. **S8 · DB verification (gated)** — `db-verification.md`: migration source-of-truth reconcile → live `pg_indexes`/`migrate status`/`EXPLAIN` → **conditional** index migration only if R1–R3 shown missing → drift findings filed to 091. DDL blocked until evidence exists; unreachable DB = record failure, stop. (T035–T038, US7)
9. **S9 · Mechanical** — review-queue `take:1` + server-side pagination; customers `orders` select+take; raw `<a>` → `Link` (daily-cash ×3, audit ×1); dead rail links removed; finance price batching **pricing-gated**. (T039–T043)
10. **S10 · Verification** — full gates + before/after evidence + investigation pointers. (T044–T046)

## 🧪 Tests required

- Query-count helper (`tests/helpers/queryCount.ts`) + smoke test. (T001)
- Loader/boot/skeleton component tests (overlay-free nav, boot preserved, boundary exists, Suspense present). (T002, T003)
- Shell authz regression: unauthenticated redirect, `isActive` refusal, single `getActor`, header name + Arabic fallback; layout ≤4 queries/≤2 phases/zero duplicate read. (T011, T012)
- Eligibility batch ≡ single-call equivalence + zero-query empty case + authz parity. (T017)
- Order-detail structure (no await-in-loop) + concurrency/query-count assertions. (T018)
- Duration batch ≡ per-row table test (incl. `null`/rework cases) + two-user leakage test + constant query count. (T023, T024)
- Bell: tick updates without route re-exec; cross-user isolation of re-read; failure → error/retry; mark-read audit unchanged; scoped invalidation. (T027, T028)
- Board controller navigation spy (href + query, no document reload). (T033)
- Mechanical: query-shape assertions, static no-raw-internal-anchor/dead-href checks. (T039–T042)
- `pnpm test:pricing` before/after any finance batching. (T043)
- Full gate: `pnpm check` + `pnpm test` with **zero** semantic test edits. (T044)

## 🚫 Do NOT

- Do NOT weaken authentication, skip `isActive`, move authorization client-side, or add/remove permission keys.
- Do NOT persistently cache RBAC, workflow state, queues, pricing, financial authority, or permissions; do NOT add `staleTimes`/`unstable_cache` "to make it fast".
- Do NOT change FSM transitions, gates, audit emission, or financial calculations (batching must be provably equivalent or aborted).
- Do NOT treat Supabase/remote latency as the architecture to optimize around — fixes must be LAN-correct too.
- Do NOT add indexes or touch migration trees before the `db-verification.md` evidence exists; do NOT reconcile the migration split here (091 owns it).
- Do NOT replace the removed overlay with any other blocking full-screen layer; do NOT serve stale data as a loading fallback.
- Do NOT edit/skip/weaken existing tests to get green; do NOT refactor beyond the files the tasks name.
- Do NOT expand scope into the investigation's secondary items (pg_trgm, audit virtualization, outbox tuning, login hop) — measure-only.

## ✅ Definition of Done

- [ ] All spec AC-001…AC-025 satisfied with green tests or recorded manual checks (traceability table in `tasks.md`)
- [ ] `pnpm check` passes; `pnpm test` passes unedited; `pnpm test:pricing` passes if T043 shipped
- [ ] Before/after query-count evidence recorded per surface; overlay floor confirmed gone; poll-tick route executions = 0; board drop document loads = 0
- [ ] `db-verification.md` complete: source-of-truth answered; live indexes/plans recorded **or** explicit unreachable failure with all DDL correctly skipped; drift (if any) filed against 091
- [ ] `PERFORMANCE_INVESTIGATION.md` §16/§18 updated with `resolved-by 092` pointers
- [ ] No changes outside the task list's file inventory; investigation's correctness red lines all respected

## 🔗 dependencies

- **blocked-by**: `[PRI-###]` Spec & plan: 092-performance (this spec).
- **blocked-by (conditional, S8 DDL only)**: reachable production/test database for verification evidence; `PRI-20`/`PRI-36` (091) if the migration split is confirmed as deploy drift — file there, don't fix here.
- **soft dependency (review ordering)**: land S1→S2→S3 first (every-navigation wins), S9 last (cleanup must not obscure majors) — per plan.md "Delivery and sequencing".
- **must stay green**: `PRI-17`/`PRI-33` (053 notification suites), order/collection/change suites (011/015/016), pricing suite (051/052).
