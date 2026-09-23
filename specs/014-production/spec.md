# Feature Specification: Production Workflow

**Feature Branch**: `014-production`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Production floor — each operator sees only their department's jobs,
works from the approved file, and every production phase is timed. Routing to a department,
operator queue, job card with approved-file-only downloads, production timer, produced-quantity
completion, send-back-to-design, external vendor production, revised-file alert."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator sees only their department's queue (Priority: P1)

A Production Operator opens their queue and sees every Work Item routed to a department they
belong to and ready for production, urgent items first then oldest, with a badge on any item
whose approved file changed since it entered the queue. A Work Item routed to a department this
operator does not belong to never appears, no matter how they navigate.

**Why this priority**: Without a scoped queue, nothing else in this feature has a starting point,
and department isolation is the core safety property production floor staff depend on (FR-001,
FR-003).

**Independent Test**: Seed Work Items routed to two different departments (one urgent, two normal
at different ages) plus one Work Item still in review; open the queue as an operator belonging to
only one department and confirm only that department's ready-for-production items appear,
urgent-first then oldest-first.

**Acceptance Scenarios**:

1. **Given** three ready-for-production Work Items routed to a department an operator belongs to
   (one urgent, two normal at different ages), **When** the operator opens their queue, **Then**
   the urgent item appears first, followed by the two normal items oldest-first.
2. **Given** a Work Item routed to a department the operator does not belong to, **When** the
   operator opens their queue or requests that Work Item's job card directly by ID, **Then** the
   Work Item does not appear in the queue and the direct request is refused.
3. **Given** a Work Item in production whose approved file has been replaced by a newer approved
   version, **When** the operator views their queue, **Then** that item carries a visible
   revised-file badge.

---

### User Story 2 - Operator works a job from its card (Priority: P1)

An operator opens a Work Item's job card and sees its read-only specification (dimensions,
quantity, material, notes) and can download only the Approved or Production file for that
version — never an unapproved draft — so production always runs from what the Head Designer
actually signed off on.

**Why this priority**: The job card is what the operator actually works from; without it the
queue is just a list with nothing behind it, and restricting downloads to approved files is the
feature's core trust guarantee (FR-004).

**Independent Test**: Open the job card for a Work Item with both an approved version and a newer,
unapproved draft version; confirm the specification fields render read-only and only the approved
version's file is offered for download.

**Acceptance Scenarios**:

1. **Given** a Work Item routed to the operator's department, **When** they open its job card,
   **Then** they see its dimensions, quantity, material, and notes as read-only fields, with no
   control to edit any of them.
2. **Given** a Work Item with an approved version and a newer unapproved draft, **When** the
   operator looks for a file to download, **Then** only the approved (or later Production-stage)
   version's file is offered, never the draft.
3. **Given** a Work Item's job card, **When** the operator looks for customer, pricing, or design
   history detail, **Then** none of that is editable from this screen (FR-011).

---

### User Story 3 - Operator times a production run (Priority: P1)

An operator starts a timer when they begin working a Work Item, which moves it to
`IN_PRODUCTION`; they can pause and resume the timer as work is interrupted, and every phase's
duration is derived from the recorded start/pause/resume timestamps rather than tracked by a
running client-side clock.

**Why this priority**: Timed production phases are a named, load-bearing requirement (PRD §16-18)
and the mechanism every later completion/reporting feature reads from; it must exist before
completion (US4) is meaningful.

**Independent Test**: Start a timer on a Work Item, pause it after some elapsed time, resume it,
then read back its recorded active duration; confirm the duration matches the sum of the active
intervals regardless of how long the pause lasted or whether the browser was closed in between.

**Acceptance Scenarios**:

1. **Given** a Work Item ready for production, **When** the operator starts its timer, **Then**
   the Work Item moves to `IN_PRODUCTION` and a phase-start timestamp is recorded.
2. **Given** a Work Item with a running timer, **When** the operator pauses it, **Then** the
   elapsed active duration up to that point is preserved and no further time accrues until
   resumed.
3. **Given** a Work Item with a paused timer, **When** the operator resumes it, **Then** timing
   continues accruing from the resume point, and the total active duration is always
   re-derivable from the stored timestamps alone.

---

### User Story 4 - Operator completes production with a produced quantity (Priority: P1)

An operator finishes a production run, records the quantity actually produced and any production
notes, and completes the Work Item, which moves it to `PRODUCTION_COMPLETED`, stops its timer,
stamps the completion time and the completing operator, and makes it appear in the
Collection/Print Reception queue for the next stage.

**Why this priority**: Completion is the payoff of the whole production phase and the handoff
point to collection (015); without it, work started in US3 never finishes (FR-006, FR-007).

**Independent Test**: Complete an in-production Work Item with a produced quantity and a note;
confirm it reaches `PRODUCTION_COMPLETED` with the completion timestamp and completing operator
recorded, its timer stops accruing, and it is now visible to a query scoped to the collection
queue.

**Acceptance Scenarios**:

1. **Given** a Work Item with a running or paused production timer, **When** the operator
   completes it with a produced quantity, **Then** the Work Item reaches `PRODUCTION_COMPLETED`,
   its timer stops accruing further duration, and the completion timestamp and completing
   operator are recorded.
2. **Given** a completed Work Item, **When** any user views the Collection/Print Reception queue,
   **Then** that Work Item appears there.
3. **Given** a completion form, **When** the operator submits without a produced quantity,
   **Then** the system rejects the submission with a validation error and the Work Item remains
   `IN_PRODUCTION`.

---

### User Story 5 - Operator sends a Work Item back to design (Priority: P2)

An operator who finds a production-blocking problem with a Work Item's design sends it back to
design with a required reason, using the same rejection/return mechanism the Head Designer uses
during review, tagged as originating from Production, so the designer and Head Designer see one
consistent rework history regardless of where a rejection came from.

**Why this priority**: Production-originated returns are a named requirement (PRD §16, and 013's
`createReturn` was explicitly built generic for this reuse) but are a secondary path compared to
the main forward flow (US1-US4).

**Independent Test**: Send a Work Item in production back to design with a reason; confirm a
Return record is created with its origin marked Production, the Work Item leaves the production
queue, and the assigned designer is notified.

**Acceptance Scenarios**:

1. **Given** a Work Item in production with a design defect the operator cannot work around,
   **When** the operator sends it back to design with a reason, **Then** a Return record is
   created with origin Production, the Work Item transitions out of the production queue, and the
   assigned designer is notified.
2. **Given** a send-back form, **When** the operator submits without a reason, **Then** the
   system rejects the submission and the Work Item stays in production.

---

### User Story 6 - Work Item routed to an external vendor department (Priority: P3)

For departments marked as external production, an operator (or whoever manages that department's
queue) records that a Work Item was sent to a named vendor on a given date, and later records that
it was received back from that vendor on a given date, before the normal completion flow
continues.

**Why this priority**: External production is a real but narrower operating mode (not every shop
uses outside vendors for every department), so it is additive to the core in-house flow rather
than a prerequisite for it.

**Independent Test**: Route a Work Item to a department flagged as external; record a "sent to
vendor" step with vendor name and date, then a "received from vendor" step with a date; confirm
both steps are stored and retrievable, and completion remains blocked until "received" is
recorded.

**Acceptance Scenarios**:

1. **Given** a Work Item routed to an external-production department, **When** the responsible
   user records it as sent to a named vendor, **Then** the vendor name and send date are stored
   against that Work Item.
2. **Given** a Work Item already sent to a vendor, **When** the responsible user records it as
   received back, **Then** the receipt date is stored and the Work Item becomes eligible for the
   normal completion flow (US4).
3. **Given** a Work Item sent to a vendor but not yet received, **When** anyone attempts to
   complete it, **Then** the system refuses completion until the receipt step is recorded.

---

### User Story 7 - Operator is alerted to a revised approved file mid-production (Priority: P2)

While a Work Item is in production, if the Head Designer approves a newer design version (for
example after a customer-requested change processed through 016), the assigned operator is
notified and must explicitly acknowledge the new file before their production timer can continue
running, so nobody keeps producing against a file that has since been superseded.

**Why this priority**: This is a safety-net requirement (PRD's revised-file alert) that prevents a
costly failure mode — producing against a stale file — but depends on production already being
underway (US3), so it is ordered after the core timing/completion flow.

**Independent Test**: Start production on a Work Item, then approve a new design version for the
same Work Item; confirm the operator's queue/job card shows an unacknowledged-revision state and
the running timer cannot continue accruing until the operator acknowledges the new version.

**Acceptance Scenarios**:

1. **Given** a Work Item in production, **When** a newer design version is approved for it,
   **Then** the assigned operator sees a revised-file alert on that Work Item's job card.
2. **Given** an unacknowledged revised-file alert, **When** the operator attempts to resume or
   continue the production timer, **Then** the system blocks further timing until the operator
   acknowledges the new file.
3. **Given** the operator acknowledges the revised file, **When** they resume the timer,
   **Then** timing continues normally and the alert no longer blocks them.

---

### Edge Cases

- What happens when a Work Item's default department (from its Product Type) is changed by the
  Head Designer or Reception before production starts? The Work Item routes to the newly chosen
  department, not the Product Type's default, once changed.
- What happens when an operator belongs to more than one department? Their queue shows the union
  of ready Work Items across every department they belong to, still urgent-first then oldest
  overall (not grouped and re-sorted per department).
- What happens if a Work Item is sent back to design (US5) while its production timer is running?
  The timer stops accruing at the moment of the send-back, same as completion — its recorded
  active duration up to that point is preserved and not discarded.
- What happens if two operators in the same department both try to start the same Work Item's
  timer at once? The first start wins; the second attempt is refused, since a Work Item has at
  most one open production phase at a time (mirrors 012's single-open-timer rule for design).
- What happens to a Work Item's revised-file acknowledgment (US7) if it is sent back to design
  before being acknowledged? The unacknowledged state is irrelevant once the Work Item leaves
  production; it is not carried forward if the item re-enters production later — a fresh
  acknowledgment is required only if another revision lands while back in production.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST route each approved Work Item to a production department, defaulting to
  its Product Type's configured default department, with Head Designer or Reception able to
  change that department before production starts.
- **FR-002**: Departments MUST be read as existing configured data (from 001), never as a
  hard-coded set of department names.
- **FR-003**: System MUST scope each operator's production queue to only the departments they
  belong to, enforced both in the query that builds the queue and as an explicit authorization
  check on any direct request for a specific Work Item's job card.
- **FR-004**: System MUST offer only the Approved (or later Production-stage) file version for
  download from a job card; unapproved draft versions MUST NOT be downloadable from this screen.
- **FR-005**: System MUST let an operator start, pause, and resume a Work Item's production timer,
  moving it to `IN_PRODUCTION` on start, with every duration re-derivable from persisted
  start/pause/resume timestamps rather than a live client-side counter (mirrors 012's
  `PhaseTiming` module).
- **FR-006**: System MUST require a produced quantity when an operator completes a Work Item's
  production, rejecting completion attempts that omit it.
- **FR-007**: System MUST, on completion, transition the Work Item to `PRODUCTION_COMPLETED`, stop
  its production timer from accruing further, and record the completion timestamp and the
  completing operator.
- **FR-008**: A completed Work Item MUST become visible to the Collection/Print Reception queue
  (015) immediately upon completion.
- **FR-009**: System MUST let an operator send a Work Item back to design with a required reason,
  creating a Return record whose origin is Production, using the same mechanism 013 built for
  Head Designer rejections.
- **FR-010**: A send-back-to-design action MUST stop the Work Item's production timer at that
  moment and remove it from the production queue, notifying the assigned designer.
- **FR-011**: Operators MUST NOT be able to change a Work Item's customer, specification, pricing,
  finance, or design history from any production screen.
- **FR-012**: For departments flagged as external production, system MUST let a responsible user
  record a "sent to vendor" step (vendor name, date) and a later "received from vendor" step
  (date), and MUST block completion of that Work Item until the "received" step is recorded.
- **FR-013**: System MUST notify the assigned operator when a newer design version is approved for
  a Work Item currently in production, and MUST block that Work Item's timer from resuming until
  the operator explicitly acknowledges the new version.
- **FR-014**: System MUST provide a department workload query exposing, per department, its
  current ready-for-production and in-production counts, for later consumption by the management
  dashboard (090).

### Key Entities

- **Department** (existing, 001): the routing target for a Work Item's production stage; carries
  whether it represents external (vendor) production. No new fields required beyond what 001
  already models, unless plan.md finds a gap during design.
- **Work Item** (existing, 002/011/012/013): gains production-stage state (`IN_PRODUCTION`,
  `PRODUCTION_COMPLETED`), a produced-quantity value, and production notes recorded at completion.
- **Production Phase Timing** (reuses 002's `PhaseTiming` module, same pattern as 012's design
  timing): start/pause/resume/stop timestamps for a Work Item's production phase.
- **Vendor Production Record**: for external-department Work Items, the vendor name, sent date,
  and received date associated with a specific production run.
- **Return** (existing, 013): reused unmodified; a Production-originated send-back is simply a
  `Return` whose origin department is the operator's own department.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can find and open a job card for a Work Item in their department in
  under 10 seconds from opening their queue.
- **SC-002**: 100% of file downloads from a job card are the Approved or Production-stage version
  — zero draft-version downloads are possible through this screen.
- **SC-003**: Every completed Work Item's recorded production duration is reproducible byte-for-
  byte from its persisted timestamps alone, with no reliance on any in-memory or client-side
  timer state.
- **SC-004**: 100% of Work Items completed without a produced quantity are rejected at submission,
  never persisted with a missing value.
- **SC-005**: A Work Item routed to a department an operator does not belong to is unreachable by
  that operator through the UI or a direct request, 100% of the time.
- **SC-006**: An operator with an unacknowledged revised-file alert cannot resume production timing
  on that Work Item until they acknowledge it, 100% of the time.

## Assumptions

- Production department membership for an operator is the same `User`-to-`Department` membership
  model 001 already provides (the same one 012 uses for designer-department scoping), not a new
  membership concept.
- "Approved (or later Production-stage) file version" means: the version 013 marked approved, or
  — once 016 exists — whatever later version change-control designates as the current
  production-authoritative one; this feature does not itself define change control, only respects
  013's `approvedAt`/`approvedById` marker as the gate for what is downloadable today.
- A Work Item has at most one open (non-completed, non-sent-back) production phase at a time,
  mirroring 012's single-open-design-timer rule; a second operator cannot start a timer already
  running for the same Work Item.
- External-vendor departments are a boolean flag on the existing `Department` model (or an
  equivalent existing marker), not a new department type hierarchy — plan.md finalizes the exact
  shape.
- Machines/equipment within a department (e.g., "Banner printer 1" vs. "2") are out of scope for
  this feature's V1; a Work Item routes to a department, not to a specific machine. This can be
  revisited as a Phase 2 addition without changing this feature's core contracts.
- One Work Item routes to exactly one production department per production cycle in V1; a
  multi-department sequence (e.g., Digital print then Laser cut) is out of scope for this feature
  and is not modeled here — if a shop-floor process genuinely needs two departments in sequence
  today, it is represented as two separate Work Items (one per department) at Order-authoring
  time, not as a single Work Item passing through two departments.
- Quantity/damage/waste verification, changing a Work Item's specification, and production cost
  tracking are explicitly out of scope (owned by 015, 016, and 052 respectively); this feature
  only records the produced quantity the operator reports, without verifying it against what was
  ordered.
