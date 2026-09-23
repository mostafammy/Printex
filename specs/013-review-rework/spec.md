# Feature Specification: Head Designer Review & Rework Loop

**Feature Branch**: `013-review-rework`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Head Designer quality gate and rework loop — review queue, approve/reject with categorized reasons, version timeline, generic Return record, rework counter, self-review guard"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Head Designer reviews the queue (Priority: P1)

A Head Designer opens their review queue and sees every Work Item currently waiting on their
decision, with urgent items surfaced first and each item's wait time visible, so they can decide
what to look at next without hunting through the whole order list.

**Why this priority**: Without a queue, nothing else in this feature has a starting point — it is
the entry door to every other capability here.

**Independent Test**: Seed several Work Items in `WAITING_REVIEW` with varying priority and age;
confirm the queue lists exactly those items, urgent-first, oldest-first within each priority
bucket, and that a Work Item in any other state does not appear.

**Acceptance Scenarios**:

1. **Given** three Work Items in `WAITING_REVIEW` (one urgent, two normal at different ages),
   **When** the Head Designer opens the review queue, **Then** the urgent item appears first,
   followed by the two normal items oldest-first.
2. **Given** a Work Item not in `WAITING_REVIEW`, **When** the Head Designer opens the review
   queue, **Then** that Work Item does not appear.

---

### User Story 2 - Head Designer reviews and approves a design (Priority: P1)

A Head Designer opens a specific Work Item's review screen, sees the latest uploaded design
version alongside prior versions, the order's full specification (dimensions, quantity, material)
and any customer notes, and approves it — moving the Work Item forward so production can start
without waiting on pricing to finish separately.

**Why this priority**: Approval is the "happy path" gate every reviewable Work Item must pass
through; it has to exist before rejection (which is the same screen's other outcome) is
meaningful.

**Independent Test**: Seed a Work Item in `WAITING_REVIEW` with one uploaded design version and a
full order specification; approve it as a Head Designer and confirm the version is marked
approved, the Work Item moves to `APPROVED` and then `READY_FOR_PRODUCTION`, and an audit event is
recorded.

**Acceptance Scenarios**:

1. **Given** a Work Item in `WAITING_REVIEW` with one design version, **When** the Head Designer
   opens its review screen, **Then** they see that version's preview, the order's dimensions,
   quantity, and material, and any customer notes attached to the order.
2. **Given** a Work Item in `WAITING_REVIEW` with two design versions, **When** the Head Designer
   opens its review screen, **Then** the latest version is shown as current and the earlier
   version is listed as prior history, not as the one under review.
3. **Given** a Work Item in `WAITING_REVIEW`, **When** the Head Designer approves it, **Then** the
   approved version is marked approved, the Work Item reaches `READY_FOR_PRODUCTION`, and this
   happens whether or not the Work Item's pricing has been resolved yet.
4. **Given** a Work Item whose current design version was uploaded by the Head Designer
   themself acting as its assigned designer, **When** they attempt to approve it, **Then** the
   system rejects the action as a guard failure and the Work Item does not move.

---

### User Story 3 - Head Designer rejects a design with a categorized reason (Priority: P1)

A Head Designer rejects a design that is not ready, recording a required category (Design,
Dimension, Customer change, Pricing, Accounting, Production, Missing information, Other), the
department the problem originated in, and a required explanation, plus an optional note, voice
note, image, or file — and the assigned designer is notified immediately with a direct link back
to the rejection.

**Why this priority**: Rejection with a durable, categorized reason is the other half of the core
gate and the origin of the rework loop and quality reporting; it must exist alongside approval to
make the review step meaningful, and it feeds every later user story in this feature.

**Independent Test**: Reject a Work Item in `WAITING_REVIEW` supplying a category, origin
department, and explanation; confirm the Work Item moves to `REWORK_REQUIRED`, the rejection
record is created and permanently retrievable, and the assigned designer receives a notification
in the same transaction as the rejection.

**Acceptance Scenarios**:

1. **Given** a Work Item in `WAITING_REVIEW`, **When** the Head Designer rejects it with a
   category, origin department, and explanation, **Then** the Work Item moves to
   `REWORK_REQUIRED`, a rejection record with all four required fields is stored, and it remains
   retrievable afterward with no way to edit or delete it.
2. **Given** a rejection in progress, **When** the Head Designer submits without a category or
   without an explanation, **Then** the system rejects the submission with a validation error and
   the Work Item does not move.
3. **Given** a Work Item assigned to a specific designer, **When** the Head Designer rejects that
   Work Item, **Then** the assigned designer receives a notification deep-linked to the rejection,
   created in the same transaction as the rejection itself.
4. **Given** a rejection form, **When** the Head Designer attaches an optional voice note, image,
   or file alongside the required category and explanation, **Then** all attachments are stored
   and associated with that specific rejection.
5. **Given** a Work Item marked urgent and currently in `WAITING_REVIEW`, **When** the Head
   Designer reviews it, **Then** it still requires an explicit approve or reject decision — urgency
   does not let it skip to production or advance on its own.

---

### User Story 4 - Anyone views a Work Item's full version and decision timeline (Priority: P2)

A user with access to a Work Item can see its complete history of design versions in order, with
each version's outcome (approved or the rejection that superseded it), who made that decision, and
why — so the story of how a design reached its current state is never lost.

**Why this priority**: This is what makes the review/rework loop trustworthy and auditable after
the fact; it depends on User Stories 2 and 3 existing first to have any decisions to display, but
does not block them.

**Independent Test**: Seed a Work Item with three versions (v1 rejected, v2 rejected, v3
approved); view its timeline and confirm all three versions appear in order with their respective
reviewer, decision, and reason (where applicable), and that the approved version is marked
immutable.

**Acceptance Scenarios**:

1. **Given** a Work Item with versions v1 (rejected), v2 (rejected), v3 (approved), **When** a
   user views its timeline, **Then** all three versions are listed in order with each one's
   decision, the reviewer who made it, and the reason where the decision was a rejection.
2. **Given** a version marked approved, **When** any user attempts to upload a replacement for
   that same version number, **Then** the system prevents it — approved versions cannot be
   superseded in place, only followed by a new version.

---

### User Story 5 - Rework counter and repeated-rejection visibility (Priority: P3)

Anyone looking at a Work Item or its order can see how many times it has been sent back for
rework, so a pattern of repeated problems on the same job is visible at a glance rather than
requiring someone to read the whole timeline.

**Why this priority**: This is a visibility/reporting convenience layered on top of the rejection
history already captured by User Story 3; valuable for spotting problem jobs early, but the
underlying data already exists without it.

**Independent Test**: Reject the same Work Item three times across separate review cycles; confirm
its rework counter reads 3 and is visible wherever the Work Item's summary is shown.

**Acceptance Scenarios**:

1. **Given** a Work Item that has been rejected twice and is now in its third review cycle,
   **When** its rework counter is viewed, **Then** it reads 2 (reflecting completed rejection
   cycles so far).
2. **Given** a Work Item rejected a third time, **When** the counter is checked afterward, **Then**
   it reads 3.

---

### User Story 6 - Production and Pricing can also send work back via the same Return mechanism (Priority: P3)

When Production (014) or Pricing (051) needs to send a job back for a reason unrelated to design
review — such as a production discrepancy or a pricing question — they use the same underlying
Return record shape (raised-by, origin department, category, assigned-to, notes, attachments) that
this feature defines, so the shop has one consistent "send this back" concept instead of a
separate one per department.

**Why this priority**: This feature is what defines and first uses the Return record; other
features (014, 051) are expected to consume it later. It is lower priority here because nothing in
013 itself requires another department to have already integrated — it only requires the shape to
be right and reusable.

**Independent Test**: Confirm a Return record created by this feature's own rejection flow (User
Story 3) contains no review-specific fields that a Production- or Pricing-originated Return
could not equally populate (i.e., the shape is generic, not Review-only).

**Acceptance Scenarios**:

1. **Given** the Return record shape defined by this feature, **When** it is inspected for fields
   specific to design review only, **Then** none are found — every field (raised-by, origin
   department, category, assigned-to, notes, attachments) applies equally to a return raised by
   any department.

---

### Edge Cases

- A Work Item's `requiresReview` flag is false: it MUST NOT appear in the review queue and MUST
  bypass this feature's gate entirely (handled by the existing `DESIGN_COMPLETED → APPROVED` edge
  from feature 011/002; out of scope here beyond not blocking it).
- Two design versions uploaded in quick succession before either is reviewed: the review screen
  MUST always show the most recently uploaded version as current.
- A rejection is submitted with an origin department that does not match any configured
  department: the system MUST reject the submission (origin department must be one of the
  Admin-configured departments, constitution VI).
- The Head Designer role holder is also the Work Item's assigned designer (the same person
  designed and would review): the self-review guard MUST block approval regardless of whether the
  reviewer holds `design.review`, `design.work`, or both.
- A voice note recording is abandoned partway through: no attachment MUST be created, and the
  rejection MUST still be submittable using only the required category and explanation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a review queue showing every Work Item in `WAITING_REVIEW`,
  ordered urgent-first, then oldest-first by the time each entered `WAITING_REVIEW`.
- **FR-002**: System MUST NOT include a Work Item in the review queue once it has left
  `WAITING_REVIEW` (approved, rejected, or cancelled).
- **FR-003**: The review screen for a Work Item MUST show its current (latest) design version's
  preview, all prior versions, the order's specification (dimensions, quantity, material), and any
  customer notes recorded on the order.
- **FR-004**: System MUST allow a Head Designer to approve a Work Item in `WAITING_REVIEW`, which
  marks the current design version as approved and advances the Work Item toward
  `READY_FOR_PRODUCTION`, independent of whether pricing has been resolved.
- **FR-005**: System MUST prevent the reviewer from approving a Work Item if the reviewer is also
  the designer who uploaded the version under review, rejecting the attempt as a guard failure
  with no state change.
- **FR-006**: System MUST allow a Head Designer to reject a Work Item in `WAITING_REVIEW`, moving
  it to `REWORK_REQUIRED`.
- **FR-007**: A rejection MUST require a category (one of: Design, Dimension, Customer change,
  Pricing, Accounting, Production, Missing information, Other), an origin department, and a
  written explanation; the system MUST reject a submission missing any of these three with a
  validation error and no state change.
- **FR-008**: A rejection MAY additionally include a free-text note, a voice note, an image, or a
  file attachment, none of which are required.
- **FR-009**: System MUST notify the Work Item's assigned designer immediately upon rejection, in
  the same transaction as the rejection itself, with the notification linking directly to that
  rejection's detail.
- **FR-010**: System MUST persist every rejection permanently as part of the Work Item's history;
  no application code path may edit or delete a rejection once recorded.
- **FR-011**: System MUST record every design version's outcome (approved, or superseded by a
  specific rejection) and present the full sequence of versions with their outcomes, reviewers,
  and reasons as a single timeline for that Work Item.
- **FR-012**: System MUST prevent an approved design version from being replaced or overwritten in
  place; a subsequent change MUST create a new version.
- **FR-013**: System MUST maintain a count of completed rejection cycles per Work Item and make it
  visible alongside that Work Item's summary information.
- **FR-014**: System MUST provide a generic Return record (raised-by, origin department, category,
  assigned-to, notes, attachments) usable by this feature's own rejection flow and reusable
  without modification by other features that need to send work back for a non-review reason.
- **FR-015**: System MUST require every state transition this feature performs (approve, reject)
  to go through the existing centralized Work Item transition mechanism, validating the
  `WAITING_REVIEW → APPROVED` and `WAITING_REVIEW → REWORK_REQUIRED` edges and writing the
  associated audit event in the same transaction as the transition.
- **FR-016**: System MUST NOT allow urgent priority to skip the review step; an urgent Work Item in
  `WAITING_REVIEW` requires the same explicit approve/reject decision as any other.
- **FR-017**: System MUST authorize both approval and rejection against the reviewer's permission
  to review designs, independent of any permission the same actor might hold to perform design
  work.

### Key Entities *(include if feature involves data)*

- **Return**: A generic "sent back" record — raised-by (actor), origin department, category,
  assigned-to, an explanation, an optional note, and zero or more attachments (voice note, image,
  file). A rejection in this feature creates one Return record; other features (014, 051) create
  their own Return records via the same shape when sending work back for non-review reasons.
- **DesignVersionReview**: The outcome recorded against a specific design version — approved, or
  rejected referencing the Return record that explains why; includes the reviewer and timestamp.
- **Work Item** (existing, extended): gains a rework counter (count of completed rejection cycles)
  and a `requiresReview` flag it already carries from 011/002, which this feature reads but does
  not define.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Head Designer can find, review, and decide (approve or reject) on any Work Item in
  their queue without navigating outside the review screen for specification or version history.
- **SC-002**: 100% of rejections recorded by the system include a category, origin department, and
  explanation — submissions missing any of the three are never persisted.
- **SC-003**: The assigned designer is notified of a rejection within the same operation that
  records it — no rejection exists without a corresponding notification having been created.
- **SC-004**: A Work Item's full version and decision history is reconstructable from stored data
  alone (no version's outcome or reasoning is ever lost or overwritten).
- **SC-005**: A Designer can never successfully approve their own submitted design version — 100%
  of self-review attempts are blocked before any state change occurs.
- **SC-006**: Users reviewing a Work Item's rework count can determine, without reading the full
  timeline, whether that job has been sent back 0, 1, or multiple times.

## Assumptions

- Customer approval of a design over WhatsApp (external communication) is out of scope for this
  feature; feature 054 is responsible for notifying the customer once a design is approved, and
  capturing any customer reply is not part of V1 unless a future feature adds it.
- Changing the underlying order specification (dimensions, quantity, material, etc.) is out of
  scope; that belongs to feature 016 (change control). This feature only reads the specification
  to display it during review.
- File storage, versioning mechanics, and attachment storage are provided by feature 050 and are
  consumed here, not re-implemented.
- The Head Designer role and the Designer role are distinct permission scopes (`design.review` and
  `design.work` respectively, already seeded per 001); a single person MAY hold both, and the
  self-review guard is what prevents that dual-permission holder from reviewing their own work,
  not a restriction on holding both permissions.
- A design version becoming reviewable (entering `WAITING_REVIEW`) and the review screen's design
  of "latest version is current, others are history" both depend on version upload already
  existing (feature 012, `uploadDesignVersion`) and are exercised, not redefined, here.
- No maximum voice note length is enforced by this feature at the specification level; the
  underlying file/attachment storage's existing size limits (feature 050) apply uniformly, and no
  review-specific limit is introduced.
