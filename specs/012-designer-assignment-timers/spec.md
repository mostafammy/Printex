# Feature Specification: Designer Assignment & Timers

**Feature Branch**: `012-designer-assignment-timers`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Putting the right designer on the job and measuring every minute of design work. Assignment dialog with eligible designers, workload, and customer history. Rule-based 'lightest eligible designer' suggestion, no auto-assign. Assign/reassign with reason. Designer 'My queue'. Work timer (start/pause/resume/stop) producing queue time, active time, total phase duration. Upload design version. Mark design complete. Continue after rework."

## Clarifications

### Session 2026-09-23

- Q: When a Work Item is unassigned, should a designer ever be able to pick it up themselves from a shared pool, or does every assignment always start with reception (or a head designer) choosing someone? → A: No self-pick in V1 — every assignment is made by reception or a head designer via the dialog.
- Q: Who should be allowed to reassign a Work Item that's already assigned to a designer — reception staff, a head designer, or either? → A: Whoever holds the existing `workitem.assign_designer` permission — seeded to RECEPTION and ADMIN_OWNER by default, extensible to HEAD_DESIGNER via admin config; never to a plain DESIGNER.
- Q: Can a designer have more than one Work Item timer running at once, or does starting a new timer always pause whatever they were previously timing? → A: No — starting a new timer auto-pauses (closes) whatever the designer was previously actively timing (confirms FR-012 as drafted).
- Q: Should a designer's running timer auto-pause when they log out or their shift/session ends, or does it keep running until explicitly stopped? → A: No auto-pause — the segment stays open until an explicit stop/pause or a state-ending transition closes it (confirms the existing Assumptions-section default).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign a designer to a new Work Item (Priority: P1) 🎯 MVP

A reception user has just logged an order with one or more Work Items that need design. They open
the order, pick a Work Item in state `NEW`, and need to hand it to a specific designer — not just
drop it in a shared pile — so someone is accountable for starting it. They open the assignment
dialog, see every eligible designer with how busy each one currently is and how many jobs they've
done for this exact customer before, pick one (the system highlights the least-loaded eligible
designer as a suggestion, but never assigns automatically), and confirm. The designer is notified
and the Work Item moves into their queue.

**Why this priority**: Nothing in the design phase can start until a Work Item has an owner. This
is the single gate between "an order exists" (011) and "a designer is doing something" — without
it, every downstream story (queue, timers, review) has nothing to operate on.

**Independent Test**: Can be fully tested by opening a `NEW` Work Item's order page, opening the
assignment dialog, confirming an eligible designer is shown with workload and customer-history
counts, assigning it, and confirming the Work Item transitions to `ASSIGNED`, the designer receives
a notification, and an audit event records who assigned it and why.

**Acceptance Scenarios**:

1. **Given** a Work Item in state `NEW` and at least one active user holding `design.work`, **When**
   reception opens the assignment dialog, **Then** every eligible designer appears with their count
   of currently active Work Items, their queue size, an estimated wait, and how many past Work Items
   they've completed for this Work Item's customer.
2. **Given** the assignment dialog is open, **When** it finishes loading, **Then** the designer with
   the fewest currently-active Work Items among eligible designers is visually highlighted as the
   suggested pick, but the system does not pre-select or auto-confirm anyone.
3. **Given** reception has picked a designer and confirmed, **When** the assignment is saved,
   **Then** the Work Item transitions `NEW → ASSIGNED`, the designer is notified, and an audit event
   is recorded naming the assigner, the assignee, and the timestamp.
4. **Given** no active user currently holds `design.work`, **When** reception opens the assignment
   dialog, **Then** the dialog shows an empty eligible-designer list with a clear explanation, and
   assignment cannot be confirmed.

---

### User Story 2 - Reassign a Work Item to a different designer (Priority: P1)

A Work Item is already assigned, but circumstances change — the original designer is out sick, is
overloaded, or the job needs a specialist. Reception (or a head designer) reopens the assignment
dialog on an already-assigned Work Item, picks a different designer, and must give a reason. The
Work Item moves to the new designer's queue; the previous designer's recorded time on the job is
kept, not discarded, since work already happened.

**Why this priority**: Reassignment is common enough in a print shop (sick days, urgent
re-prioritization) that without it, a single unavailable designer would block a job indefinitely.
It's P1 alongside initial assignment because both are needed for the assignment flow to be usable
in practice, not just on the happy path.

**Independent Test**: Can be fully tested by reassigning an `ASSIGNED` or `IN_DESIGN` Work Item to a
different eligible designer with a reason, and confirming the new designer's queue shows the item,
the old designer's queue no longer does, the previously recorded time segments are unchanged, and
an audit event captures the reason.

**Acceptance Scenarios**:

1. **Given** a Work Item already `ASSIGNED` to Designer A, **When** an authorized user reassigns it
   to Designer B with a reason, **Then** the Work Item now appears in Designer B's queue, no longer
   appears in Designer A's queue, and Designer B is notified.
2. **Given** a Work Item is `IN_DESIGN` with an open active timer segment under Designer A, **When**
   it is reassigned to Designer B, **Then** Designer A's open segment is closed at the moment of
   reassignment, Designer A's already-recorded time is preserved in history, and no timer is
   automatically started for Designer B (they start their own when ready).
3. **Given** the reassign dialog is open, **When** the user tries to confirm without entering a
   reason, **Then** the system blocks the reassignment and asks for a reason.

---

### User Story 3 - Work a queue with a start/pause/resume/stop timer (Priority: P1)

A designer signs in and sees their personal queue: everything assigned to them, urgent jobs first,
then oldest first, each showing the customer, the product, the due date, and whether it's a rework.
They pick the next job, start the timer, work on it, pause for a break or an interruption, resume,
and eventually stop the timer when they're done for now (or the job moves to another state). The
system needs to know exactly how much time was spent waiting versus actively worked, and that
record has to survive a page refresh or a server restart without losing accuracy.

**Why this priority**: Accurate design time is core to this feature's purpose (the feature exists to
"measure every minute of design work") and is a prerequisite for future costing/performance work.
It's P1 because without it, "Designer Assignment & Timers" delivers assignment but not timers — half
the feature.

**Independent Test**: Can be fully tested by starting a timer on an `ASSIGNED` Work Item, confirming
it moves to `IN_DESIGN`, pausing and resuming it multiple times, refreshing the browser mid-session,
restarting the server process, and confirming the computed active/queue durations are identical
before and after.

**Acceptance Scenarios**:

1. **Given** a Work Item is `ASSIGNED` to the signed-in designer, **When** they start its timer,
   **Then** the Work Item transitions to `IN_DESIGN`, its queue-time segment closes, and an
   active-time segment opens.
2. **Given** an active timer is running, **When** the designer pauses it, **Then** the active-time
   segment closes and no new segment opens until they resume.
3. **Given** a paused Work Item, **When** the designer resumes it, **Then** a new active-time segment
   opens; the total active time is the sum of every closed segment plus the currently open one.
4. **Given** an active or paused timer on a Work Item, **When** the browser is refreshed or the
   server restarts, **Then** the displayed elapsed time is recomputed from persisted segment
   timestamps and matches what it would have shown without the interruption.
5. **Given** a designer has an active timer running on Work Item X, **When** they start the timer on
   a different Work Item Y, **Then** X's active segment is automatically paused (closed) before Y's
   opens — a designer can never have two active-time segments open at once.
6. **Given** a signed-in designer's "My queue" has multiple items, **When** the queue is displayed,
   **Then** items marked urgent appear before non-urgent ones, and within each group the oldest
   (by assignment time) appears first; each row shows customer name, product/description, due date,
   and a rework badge when the item is a `REWORK_REQUIRED` return.

---

### User Story 4 - Upload a design version and mark design complete (Priority: P2)

A designer has finished (or reached a checkpoint in) the design work. They attach the design file as
a new version with a short note, and when the work is genuinely done, mark the Work Item as design
complete. Depending on whether the product type requires review, the item either heads to the review
queue or is treated as approved outright.

**Why this priority**: This is how design work leaves the designer's hands and moves the order
forward — necessary for the feature to be end-to-end useful, but it depends on P1's assignment and
timer stories being in place first, and can be validated independently of exactly how reassignment
edge cases behave.

**Independent Test**: Can be fully tested by uploading a design version with a note to an
`IN_DESIGN` Work Item, then marking it design-complete, and confirming the state becomes
`WAITING_REVIEW` when the product type requires review or `APPROVED` when it does not, with the
uploaded version visible in the Work Item's history either way.

**Acceptance Scenarios**:

1. **Given** an `IN_DESIGN` Work Item, **When** the designer uploads a file with a note, **Then** the
   file is recorded as a new Design Version with the note, visible in the Work Item's history,
   without changing its state.
2. **Given** an `IN_DESIGN` Work Item whose product type requires review, **When** the designer marks
   it design-complete, **Then** the Work Item transitions `DESIGN_COMPLETED → WAITING_REVIEW`, any
   open active-time segment is closed, and the total phase duration (assigned → design completed) is
   fixed and available for display.
3. **Given** an `IN_DESIGN` Work Item whose product type does not require review, **When** the
   designer marks it design-complete, **Then** the Work Item transitions `DESIGN_COMPLETED →
   APPROVED` directly.
4. **Given** a Work Item with no uploaded design version yet, **When** the designer tries to mark it
   design-complete, **Then** the system blocks the action until at least one version is uploaded.

---

### User Story 5 - Continue a Work Item after rework is requested (Priority: P2)

A previously "completed" design was rejected during review (owned by a separate feature, 013) and
comes back as `REWORK_REQUIRED`. The same designer who did the original work needs to see it appear
in their queue again, with the rejection details visible, and be able to pick it back up and keep
timing their work on it.

**Why this priority**: Rework is a normal part of the design/review loop; without this story a
rejected item would have nowhere sensible to land. It's P2 because it depends on review (013)
producing `REWORK_REQUIRED` items in the first place — this spec only owns what happens to the item
once it's back with the designer.

**Independent Test**: Can be fully tested by placing a Work Item directly into `REWORK_REQUIRED`
(simulating what 013 will do), confirming it appears in the original designer's queue with a rework
badge and the rejection details visible, and that resuming work re-opens an active-time segment
under the existing phase-timing history rather than starting a new phase from zero.

**Acceptance Scenarios**:

1. **Given** a Work Item enters `REWORK_REQUIRED`, **When** the queue is refreshed, **Then** it
   reappears in the same designer's "My queue" (unless reassigned per US2) marked with a rework
   badge, and the rejection details are visible on the item.
2. **Given** a `REWORK_REQUIRED` Work Item, **When** the designer starts its timer again, **Then**
   the Work Item transitions to `IN_DESIGN` and a new active-time segment opens, continuing to
   accumulate on top of the item's existing recorded time rather than resetting it.

---

### Edge Cases

- What happens when a designer tries to start a timer on a Work Item that isn't assigned to them?
  The system MUST reject it — only the currently assigned designer may run its timer.
- What happens when reception tries to assign a Work Item that's already in a terminal state
  (`CANCELLED`, `DELIVERED`, `COMPLETED`)? The assignment dialog MUST NOT offer assignment for
  Work Items outside `NEW`, `ASSIGNED`, `IN_DESIGN`, or `REWORK_REQUIRED`.
- What happens if every eligible designer already has an equal, maximum workload? The suggestion
  still highlights one (the first by name, or by earliest last-assignment, for a stable tie-break),
  but the reception user remains free to pick anyone shown.
- What happens if a designer's active timer is left running and they sign out or their session
  expires? The segment stays open in the database (no client-side state to lose); it is closed the
  next time that designer (or whoever reassigns the item) takes an action that ends the phase, and
  the elapsed time up to "now" is still computed correctly for display in the meantime (FR-015).
- What happens when a Work Item is cancelled while a timer is actively running on it? Any open
  active-time or queue-time segment is closed at the moment of cancellation, same as any other
  state transition that ends a phase.
- What happens if a designer wants to work on an unassigned Work Item they see is unclaimed? There
  is no self-pick pool in V1 (Clarifications, 2026-09-23) — they must ask reception or a head
  designer to assign it to them through the assignment dialog like any other Work Item.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user holding the `workitem.assign_designer` permission open an
  assignment dialog for any Work Item in state `NEW`, `ASSIGNED`, `REWORK_REQUIRED`, or already
  `IN_DESIGN` (the latter two cases being a reassignment).
- **FR-002**: The assignment dialog MUST list every active user holding the `design.work`
  permission as an eligible designer, showing for each: count of currently active (non-terminal,
  non-`DELIVERED`/`COMPLETED`/`CANCELLED`) assigned Work Items, queue size, an estimated wait, and
  the count of past Work Items completed for the customer on the Work Item being assigned.
- **FR-003**: The system MUST highlight exactly one eligible designer as the suggested pick, computed
  as the eligible designer with the fewest currently-active Work Items (ties broken by earliest
  last-assignment timestamp, then by name); the system MUST NOT pre-select, auto-confirm, or
  auto-assign this suggestion — a human always confirms.
- **FR-004**: Confirming an assignment MUST transition the Work Item `NEW → ASSIGNED` (or, for a
  reassignment, keep it in its current state while changing its assignee) inside the same
  transaction as recording an audit event naming the assigner, the previous assignee (if any), the
  new assignee, and an optional reason.
- **FR-005**: A reassignment (changing the assignee of a Work Item that already has one) MUST
  require a non-empty reason before it can be confirmed.
- **FR-005a**: Confirming a reassignment requires the same `workitem.assign_designer` permission as
  initial assignment (FR-001) — there is no separate reassignment permission. By default only the
  RECEPTION and ADMIN_OWNER roles are seeded with `workitem.assign_designer` (data-model.md /
  prisma/seed.ts's existing role × permission matrix); a shop MAY additionally grant it to
  HEAD_DESIGNER via that same seed/admin configuration (constitution VI: roles are
  admin-configurable data, not code) if they want head designers to reassign too, but an ordinary
  DESIGNER (holding only `design.work`) never has it by default and MUST be rejected
  (Clarifications, 2026-09-23).
- **FR-006**: Confirming an assignment or reassignment MUST notify the newly assigned designer via
  the existing `notify()` mechanism.
- **FR-007**: Reassigning a Work Item MUST NOT discard or alter the previous designer's already
  recorded `PhaseTiming` segments — that history remains attributed to them.
- **FR-008**: The system MUST provide each designer a personal "My queue" view listing every
  non-terminal Work Item currently assigned to them, sorted urgent-first then oldest-assignment-
  first within each group, each row showing customer name, product/description, due date, and a
  rework indicator when the item's state is `REWORK_REQUIRED`.
- **FR-009**: A designer MUST be able to start a timer on a Work Item currently assigned to them
  and in state `ASSIGNED` or `REWORK_REQUIRED`; starting the timer MUST transition the Work Item to
  `IN_DESIGN`, close its open queue-time segment, and open a new active-time segment.
- **FR-010**: A designer MUST be able to pause a running timer, which closes the open active-time
  segment without changing the Work Item's state or opening a replacement segment.
- **FR-011**: A designer MUST be able to resume a paused timer on a Work Item still in state
  `IN_DESIGN` and assigned to them, which opens a new active-time segment.
- **FR-012**: Starting a timer on a Work Item MUST first pause (close the open active-time segment
  of) any other Work Item the same designer currently has actively timing — a designer can have at
  most one open active-time segment at any moment.
- **FR-013**: Only the designer currently assigned to a Work Item may start, pause, resume, or stop
  its timer; any other user's attempt MUST be rejected.
- **FR-014**: Queue time is defined as the elapsed time between a Work Item entering `ASSIGNED` (or
  `REWORK_REQUIRED`) and the first subsequent timer start; active time is the sum of every
  active-time segment's duration; total phase duration is the elapsed time between the Work Item
  entering `ASSIGNED` and its transition to `DESIGN_COMPLETED`.
- **FR-015**: Every duration the system displays (queue time, active time, total phase duration)
  MUST be computed by re-deriving it from persisted `PhaseTiming` segment timestamps at read time,
  never from an in-memory or client-side accumulator, so the value is correct immediately after a
  page refresh or a server restart.
- **FR-016**: A designer MUST be able to upload a file as a new Design Version on a Work Item in
  state `IN_DESIGN`, attaching a short note; each upload MUST be visible afterward in the Work
  Item's history without changing its state.
- **FR-017**: A designer MUST be able to mark an `IN_DESIGN` Work Item design-complete only after at
  least one Design Version has been uploaded for it.
- **FR-018**: Marking a Work Item design-complete MUST close any open active-time segment, transition
  it through `DESIGN_COMPLETED`, and then to `WAITING_REVIEW` if its own `requiresReview` field
  (set at creation from the product type's default, per 011) is true, or to `APPROVED` if it is
  false.
- **FR-019**: When a Work Item's state becomes `REWORK_REQUIRED` (by a separate feature), it MUST
  reappear in its currently assigned designer's "My queue" with a rework indicator and the
  rejection details attached to it visible.
- **FR-020**: Starting a timer on a `REWORK_REQUIRED` Work Item MUST transition it to `IN_DESIGN` and
  open a new active-time segment that accumulates in addition to (not replacing) the Work Item's
  prior recorded segments.
- **FR-021**: Every assignment, reassignment, timer start/pause/resume, design-version upload, and
  design-complete action MUST be recorded as an audit event identifying the actor, the Work Item,
  and the action taken.
- **FR-022**: The system MUST reject any assignment, timer, upload, or design-complete action
  attempted by a user who lacks the required permission or is not the Work Item's current assignee,
  as applicable per FR-013.

### Key Entities

- **Work Item assignment**: The relationship between a Work Item and the designer currently
  responsible for it — held on the existing Work Item record (`assigneeId`, already part of the
  core domain), changed only through this feature's assign/reassign actions.
- **PhaseTiming segment**: An existing entity (from 002) recording one continuous span (`startedAt`,
  optional `endedAt`) of either `QUEUE` or `ACTIVE` time for a Work Item's current phase; this
  feature is the primary producer of `ACTIVE` segments during the design phase and a consumer of
  both kinds for duration display.
- **Design Version**: A design file plus a short note, attached to a Work Item, produced by the
  upload action in this feature; bytes go through the existing `StorageAdapter` port (002),
  metadata (version number, uploader, note, timestamp) is this feature's own new record, matching
  constitution IV's "new version, never overwritten"; an ordered history of these versions is shown
  on the Work Item.
- **Assignment audit event**: A record of who assigned or reassigned a Work Item to whom, when, and
  (for reassignment) why.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reception user can assign a newly created Work Item to a designer in under 15
  seconds of interaction, including seeing that designer's current workload before confirming.
- **SC-002**: Recomputed timer durations (queue time, active time, total phase duration) are
  identical before and after a page refresh or a server restart in 100% of manual verification
  passes — no drift is ever introduced by the interruption itself.
- **SC-003**: A designer can see their full personal queue, correctly ordered (urgent first, then
  oldest), within one screen load, with no manual filtering required.
- **SC-004**: Reassigning a Work Item never loses previously recorded design time: the sum of a
  reassigned Work Item's active-time segments before and after reassignment differs only by time
  genuinely worked, never by data loss.
- **SC-005**: 100% of assignment, reassignment, timer, upload, and design-complete actions produce a
  corresponding audit event traceable to an actor and a timestamp.

## Assumptions

- The shared file capability referenced by PRI-9 as "050's `files.upload`" is only partially built:
  002 already shipped a low-level `StorageAdapter` port (put/get/exists byte storage,
  `LocalDiskStorageAdapter` for dev) satisfying constitution IV's "storage abstraction," but no
  file-metadata model (versions, checksums, uploader, notes) exists yet — that's 050's undone job.
  This spec defines its own minimal Design Version metadata (Key Entities) on top of the existing
  `StorageAdapter`, shaped so 050 can later generalize it into a shared file model across features,
  rather than inventing parallel storage.
- "Active users with `design.work`" means users who both hold that permission (via their role) and
  are not deactivated — the same activity definition already used elsewhere in the codebase for
  "active" staff.
- Estimated wait shown in the assignment dialog is a simple derived figure (e.g., current queue size
  times an average recent phase duration for that designer) — an approximation for reception's
  decision-making, not a committed SLA; exact formula is an implementation detail for the plan.
- Assignment and reassignment authority both gate on the existing `workitem.assign_designer`
  permission (001's fixed permission vocabulary) — no new permission is needed. By default (per
  the existing seeded role × permission matrix) only RECEPTION and ADMIN_OWNER hold it; HEAD_DESIGNER
  is seeded with only `design.review`. This spec doesn't change the default seed — if a shop wants
  its head designer to also reassign, that's an existing admin/config action (constitution VI),
  not new code. Resolved via Clarifications (2026-09-23).
- A designer may only run one active timer at a time, and starting a new one auto-pauses the
  previous one — resolved via Clarifications (2026-09-23) — rather than blocking the new start
  outright.
- There is no auto-pause on logout or shift end in V1 — resolved via Clarifications (2026-09-23) —
  an open segment simply keeps accruing until explicitly closed by a state-ending action; this is
  why FR-015 requires "elapsed-so-far" to always be computed correctly from persisted timestamps
  rather than relying on any close-on-logout behavior.

