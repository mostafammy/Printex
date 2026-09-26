# Specification Quality Checklist: Notifications & Delay Detection

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] CHK001 No implementation details (languages, frameworks, APIs)
- [x] CHK002 Focused on user value and business needs
- [x] CHK003 Written for non-technical stakeholders
- [x] CHK004 All mandatory sections completed

## Requirement Completeness

- [x] CHK005 No [NEEDS CLARIFICATION] markers remain
- [x] CHK006 Requirements are testable and unambiguous
- [x] CHK007 Success criteria are measurable
- [x] CHK008 Success criteria are technology-agnostic (no implementation details)
- [x] CHK009 All acceptance scenarios are defined
- [x] CHK010 Edge cases are identified
- [x] CHK011 Scope is clearly bounded
- [x] CHK012 Dependencies and assumptions identified

## Feature Readiness

- [x] CHK013 All functional requirements have clear acceptance criteria
- [x] CHK014 User scenarios cover primary flows
- [x] CHK015 Feature meets measurable outcomes defined in Success Criteria
- [x] CHK016 No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- Validation pass 2026-09-25, `/speckit-specify` flow. The four decisions the Linear issue reserves for `/speckit-clarify` (default thresholds, working-hours, escalation, scheduler placement) were asked and answered interactively and are recorded in `spec.md` § Clarifications → Session 2026-09-25, then integrated into FR-036, FR-037, FR-047, FR-049, and the Assumptions section — no `[NEEDS CLARIFICATION]` marker survives.
- Every one of the 70 functional requirements is a MUST with a testable predicate; the four acceptance criteria from PRI-17 map onto SC-001, SC-002, SC-003, and SC-008 respectively, and each is also covered by an acceptance scenario in the owning user story.
- Two scope statements deliberately deviate from the strict "no implementation detail" rule and are marked as such: the wall-clock-versus-working-hours decision and the in-process scheduler decision. Both are owner decisions recorded in Clarifications that were explicitly asked for by the Linear issue, and both are cross-cutting behaviors whose absence would change what gets built — they are recorded as decisions, not as technology choices to be made later.
- FR-002/FR-016 (adding permission-based recipient addressing) is the one requirement that changes a frozen 002 contract surface. It is flagged explicitly in Assumptions and in Notes for Planning, and must be raised with Fady at plan time rather than absorbed silently.
- Reviewed against 052-finance for house conventions: same section order, same ID scheme (FR-0XX / SC-0XX / US1-7), same Clarifications format, same "Key Entities / Out of Scope / Dependencies / Notes for Planning" tail.
- Re-validated 2026-09-25 after `/speckit-analyze` remediation (13 findings, A-001…A-013). All fixed in place:
  - **A-001 (was CRITICAL)** — the outbox column collision. 002 already ships `deliveredAt`/`deliveryStatus` reserved for 053, but the artifacts had specified a *parallel* `processedAt`/`processingStatus` pair. Resolved in favour of **reusing 002's columns** (FR-006, data-model.md §NotificationEvent, contracts/notification-service.md, T006, T007, the catalog's do-not-write rule, and the index definition all now agree), plus a new **`NULL → PENDING` backfill requirement** and regression test T031c — without it the claim predicate would silently skip every event 012/013/014/015/016 has already recorded.
  - **A-002 (was HIGH)** — FR-017's per-event recipient override was required but unimplementable. Added the `NotificationTypeOverride` table (data-model.md), its `recipientOverride`/`setRecipientOverride`/`clearRecipientOverride` contract, the resolver union (T009), the Admin UI + Server Actions (T056/T057), and test T031b. Table count corrected five → six.
  - **A-003 (was HIGH)** — FR-054's "without a redeploy" stop control was missing from contracts/ui.md. Added the start/stop toggle and the `stopDelayScheduler` contract semantics (releases the lease, non-destructive, cannot double-alert on restart), with test T031a.
  - **A-004…A-013** — `derived.ts` added to plan.md's structure (and `overrides.ts`); data-model's "four tables / five columns" corrected to "six tables / four columns"; SC-014's garbled sentence ("A dealer of 200 notifications") rewritten; quickstart's dangling `SC-044` re-anchored to `FR-044`; T027's mismatched `SC-010` anchor corrected to `FR-044`; the catalog's `delivery` union widened to admit `RECORDED_ONLY`; SC-015 rewritten to be falsifiable now that a real override path exists; `STREAM_CAPACITY` named as the 503's error code; the stale "21 fixed Permission union keys" comment in `prisma/schema/identity.prisma` corrected to 22 (the only change outside `specs/`).
- CHK006 ("requirements are testable and unambiguous") was **not** honestly checkable before this pass — FR-006 named columns that contradicted the shipped schema, and FR-017/FR-054 had no implementable path. It is now genuinely satisfied; the re-run confirms all 16 items.
- **Second `/speckit-analyze` re-run** (same day, after the first remediation) found 4 further issues — 2 self-inflicted by the first pass, which is why the first pass was not treated as final:
  - **B-001 (HIGH)** — the A-002 fix updated spec, data-model, contract, and UI but **omitted the server task**: `overrides.ts` was in plan.md's module list with no task creating it, and `thresholds.ts` (T055) did not implement the override functions T077 tests. FR-017 therefore still had no code path. Closed by **T079**.
  - **B-002 (MEDIUM)** — A-004 was incomplete: plan.md named `derived.ts` and T023 referenced it, but no task verb said "create". Closed by rewriting T023.
  - **B-003 (MEDIUM)** — the three tests added in pass 1 used letter-suffixed IDs (`T031a/b/c`), violating the `[ID]` 3-digit format every other task follows. Renumbered to **T076/T077/T078** and re-homed into their correct story test blocks. A follow-on collision (my first renumber of the new override task hit the pre-existing **T075**) was caught by a duplicate-ID check and resolved as **T079**.
  - **B-004 (LOW)** — `NotificationTypeOverride` and `SchedulerLease` were in data-model.md but absent from spec.md's Key Entities. Both added, plus the catalog entry's description now names the `RECORDED_ONLY` delivery mode (A-010).
  - Final state: **T001–T079, contiguous, no duplicates, no lettered IDs**; FR coverage 56%, SC coverage 75%; 0 CRITICAL, 0 constitution violations.
- **Third `/speckit-analyze` re-run** found 5 remaining issues — 0 CRITICAL, 0 HIGH, and no structural or consistency defect. All were test-coverage or traceability hygiene, all now closed:
  - **C-001 (MEDIUM)** — SC-013 clause (a), *an outbox event recorded but not yet processed is delivered exactly once after a server restart*, had no task. T017 covered same-process reprocessing and T076 covered the migration backfill, but neither exercised the crash window between the notification writes and the outbox `PROCESSED` mark — the exact window SC-013 names. Closed by **T080** (`crashRecovery.test.ts`), which fault-injects the abort rather than racing a timer, and asserts one notification per user: the `@@unique([sourceEventId, userId])` pair is what makes it safe, so the test proves the property instead of assuming it.
  - **C-002 (MEDIUM)** — SC-014 (a 200-item breach backlog produces one alert per breached Work Item, not one per tick) had no task at all. Closed by **T081** (`bulkBreach.test.ts`).
  - **C-003 (LOW)** — SC-015's first clause (no delivery rule hard-codes an employee name or ID) had a mechanism but no assertion. Closed by **T082** (`noHardcodedRecipients.test.ts`), a catalog-walking contract test, which makes the criterion falsifiable by a future catalog edit.
  - **C-004 (LOW)** — 28 FRs were implemented but not ID-tagged, so an auditor reading coverage by ID saw 28 phantom gaps. Tags added to the 19 genuinely-built FRs, and the 9 `MUST NOT` scope boundaries (FR-064…FR-067, FR-069, FR-070) tagged onto **T071**, which was already a negative-assertion "confirm 053 changed nothing" task — the right home, since those are verified by absence rather than by a build.
  - **C-005 (LOW)** — T030 now cites `FR-051 / SC-013 (clause b)` so the clause pairing is explicit.
  - **Final state: T001–T082 contiguous, 82 tasks, no duplicates, no lettered IDs. FR coverage 100% (70/70), SC coverage 100% (16/16). 0 CRITICAL, 0 HIGH, 0 MEDIUM.**
