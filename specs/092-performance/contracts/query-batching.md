# Contract: Query Batching & Read Shapes

Feature: 092-performance · Date: 2026-09-29 · Status: Draft

Owner: 092. Consumers: shell layout, order detail, my-queue, review queue, customer profile. All clauses are read-shape guarantees: result sets as observed by the UI are unchanged unless a clause explicitly adds a bound with paging (DF-005). No clause introduces a write path or persistent cache (FC-002).

## 1. Shell layout read sequence

1.1 Per authenticated navigation the shell layout MUST issue at most 4 queries and at most 2 sequential phases (AC-005, PR-002).

1.2 The layout MUST NOT issue a second read of the current user's display fields (`name`, `username`) when the session/RBAC load already returned them — zero duplicate current-user reads (FR-008, AC-005).

1.3 The header's displayed name and its existing Arabic fallback (`"مستخدم برينتكس"` when absent) MUST be unchanged (FR-008, US2 AS2).

1.4 Session resolution, the `isActive` check, RBAC graph resolution, and `authorize()` MUST remain server-side, per-request, and authoritative; phases MUST NOT be collapsed in a way that skips or defers them (FR-009, SEC-001/SEC-002).

1.5 `getActor()` MUST still execute exactly once per request across layout and page (FR-012, AC-007); session caches that exist MUST be unified rather than duplicated (FR-011).

1.6 The layout's notification reads (`unreadCount`, `listNotifications`) MUST run concurrently with each other and MUST NOT be serialized behind reads they do not depend on (FR-011).

## 2. `Actor` display widening (spec contract §1)

2.1 `Actor` MAY carry `name: string | null` and `username: string | null`, populated from the user row the session/RBAC load already returns (FR-010).

2.2 `userId`, `roles`, `permissions`, `departmentIds`, and per-request resolution MUST be unchanged (Key Entities — Actor).

2.3 Display fields MUST NOT become authorization inputs; widening `Actor` is NOT an authorization change (FR-010).

2.4 The widening MUST introduce zero new queries (tasks T013).

## 3. `phaseDurationsByIds(actor, ids)` (spec contract §4)

3.1 Signature: `phaseDurationsByIds(actor, ids: string[]) => Promise<Map<string, PhaseDurations>>` (or an aligned array), where `PhaseDurations` is `{ queueTimeMs, activeTimeMs, totalPhaseDurationMs }` (Key Entities — PhaseDurations).

3.2 Per-row output MUST be exactly equivalent to `phaseDurations(actor, id)` for every row and every fixture — including `null` totals, queue-only/active-only segments, rework-restarted phases, and `DESIGN_COMPLETED` without a preceding start transition (FR-017, AC-012). The two paths MUST share one duration-math implementation so semantics cannot drift.

3.3 The query count MUST be constant (2 batched queries) regardless of `ids.length` (PR-003, AC-011).

3.4 Input MUST be restricted to caller-authorized work-item IDs (the actor's own already-authorized queue rows); the loader MUST NOT widen its `where` beyond the passed IDs, and cross-user rows MUST NOT be includable (FR-018, AC-013).

3.5 Durations MUST remain derived from persisted timestamps; no client-side stopwatch logic (BC-002).

## 4. `getEligibleDesignersBatch(actor, workItemIds)` (spec contract §5)

4.1 Signature: `getEligibleDesignersBatch(actor, workItemIds: string[]) => Promise<Map<string, EligibleDesigner[]>>` (per-work-item lists keyed by work-item id), returning the same lists — including suggestion output — as repeated `getEligibleDesigners(actor, id)` (Key Entities — EligibleDesigner; data-model.md batch result map).

4.2 `authorize(actor, "workitem.assign_designer")` MUST be enforced once, server-side, with the same permission key and refusal behavior as the single-item path (FR-014, SEC-002).

4.3 Empty input MUST yield an empty result with zero queries (no empty IN-query storm) (spec Edge Cases).

4.4 On a 5-work-item × 4-designer fixture the total eligibility query count MUST be ≤ 10, and the count MUST stay bounded as W and D vary — the banned constant-per-item fan-out (Clarifications Q4: 3 per-item queries × 5 items = 15 on that fixture; equivalently PR-004's `W × (2 + 3×D)`) MUST NOT occur (PR-004, AC-009, Clarifications 2026-09-29 Q4).

4.5 Reads MUST be set-based (grouped/aggregated across work items and designers), not merely widened concurrency over per-item query storms (FR-014, DF-002).

## 5. Order-detail phase grouping (FR-013 / FR-014)

5.1 Reads sharing no data dependency MUST NOT be serialized behind one another; each genuinely dependent read MUST still await its prerequisite (FR-013, AC-008).

5.2 No `await` MUST occur inside a loop over `detail.workItems` (AC-008, PR-004).

5.3 Eligibility for per-work-item assignment MUST go through the batch loader of §4, replacing the per-item loop (FR-014).

5.4 Order-detail changes MUST be read-shape only: FSM-derived state, pricing values, audit records, permission gating, and every business rule MUST be behaviorally identical before and after (FR-015, BC-001, AC-010).

## 6. Review-queue server-side pagination (FR-029 / AC-021)

6.1 The queue MUST fetch only the transition it reads: `to = WAITING_REVIEW`, most recent, at most one per row (FR-029).

6.2 Pagination MUST be server-side: the full row payload MUST be fetched for only one page's rows at the source — the fetch-everything-payload-then-`paginateInMemory` shape MUST NOT remain. A scalar sort-key pass over the backlog (id, created-at, priority, one transition timestamp; the minimum work preserving the displayed comparator, per research Decision "Review queue") is permitted and is not a violation of this clause (FR-029, Clarifications Q3 Option A).

6.3 Every backlog row MUST remain reachable through paging — no fixed `take` ceiling and no page-window-only bound that strands rows (spec Edge Cases "Review backlog larger than one page", Clarifications Q3).

6.4 Queue statistics MUST describe the same full backlog that the paged rows cover (Clarifications Q3).

6.5 The displayed entered-queue timestamp MUST be preserved exactly (FR-029).

## 7. Customer profile order loading (FR-030)

7.1 `customers/[id]` order loading MUST select only the fields rendered by the page and MUST bound the row count (FR-030, DF-004).

7.2 Displayed values MUST be unchanged (FR-030, AC-022).

## Verification

| Clause       | Acceptance Criteria / Spec refs         |
| ------------ | --------------------------------------- |
| 1.1–1.3, 1.6 | AC-005, PR-002                          |
| 1.4          | AC-006, SEC-001/SEC-002                 |
| 1.5          | AC-007, FR-012                          |
| 2.1–2.4      | FR-010; T011/T013, `pnpm check`         |
| 3.2          | AC-012                                  |
| 3.3          | AC-011, PR-003                          |
| 3.4          | AC-013                                  |
| 4.1, 4.5     | AC-009, FR-014                          |
| 4.2          | AC-006, SEC-002                         |
| 4.3          | spec Edge Cases (zero assignable items) |
| 4.4          | AC-009, PR-004                          |
| 5.1, 5.2     | AC-008                                  |
| 5.4          | AC-010, BC-001                          |
| 6.1–6.5      | AC-021                                  |
| 7.1, 7.2     | AC-022                                  |
