# Feature Specification: Order Change Control

**Feature Branch**: `016-change-control`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Nobody silently rewrites what production was told to make (real
incident: a customer changed quantities and the old quantities were lost). Every Work Item
specification is versioned (v1 original, v2, …) and old versions stay readable forever; edits are
state-aware (before production: direct audited edit; production started: only via a Change
Request; production completed: Admin action only, with reason); a customer change request flows
original spec → change request recorded by reception → approval/confirmation → revised spec → new
production instruction; an approved change notifies design/production, can send the job back to
design with category Customer change, and resets pricing to pending via an event the pricing
feature listens to; late cancellation needs a reason and records the cost incurred; an audited
Admin override exists; a diff shows exactly what changed between two versions (e.g. quantity
500 → 800)." PRD §46, §47, §55 (Rules 3, 8, 11), §38, §45; constitution III.

## Clarifications

### Session 2026-09-24

The owner was not available to answer. Each answer below is an **ASSUMPTION — pending owner
confirmation**: the option judged best for a small print shop, with the rejected alternatives on
the line after it. Nothing downstream should be treated as final until the owner confirms these.

- Q: Who confirms (approves) a customer change request on a Work Item already in production? →
  A: A holder of a new `change.approve` permission, seeded to Head Designer and Admin/Owner.
  Reception records the request but cannot approve it (CONFIRMED by owner 2026-09-24).
  - Rejected: Reception confirms its own request (no second person checks it, and the original
    incident was an unchecked verbal change taken at reception); Owner only (a bottleneck in a
    small shop, and the Owner still gets approval through the Admin/Owner seed); Production
    Operator (014 FR-011 forbids operators from changing a specification); reusing the existing
    `design.review` permission (ties "approve changes" to "review designs" permanently, so a shop
    that wants owner-only approval would also have to take design review away from the Head
    Designer).
- Q: Can new Work Items be added to an order that already has Work Items in production? → A: Yes.
  This matches 011's clarified FR-011b ("anytime the order isn't fully finished"). The new item
  starts at `NEW` with its own v1 specification. It needs no change request, because it changes
  no existing production instruction (ASSUMPTION — pending owner confirmation; restates 011's
  existing clarification, no behavior change).
  - Rejected: forbidding additions once any sibling is in production (forces a second order for
    the same customer package, which breaks grouped mode, PRD §4.3); routing additions through a
    change request (friction with no protective value, since nothing already in production
    changes).
- Q: Does production pause automatically while a change request is pending? → A: Yes, the Work
  Item is frozen. Recording the request pauses a running production timer at once. Until the
  request is decided, nobody can resume, complete, or send back that Work Item. If the request is
  approved with "continue production", the operator must also acknowledge the revised
  instruction before resuming. This matches the client-confirmed "freeze the job on machine floor
  screens" journey (Printex.md Journey 5) (CONFIRMED by owner 2026-09-24).
  - Rejected: no pause, operator only notified (the operator can keep running obsolete plates,
    which is the exact failure being prevented); pause but still allow completion (a job could be
    completed against the superseded spec); a manual hold toggle (relies on someone remembering
    to press it).
- Q: Where does "before production" end for the edit policy? → A: At `IN_PRODUCTION`. Every state
  before it (`NEW` through `READY_FOR_PRODUCTION`) allows a direct, audited edit, and any state
  where an approved design already exists requires an explicit "redesign or keep design" choice
  (ASSUMPTION — pending owner confirmation).
  - Rejected: requiring a change request from `APPROVED` onward (heavier process for jobs nobody
    has started making); keeping 011's narrower `NEW`/`ASSIGNED` window (leaves no sanctioned way
    to correct a spec during design, so staff would work around the system).
- Q: When approving a change during production, who decides whether the job goes back to design?
  → A: The approver chooses explicitly: "continue production with the revised spec" or "send back
  to design". There is no default (ASSUMPTION — pending owner confirmation).
  - Rejected: always sending back to design (wasteful for quantity-only changes, which are the
    incident case); the system deciding from which fields changed (hidden rule, and some material
    changes need redesign while others do not).
- Q: Who records the cost of a late cancellation, and is it mandatory? → A: Whoever performs the
  cancellation must enter the cost incurred so far (zero is allowed, and it must be entered
  explicitly), in EGP as an exact decimal, with an optional note and produced-so-far quantity.
  Finance (052) may later adjust it in its own records (ASSUMPTION — pending owner confirmation).
  - Rejected: cost optional (cost silently lost, contrary to Printex.md Journey 5 "cancelled items
    maintain their accrued scrap material costs"); cost entered only later by Accounting (a
    second, easily forgotten step).
- Q: Is the due date part of the versioned specification? → A: No. The specification is what to
  make (product type, description, quantity, dimensions and unit, material, finish notes). A due
  date change stays an ordinary audited edit (011's existing `workitem.edited` audit event) and
  never triggers a change request (ASSUMPTION — pending owner confirmation).
  - Rejected: versioning due date too (a reschedule would reset pricing and freeze production for
    no reason).
- Q: Can the Admin override apply while a Work Item is in production, or only after completion? →
  A: In any non-cancelled state, always with a reason. During production it behaves like a change
  request that is recorded and approved in one step, so production is still frozen until the
  operator acknowledges, pricing still resets, and design is still notified (ASSUMPTION — pending
  owner confirmation).
  - Rejected: post-completion only (leaves the owner no way to act on an urgent phone change at
    once); an override that skips the downstream effects (constitution II: an override is an
    audited action, not a bypass of consequences).
- Q: How are existing Work Items (created before this feature) given a version history? → A: One
  v1 per existing Work Item, copied from its current values and marked "backfilled" with no
  author. Any pre-016 edits stay readable in the audit log (they are not lost). They are not
  rebuilt as fake versions (ASSUMPTION — pending owner confirmation).
  - Rejected: rebuilding a v1…vN chain from `workitem.edited` audit events (those events store
    only the patched keys, and quick-create items have a different audit shape, so the rebuilt
    versions would contain guessed values and guessed authors).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The original specification is never lost (Priority: P1) 🎯 MVP

When reception creates a Work Item (quick create, full create, or adding an item to an existing
order), its specification is saved as version 1. Every later accepted change saves a new numbered
version (v2, v3, …). The Work Item always shows the current version, and every earlier version,
including the original, can be opened at any time, with who made it, when, why, and what state
the job was in.

**Why this priority**: This is the incident fix. Nothing else in this feature (policy, change
requests, diff) means anything without a permanent, numbered record of every specification. It
also directly satisfies constitution III ("The original specification MUST remain retrievable")
and PRD §47 ("The original instruction must remain accessible").

**Independent Test**: Create an order with one Work Item of quantity 500. Confirm version 1 exists
with quantity 500. Apply one permitted edit to quantity 800. Confirm version 2 exists with 800,
the Work Item shows 800, and version 1 still reads 500. Separately, run the backfill against a
pre-existing Work Item and confirm it gets exactly one version 1 marked backfilled.

**Acceptance Scenarios**:

1. **Given** reception creates an order with a Work Item of quantity 500, **When** the order is
   saved, **Then** the Work Item has exactly one specification version (v1, origin Initial,
   quantity 500) and it is the current one.
2. **Given** a Work Item at v1, **When** a permitted change sets quantity to 800, **Then** v2
   exists with quantity 800 and is current, v1 is unchanged, and both are listed in the
   specification history with author, time, origin, and the Work Item state at the time.
3. **Given** a Work Item created before this feature existed, **When** the backfill runs,
   **Then** it gets exactly one v1 copied from its current values, marked Backfilled with no
   author, and running the backfill again creates nothing new.
4. **Given** any specification version, **When** anyone tries to change or delete it, **Then** no
   application path allows it (versions are append-only).

---

### User Story 2 - Edits are allowed or refused according to where the job is (Priority: P1)

Reception can edit a Work Item's specification directly while it has not entered production. Each
edit is audited and creates a new version. If the Work Item already has an approved design,
reception must choose "send back to design" or "keep the approved design". Once production has
started, a direct edit is refused and a change request is required. Once production is complete,
only an Admin can change it. A cancelled Work Item cannot be changed at all. The server enforces
this whatever the screen shows.

**Why this priority**: The policy is the gate itself (PRD §46, constitution II/III). Without
server-side refusal, versioning only records silent rewrites and does not stop them.

**Independent Test**: For each Work Item state, attempt a direct edit through the server entry
point. Confirm it succeeds (and creates a version) exactly for `NEW` through
`READY_FOR_PRODUCTION`, is refused with "change request required" for `IN_PRODUCTION`, is refused
with "admin action required" for `PRODUCTION_COMPLETED` through `COMPLETED`, and is refused for
`CANCELLED`.

**Acceptance Scenarios**:

1. **Given** a Work Item in `NEW`, `ASSIGNED`, `IN_DESIGN`, `WAITING_REVIEW`, or
   `REWORK_REQUIRED`, **When** reception edits its quantity, **Then** a new version is created,
   the edit is audited with before/after values, and the assigned designer (if any) is notified
   of a customer modification.
2. **Given** a Work Item in `APPROVED`, `WAITING_PRICING`, or `READY_FOR_PRODUCTION` that required
   design, **When** reception edits it and chooses "send back to design", **Then** a new version is
   created, the Work Item moves to `REWORK_REQUIRED` with a Return of category Customer change,
   and the designer is notified. If reception chooses "keep design" instead, the version is
   created with no state change.
3. **Given** a Work Item in `IN_PRODUCTION`, **When** anyone calls the direct edit (from any
   screen or directly against the server), **Then** it is refused server-side with "change
   request required", and no version, audit edit, or field change is written.
4. **Given** a Work Item in `PRODUCTION_COMPLETED`, `READY_FOR_COLLECTION`, `DELIVERED`, or
   `COMPLETED`, **When** reception attempts a direct edit, **Then** it is refused with "admin
   action required".
5. **Given** a user without the order-edit permission, **When** they attempt a direct edit in any
   state, **Then** it is refused as forbidden.
6. **Given** two people editing the same Work Item from the same version, **When** both submit,
   **Then** the first succeeds and the second is refused as stale (it must reload and redo the
   edit against the new current version). No edit is silently overwritten.

---

### User Story 3 - A customer changes their mind during production (Priority: P1)

A customer calls while their job is being printed and asks to change 500 to 800. Reception records
a change request with the proposed values and the customer's reason. The job freezes at once on
the production floor: a running timer pauses, and nobody can resume, complete, or send it back.
The operator and the approvers are notified. A Head Designer (or Admin) opens the request, sees
exactly what would change, and either rejects it (with a reason) or approves it, choosing
"continue production with the revised spec" or "send back to design". If approved, the revised
specification becomes a new version and the new production instruction. The operator must
acknowledge it before resuming, or the job goes back to design with a Customer change return.

**Why this priority**: This is PRD §47's exact flow (original spec → customer change request →
approval/confirmation → revised spec → new production instruction). It is also the incident this
feature exists to prevent.

**Independent Test**: Start production on a Work Item at v1 (quantity 500). Record a change request
to 800. Confirm the timer paused and resume and completion are refused. Approve with "continue
production". Confirm v2 (800) is current, v1 (500) is still readable, resume is refused until the
operator acknowledges, and after acknowledging, resume and completion work. Repeat with "send back
to design" and confirm the Work Item is `REWORK_REQUIRED` with a Customer change return.

**Acceptance Scenarios**:

1. **Given** a Work Item in `IN_PRODUCTION` with a running timer, **When** reception records a
   change request (proposed quantity 800, reason "customer called"), **Then** the request is
   stored as pending against the current version, the running timer is paused, the production
   department and approvers are notified, and the step is audited.
2. **Given** a pending change request, **When** the operator tries to resume, complete, or send
   the Work Item back to design, **Then** each attempt is refused with "change pending".
3. **Given** a pending change request, **When** a second change request is recorded for the same
   Work Item, **Then** it is refused (only one open request per Work Item).
4. **Given** a pending change request, **When** an approver approves it with "continue
   production", **Then** a new version (v2, quantity 800) becomes current and is linked to the
   request, v1 remains viewable with a diff showing "quantity 500 → 800", the Work Item stays
   `IN_PRODUCTION`, and the operator must acknowledge the revised instruction before resuming or
   completing.
5. **Given** a pending change request on a Work Item that required design, **When** an approver
   approves it with "send back to design", **Then** a new version becomes current, the Work Item
   moves to `REWORK_REQUIRED` with rejection category Customer change and a Return record whose
   origin department is the Work Item's production department, and the assigned designer is
   notified.
6. **Given** a pending change request, **When** an approver rejects it with a reason (or reception
   withdraws it because the customer retracted), **Then** no new version is created, the freeze
   lifts at once (no acknowledgment needed, since nothing changed), and the requester and
   production are notified.
7. **Given** a user holding only order-edit (reception), **When** they try to approve a change
   request, **Then** it is refused as forbidden. **Given** a production operator, **When** they
   try to record or approve a change request, **Then** both are refused.
8. **Given** a change request whose base version is no longer current (for example an Admin
   override landed in between), **When** an approver tries to approve it, **Then** it is refused
   as stale and must be rejected and re-recorded against the current version.

---

### User Story 4 - See exactly what changed (Priority: P1)

Anyone who can view the order can pick two versions of a Work Item's specification and see only
the fields that differ, each as "before → after" (e.g. "Quantity 500 → 800", "Material Vinyl →
Banner"). The same comparison appears on the change request screen (current version vs proposed)
and on the production job card (the version production started from vs the current one).

**Why this priority**: A version list alone does not answer "what did the customer change?"
quickly enough under time pressure (constitution IX). The acceptance criterion "v1 and v2 are both
viewable with a diff" depends on it.

**Independent Test**: Given v1 (quantity 500, material Vinyl) and v2 (quantity 800, material
Vinyl), confirm the comparison lists exactly one change, "Quantity 500 → 800", and nothing for
material. Comparing a version with itself lists no changes.

**Acceptance Scenarios**:

1. **Given** v1 and v2 of a Work Item that differ only in quantity, **When** a user compares them,
   **Then** exactly one change is shown: quantity 500 → 800.
2. **Given** two versions where a field went from empty to a value (e.g. finish notes added),
   **When** compared, **Then** the change shows "— → <value>".
3. **Given** dimensions stored as 1.50 and 1.5, **When** compared, **Then** no change is reported
   (numeric equality, not text equality).
4. **Given** a pending change request, **When** the approver opens it, **Then** they see the diff
   between the current version and the proposed values before deciding.
5. **Given** two versions belonging to different Work Items, **When** a comparison is requested,
   **Then** it is refused.

---

### User Story 5 - An approved change resets pricing and informs the right people (Priority: P2)

Whenever a new specification version is created after v1 (direct edit, approved change request,
or Admin override), the system announces "specification changed" in the same step. The pricing
feature (051) uses it to put an already-priced Work Item back to "pricing pending", so the
delivery gate cannot pass on a price for the old quantities. The assigned designer and the
production department get an internal notification.

**Why this priority**: This protects the pricing-before-delivery gate (constitution II, PRD §55
Rule 10) against stale prices. It is P2 only because the pricing feature (051) is not built yet:
016 provides the event and proves it fires atomically, and 051 supplies the reaction.

**Independent Test**: Register a test pricing listener that marks an item "pending" when told the
spec changed. Approve a change request on an item the listener considers priced, and confirm the
listener ran in the same transaction and the item is now pending. Make the listener fail, and
confirm the whole change (new version included) is rolled back.

**Acceptance Scenarios**:

1. **Given** a priced Work Item in production, **When** a change request on it is approved,
   **Then** its pricing status becomes pending (via the pricing feature's listener) in the same
   transaction as the new version.
2. **Given** any new version after v1, **When** it is created, **Then** exactly one "specification
   changed" event is emitted, carrying the Work Item, order, old and new version numbers, the
   changed fields, the origin, and the actor.
3. **Given** a pricing listener that fails, **When** a change is approved, **Then** nothing is
   committed (no new version, no state change, no audit) and the approver sees an error.
4. **Given** no pricing listener is registered (051 not yet installed), **When** a change is
   approved, **Then** the change succeeds normally.

---

### User Story 6 - Late cancellation records why and what it cost (Priority: P2)

A customer cancels a job after printing has started. Reception cancels it through the late
cancellation action, which requires a reason and the cost already incurred (paper, ink, vendor
charges; zero is allowed but must be entered explicitly), optionally with the quantity produced so
far. The cost is recorded permanently and handed to finance (052) as a direct cost of the order.
Ordinary cancellation is refused for any Work Item that production has already started.

**Why this priority**: This keeps late-cancellation losses traceable (PRD §30 "All cost inputs
must remain traceable to their source", Printex.md Journey 5). It is P2 because cancellation is
rarer than modification.

**Independent Test**: Late-cancel an `IN_PRODUCTION` Work Item with reason and cost 350.00.
Confirm it is `CANCELLED`, a late-cancellation record stores 350.00 EGP with the reason, the
finance hand-off was invoked, and the audit log has the event. Then try the ordinary cancel on
another `IN_PRODUCTION` item and confirm it is refused.

**Acceptance Scenarios**:

1. **Given** a Work Item in `IN_PRODUCTION`, `PRODUCTION_COMPLETED`, or `READY_FOR_COLLECTION`,
   **When** reception late-cancels it with a reason and cost 350.00, **Then** it becomes
   `CANCELLED`, its production timer stops, the cost and reason are stored, the finance hand-off
   receives the cost, and the event is audited.
2. **Given** a late-cancellation form, **When** submitted without a reason or without a cost (or
   with a negative cost), **Then** it is refused and the Work Item is unchanged.
3. **Given** a Work Item in production, **When** anyone uses the ordinary cancel (single item or
   whole order), **Then** that Work Item is not cancelled. The single-item cancel is refused with
   "late cancellation required", and the whole-order cancel lists it as needing late cancellation
   while still cancelling the order's pre-production items.
4. **Given** a Work Item with a pending change request, **When** it is late-cancelled, **Then** the
   pending request is closed as "closed by cancellation" in the same step.
5. **Given** a Work Item not yet in production, **When** it is late-cancelled, **Then** the action
   is refused (use the ordinary cancel instead).

---

### User Story 7 - The Admin can override, always with a reason (Priority: P3)

The Owner/Admin can change the specification of a Work Item in any non-cancelled state, including
after production is complete, by giving a reason. The previous version stays intact, the override
is clearly labeled as an Admin override in history and in the audit log, and during production
the same freeze-and-acknowledge, pricing-reset, and design-notification effects apply as for an
approved change request.

**Why this priority**: PRD §46 ("after production completion: explicit administrative action and
must preserve previous state") and constitution II (Admin overrides are explicit and audited)
require it. It is a rare, last-resort path, so it comes last.

**Independent Test**: As Admin, override quantity on a `DELIVERED` Work Item with a reason. Confirm
a new version labeled Admin override exists, the previous version is intact, and the audit event
carries the reason. As reception, attempt the same, and confirm it is refused.

**Acceptance Scenarios**:

1. **Given** a `PRODUCTION_COMPLETED` or `DELIVERED` Work Item, **When** an Admin overrides its
   quantity with a reason, **Then** a new version with origin Admin override is created, the prior
   version is unchanged, and the audit event records the reason.
2. **Given** an override form without a reason, **When** submitted, **Then** it is refused.
3. **Given** a user without the admin-override permission, **When** they attempt an override,
   **Then** it is refused as forbidden.
4. **Given** an `IN_PRODUCTION` Work Item with no pending request, **When** an Admin overrides it
   with "continue production", **Then** it is recorded as a change request approved in the same
   step, and the operator must acknowledge before resuming.
5. **Given** a Work Item with a pending change request, **When** an Admin attempts an override,
   **Then** it is refused until the pending request is decided.
6. **Given** a `CANCELLED` Work Item, **When** an Admin attempts an override, **Then** it is
   refused.

---

### Edge Cases

- **A Work Item without any version** (created by a test factory, missed by the backfill, or
  created by a path added later): the first edit or change request creates a backfilled v1 from
  its current values inside the same transaction, then proceeds. Reads show the current values
  with "no recorded history before this point".
- **A change request is recorded at nearly the same moment the operator completes the job**: the
  completion may win the race. Approving a request whose Work Item is no longer `IN_PRODUCTION` is
  refused ("job left production"). The request must be rejected, and any change must go through an
  Admin override. Both steps are audited, so nothing is silently lost.
- **A proposed change identical to the current values** (a no-op edit or request): refused with
  "no changes". No version is created.
- **Pending change request, then the operator sends the job back to design**: refused while the
  request is pending. The approver can choose "send back to design" as the outcome instead.
- **Approved "continue production" change not yet acknowledged, then the operator wants to send
  the job back to design**: refused until acknowledged, a single step. This way a pending
  acknowledgment never outlives the job's stay in production.
- **Work Item that does not require design (requiresDesign = false)**: "send back to design" is
  not offered and is refused server-side. Only "continue production" is valid.
- **Work Item with no effective production department when sent back to design pre-production**
  (possible before routing): the editor must pick the origin department explicitly, because the
  Return record requires one.
- **Edit while `WAITING_REVIEW`**: allowed as a direct edit. The designer and the Head Designer
  reviewers are notified, so no approval happens against an outdated spec unnoticed.
- **Whole-order cancel on a mixed order**: pre-production items are cancelled as before, and
  items already in production are left untouched and reported as needing late cancellation.
- **Late cancellation cost of zero**: allowed but must be entered explicitly (the field cannot be
  left blank).
- **A second approver opens the same request after it was decided**: approving or rejecting an
  already-decided request is refused ("already decided"). The first decision stands.
- **Two approved revisions before the operator acknowledges** (a second request is recorded and
  approved while the first approval is still unacknowledged): one acknowledgment covers both,
  because the operator confirms the current instruction, which supersedes the earlier one.
- **Due date change on an in-production Work Item**: not a specification change, so it is not
  frozen and not versioned, but it is still audited.

## Requirements *(mandatory)*

### Functional Requirements

**Versioning (US1)**

- **FR-001**: System MUST create specification version 1 for every new Work Item in the same
  transaction that creates the Work Item, on every creation path (quick create, full create,
  adding an item to an existing order).
- **FR-002**: A specification version MUST capture: product type, description, quantity, width,
  height, dimension unit, material, and finish notes. It MUST also record its sequential version
  number (1, 2, 3 … per Work Item, never reused), origin (Initial, Backfilled, Direct edit, Change
  request, Admin override), author (absent only for Backfilled), creation time, the Work Item's
  state at that time, and a reason where the origin requires one.
- **FR-003**: Each Work Item MUST point to exactly one current version. The specification values
  shown and used anywhere in the system (reception, design, review, production job card) MUST
  equal the current version's values.
- **FR-004**: Specification versions MUST be append-only. No application path may update or
  delete a version, and every version of a Work Item MUST stay readable for as long as the Work
  Item exists.
- **FR-005**: Existing Work Items MUST receive exactly one backfilled v1 copied from their current
  values. The backfill MUST be repeatable without creating duplicates. Pre-existing edit history
  MUST remain readable in the audit log. Any Work Item still lacking a version when it is next
  edited MUST get a backfilled v1 first, in the same transaction.

**Edit policy (US2)**

- **FR-006**: System MUST decide the permitted edit path from the Work Item's state alone:
  - `NEW`, `ASSIGNED`, `IN_DESIGN`, `DESIGN_COMPLETED`, `WAITING_REVIEW`, `REWORK_REQUIRED`,
    `APPROVED`, `WAITING_PRICING`, `READY_FOR_PRODUCTION` → direct edit;
  - `IN_PRODUCTION` → change request only;
  - `PRODUCTION_COMPLETED`, `READY_FOR_COLLECTION`, `DELIVERED`, `COMPLETED` → Admin override only;
  - `CANCELLED` → no change of any kind.
- **FR-007**: A direct edit MUST require the order-edit permission, MUST create a new version and
  an audit event with before/after values, MUST be refused when it changes nothing, and MUST be
  refused when the editor's version is no longer current (stale).
- **FR-008**: A direct edit on a Work Item with an assigned designer MUST notify that designer of a
  customer modification. While the Work Item is `WAITING_REVIEW`, it MUST also notify the users
  who can review designs.
- **FR-009**: A direct edit on a Work Item that requires design and is `APPROVED`,
  `WAITING_PRICING`, or `READY_FOR_PRODUCTION` MUST require an explicit choice between "send back
  to design" and "keep the approved design". "Send back to design" MUST move the Work Item to
  `REWORK_REQUIRED` with rejection category Customer change and create a Return record through
  013's shared return mechanism, notifying the designer.
- **FR-010**: The direct edit MUST be refused server-side, with a distinct reason for each case,
  for `IN_PRODUCTION` ("change request required"), for post-production states ("admin action
  required"), and for `CANCELLED`. The refusal MUST hold regardless of which screen or client
  made the call. The existing pre-design edit (011) MUST go through the same versioned path, so
  there is exactly one way a specification is written.

**Change requests (US3)**

- **FR-011**: Users with the order-edit permission MUST be able to record a change request only
  for a Work Item in `IN_PRODUCTION`, capturing proposed values, the customer's reason, the base
  (current) version, requester, and time. At most one change request per Work Item MAY be pending
  at a time.
- **FR-012**: While a change request is pending, the Work Item MUST be frozen: any running
  production timer is paused when the request is recorded, and resuming, completing, and sending
  back to design MUST be refused until the request is decided. The production department and the
  approvers MUST be notified when the request is recorded.
- **FR-013**: Approving or rejecting a change request MUST require the new `change.approve`
  permission, seeded by default to Head Designer and Admin/Owner and assignable like any other
  permission. Approval MUST record an explicit outcome ("continue production" or "send back to
  design"), MUST create the new version from the base version plus the proposed values, MUST link
  the request to that version, and MUST be refused when the base version is no longer current or
  the Work Item is no longer `IN_PRODUCTION`.
- **FR-014**: Approval with "continue production" MUST keep the Work Item `IN_PRODUCTION`, notify
  the production department of a revised production instruction, and keep it frozen until an
  operator of that department acknowledges the revised instruction.
- **FR-015**: Approval with "send back to design" MUST be allowed only for Work Items that require
  design and have an assigned designer. It MUST move the Work Item to `REWORK_REQUIRED` with
  rejection category Customer change, create a Return record (origin department = the Work
  Item's production department) through 013's shared return mechanism, stop the production
  timer, and notify the designer.
- **FR-016**: Rejecting (by an approver) or withdrawing (by the order-edit holder, when the customer
  retracts) MUST require a reason, MUST create no version, MUST lift the freeze at once, and MUST
  notify the requester and the production department.
- **FR-017**: System MUST give approvers a queue of pending change requests, urgent orders first
  and then oldest first, paginated.
- **FR-018**: Production operators MUST NOT be able to record, approve, reject, or withdraw change
  requests. They MAY only acknowledge revised instructions for departments they belong to
  (preserves 014 FR-011).

**Diff (US4)**

- **FR-019**: System MUST compare any two versions of the same Work Item and list only the fields
  whose values differ, each with its before and after value. Numeric values MUST compare by value
  (1.50 equals 1.5), and empty-to-value and value-to-empty changes MUST be shown. Comparing
  versions of different Work Items MUST be refused.
- **FR-020**: The comparison MUST be shown in the specification history, on the change request
  screen (current version vs proposed values), and on the production job card (version at
  production start vs current version).

**Downstream effects (US5)**

- **FR-021**: Every new version after v1 (direct edit, approved change request, Admin override)
  MUST emit exactly one "specification changed" event in the same transaction. The event carries
  Work Item, order, previous and new version numbers, changed fields, origin, and actor. It MUST
  reach both in-process listeners and the notification outbox.
- **FR-022**: A failure in any in-process listener MUST roll back the whole change: version,
  state change, return, audit, and notifications.
- **FR-023**: The pricing feature (051), not this feature, MUST react to the event by returning a
  priced Work Item's pricing status to pending. This feature MUST NOT calculate or modify prices,
  and it MUST work normally when no pricing listener is installed.

**Late cancellation (US6)**

- **FR-024**: Cancelling a Work Item in `IN_PRODUCTION`, `PRODUCTION_COMPLETED`, or
  `READY_FOR_COLLECTION` MUST be possible only through the late-cancellation action. That action
  requires the order-cancel permission, a reason, and a cost incurred (exact decimal, zero or
  more, EGP), with optional produced-so-far quantity and note. It MUST refuse Work Items in any
  other state.
- **FR-025**: Late cancellation MUST store the cost record permanently, hand the cost to finance
  (052) as a direct cost of the order in the same transaction, stop the production timer, close
  any pending change request as "closed by cancellation", and audit the action.
- **FR-026**: Every other cancellation path (single-item cancel, whole-order cancel, any future
  path) MUST be refused for these states server-side. The whole-order cancel MUST report the Work
  Items that need late cancellation instead of silently skipping them.

**Admin override (US7)**

- **FR-027**: An Admin (admin-override permission) MUST be able to change the specification of a
  Work Item in any state except `CANCELLED`, with a mandatory reason, creating a version with
  origin Admin override. The override MUST be refused while a change request is pending on that
  Work Item, or while an approved revised instruction is still unacknowledged by production.
- **FR-028**: An Admin override on an `IN_PRODUCTION` Work Item MUST be recorded as a change
  request approved in the same step, with the same outcome choice and the same effects
  (FR-014/FR-015/FR-021).

**Cross-cutting**

- **FR-029**: Every step (version created, direct edit, change request recorded, approved,
  rejected, withdrawn, closed by cancellation, revised instruction acknowledged, late
  cancellation, Admin override) MUST write an audit event with actor, action, entity, entity ID,
  timestamp, before/after values, and reason where applicable, in the same transaction as the
  change (constitution III/V, PRD §45).
- **FR-030**: Adding a new Work Item to an order that already has Work Items in production MUST
  remain allowed (011 FR-011b). It creates the new item's v1 and needs no change request.
- **FR-031**: A Work Item's due date MUST NOT be part of the versioned specification. Its changes
  remain ordinary audited edits and never trigger a change request or a freeze.

### Key Entities

- **Specification Version** (new): one immutable, numbered snapshot of what a Work Item is to be
  made as (product type, description, quantity, dimensions and unit, material, finish notes),
  with origin, author, time, the Work Item's state at the time, and reason. It belongs to one
  Work Item and is never edited or deleted.
- **Work Item** (existing, 002/011): gains a pointer to its current Specification Version. Its
  existing specification fields remain and always mirror the current version, so every existing
  reader keeps working.
- **Change Request** (new): a customer's requested modification to an in-production Work Item. It
  holds the base version, proposed values, reason, requester, status (pending, approved, rejected,
  withdrawn, closed by cancellation), decision (approver, time, note, outcome), the resulting
  version when approved, the resulting Return when sent back to design, and the production
  acknowledgment (who, when).
- **Late Cancellation** (new): the permanent record of a cancellation after production started,
  holding the reason, cost incurred (EGP, exact), optional produced-so-far quantity and note, the
  Work Item's state at cancellation, and actor/time. It is the source record for finance's direct
  cost (052).
- **Return** (existing, 013): reused unmodified for "send back to design" with category Customer
  change.
- **Audit Event** (existing, 001): receives every step above.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After deployment and backfill, 100% of Work Items have a current specification
  version. A verification check finds zero Work Items without one.
- **SC-002**: For any Work Item, the original (v1) specification, including original quantities,
  can be retrieved 100% of the time, no matter how many changes followed.
- **SC-003**: Zero direct specification edits succeed on a Work Item that is in production or
  later, through any screen or direct server request.
- **SC-004**: Zero production completions happen while a change request is pending or a revised
  instruction is unacknowledged on that Work Item.
- **SC-005**: An approver can open a pending change request, see what would change, and record a
  decision in under 30 seconds.
- **SC-006**: 100% of late cancellations have a reason and an explicitly entered cost.
- **SC-007**: 100% of the steps listed in FR-029 produce an audit event.
- **SC-008**: Once pricing (051) is installed, 100% of approved changes on priced Work Items leave
  them with pricing pending.

## Assumptions

- The nine clarification answers above are assumptions pending owner confirmation. The most
  consequential are: Head Designer/Admin approve changes, production freezes automatically while
  a change is pending, and late-cancellation cost is mandatory.
- The specification fields are exactly those 011 already stores on the Work Item (product type,
  description, quantity, width, height, unit, material, finish notes). Adding fields later means
  adding them to the version too.
- Department routing (014's `routeToDepartment`), priority (011), designer assignment (012), and
  design files (012/013/050) are not part of the specification and keep their own existing audit
  trails.
- Customer approval of a change over WhatsApp is out of scope (054). Reception records the
  customer's request, and the in-shop approver confirms it. Recording a request originating from a
  WhatsApp message is still just a request recorded by reception.
- Recalculating the price is out of scope (051 reacts to the event). Finance's direct-cost ledger is
  out of scope (052 receives the cost through the hand-off). Until 051/052 exist, their hand-offs
  do nothing, and the change and the late-cancellation cost are still recorded in full by this
  feature.
- Viewing a Work Item's specification history and diff follows the same visibility as the order
  detail page today (any signed-in staff member). The production job card view stays limited to
  the operator's own departments, as in 014.
- Notification recipients are chosen from configured data: the assigned designer, the Work
  Item's production department, the requester, and users holding a given permission. No
  individual employee or role name is written into the rules (constitution VI).
- The workflow gains three edges into `REWORK_REQUIRED` (from `APPROVED`, `WAITING_PRICING`,
  `READY_FOR_PRODUCTION`) so pre-production "send back to design" (FR-009) is possible.
  `IN_PRODUCTION → REWORK_REQUIRED` already exists (added by 014).
