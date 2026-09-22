# Feature Specification: Core Domain & Shell

**Feature Branch**: `002-core-domain-shell`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "GitHub issue mostafammy/Printex#3 — shared skeleton both tracks build on: core data model (Customer, Order, WorkItem, WorkItemTransition, PhaseTiming), the single Work Item state machine, transitionWorkItem() as the only mutator, guard registry, derived Order status, StorageAdapter interface, notify()/outbox, server API pattern with typed errors, Arabic RTL app shell, testing/CI setup, dev seed script. Out of scope: auth/RBAC (001), customer UI (010), order entry (011), file versioning (050), notification delivery (053). Contracts frozen with Fady by EOD2. PRD refs: §4, §7, §8, §12, §55 Rules 1-3; constitution I, III, V, IX."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every job's status is always trustworthy (Priority: P1)

Any staff member or manager looking at an Order can trust its status without cross-checking paper
or asking another department, because the status is computed from the real state of every piece of
work inside it and cannot be hand-edited into an inconsistent state.

**Why this priority**: This is the core problem PRD and the constitution (Principle I) exist to
solve — "where is this order now?" must always have one correct, derivable answer. Nothing else in
the product is trustworthy if this isn't.

**Independent Test**: Can be fully tested by creating an Order with several Work Items in different
states (e.g. one delivered, one in production) and confirming the Order's displayed status matches
the documented derivation rule, with no code path able to set Order status directly.

**Acceptance Scenarios**:

1. **Given** an Order with all Work Items delivered, **When** the Order is viewed, **Then** its
   status reads "Delivered".
2. **Given** an Order with at least one Work Item still in production and none delivered, **When**
   the Order is viewed, **Then** its status reads "In production".
3. **Given** a mix of delivered and in-production Work Items on the same Order, **When** the Order
   is viewed, **Then** its status reads the documented "partially ready" state, not an arbitrary or
   averaged value.
4. **Given** any attempt by application code to write an Order's status field directly instead of
   changing a Work Item's state, **When** the code runs, **Then** it is rejected or impossible by
   construction (no such write path exists).

---

### User Story 2 - A job's history can never be silently rewritten (Priority: P1)

Anyone investigating a delay, a dispute, or a mistake can see the complete, tamper-proof sequence
of what happened to a Work Item — every state change, who made it, when, and why — with no gaps and
no edits.

**Why this priority**: History being append-only (constitution Principle III) is what makes
accountability and future analytics possible; it must exist before any feature that changes state
is built on top of it.

**Independent Test**: Can be fully tested by driving a Work Item through several legal transitions
and confirming each produces exactly one transition record and one audit event, and that a
forbidden transition changes nothing and produces neither.

**Acceptance Scenarios**:

1. **Given** a Work Item in an allowed source state, **When** it is moved to an allowed destination
   state, **Then** a transition record and an audit event are both written, referencing the same
   actor and timestamp, and the Work Item's state changes.
2. **Given** a Work Item in some state, **When** a transition to a disallowed destination state is
   attempted, **Then** the Work Item's state does not change and no transition or audit record is
   created; the caller receives a clear rejection.
3. **Given** a transition that would succeed but whose audit write fails, **When** that happens,
   **Then** the state change is rolled back entirely — the Work Item ends up as if the attempt never
   happened.
4. **Given** a Work Item's timer is running when the server restarts, **When** the server comes back
   up, **Then** the elapsed time shown is computed from stored timestamps and is correct, not reset
   to zero.

---

### User Story 3 - Staff can navigate the system in Arabic from day one (Priority: P2)

A print-shop staff member opens the application and sees an Arabic, right-to-left interface with
navigation limited to what their role allows, and a placeholder "My queue" landing page — even
before any real business screen exists.

**Why this priority**: Constitution Principle IX requires Arabic-first, RTL UX; establishing the
shell now (rather than retrofitting it) prevents every later screen from having to fix direction
and layout after the fact.

**Independent Test**: Can be fully tested by loading the app shell as users with different
permission sets and confirming the sidebar shows only permitted sections, text flows
right-to-left, and no left/right-hard-coded spacing appears anywhere in the shell.

**Acceptance Scenarios**:

1. **Given** the application shell loads, **When** the page renders, **Then** the document direction
   is right-to-left and body text is Arabic.
2. **Given** two users with different permission scopes, **When** each views the sidebar, **Then**
   each sees only the navigation entries their permissions allow.
3. **Given** the shell's stylesheet, **When** it is scanned for directional spacing classes,
   **Then** no left/right-hard-coded classes are present — only start/end logical ones.

---

### User Story 4 - Two teams can build in parallel without breaking each other (Priority: P2)

The engineer building authentication/customers/files/pricing (Track B) and the engineer building
order/workflow screens (Track A) can each build against a fixed, documented contract for state
transitions, storage, and notifications, so neither has to wait for the other's implementation
details or accidentally duplicate the state-change logic.

**Why this priority**: The PRD requires the two tracks to proceed in parallel; without frozen
contracts, integration risk and rework grow with every day both tracks build.

**Independent Test**: Can be fully tested by having a second developer implement a guard or a
storage backend against the published contract alone (no access to this feature's internals) and
confirming it plugs in without modification to the core module.

**Acceptance Scenarios**:

1. **Given** the published contract for `transitionWorkItem`, `registerGuard`, `deriveOrderStatus`,
   `StorageAdapter`, and `notify`, **When** another feature registers a new guard or implements a
   new storage backend against it, **Then** it integrates without changing the core module's code.
2. **Given** the automated test suite and CI pipeline defined by this feature, **When** a pull
   request is opened against the shared repository, **Then** checks and tests run automatically and
   must pass before merge.

---

### Edge Cases

- What happens when a Work Item does not require design review (`requiresDesign = false`)? It MUST
  be able to move directly from creation to ready-for-production, skipping the design states
  entirely, without leaving a gap in its history.
- What happens when a Work Item does not require review (`requiresReview = false`)? It MUST be able
  to skip the review state the same way.
- What happens when two transitions for the same Work Item are attempted at the same time? Exactly
  one MUST succeed and be recorded; the other MUST be rejected cleanly, not silently lost or
  double-applied.
- What happens when a notification's recipient list is empty or a downstream delivery channel is
  unavailable? The event MUST still be recorded in the outbox; delivery is a separate concern and
  its absence MUST NOT block the transaction that created the event.
- What happens when the storage backend is unreachable? Callers MUST receive a clear failure rather
  than a silent no-op, and no metadata record may claim a file exists that was never stored.
- How does the system handle a guard that itself throws an unexpected error (as opposed to
  returning a structured failure)? The transition MUST be treated as failed and rolled back, not
  partially applied.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record every customer job as an Order that belongs to exactly one
  Customer (or the built-in Cash Customer), carrying a human-readable order number, intake channel,
  priority, packaging mode, and who created it and when.
- **FR-002**: System MUST record each unit of work within an Order as a Work Item, carrying its
  product type, assigned department (nullable until routed), current state, whether it requires
  design and/or review, and its current assignee.
- **FR-003**: System MUST define a fixed set of 15 Work Item states (NEW, ASSIGNED, IN_DESIGN,
  DESIGN_COMPLETED, WAITING_REVIEW, REWORK_REQUIRED, APPROVED, WAITING_PRICING,
  READY_FOR_PRODUCTION, IN_PRODUCTION, PRODUCTION_COMPLETED, READY_FOR_COLLECTION, DELIVERED,
  COMPLETED, CANCELLED) and an explicit table of which state-to-state transitions are allowed; any
  transition not on that table MUST be rejected.
- **FR-003a**: System MUST allow a Work Item in any non-terminal state (any state other than
  DELIVERED, COMPLETED, or CANCELLED) to transition directly to CANCELLED.
- **FR-003b**: When a Work Item is rejected into REWORK_REQUIRED, the destination state after
  rework MUST be determined by the recorded rejection category rather than being hard-coded to a
  single state — for example, a design-issue rejection routes back to IN_DESIGN while a
  reassignment-driving rejection routes back to ASSIGNED.
- **FR-004**: System MUST allow a Work Item whose `requiresDesign` is false to skip the design
  states, and one whose `requiresReview` is false to skip the review state, without breaking the
  continuity of its recorded history.
- **FR-005**: System MUST provide exactly one function through which any Work Item's state can be
  changed; no other code path may write a Work Item's state field.
- **FR-006**: Every successful state change MUST, within one atomic operation, validate the
  transition is allowed, run all applicable registered guards, write a transition record, write an
  audit event, and write a notification event — all four MUST succeed together or none MUST take
  effect.
- **FR-007**: System MUST let other features register additional guards (pass/fail rules) against a
  specific transition or destination state without modifying the core transition function.
- **FR-008**: System MUST compute an Order's status from the states of its Work Items using one
  documented, consistent rule: the Order shows the bucket (Not started, In production, Partially
  ready, Delivered, Completed, Cancelled) matching its furthest-behind Work Item, except that
  Delivered, Completed, and Cancelled each require every Work Item on the Order to be in that
  bucket. Order status MUST NOT be independently editable or storable as a free-standing value.
- **FR-008a**: Order numbers MUST be a single ever-increasing sequence for the shop's entire
  lifetime, with no yearly reset and no prefix.
- **FR-009**: System MUST persist queue and active time separately per Work Item phase as
  timestamped segments (each with a start and, once ended, an end time); pausing (a break, end of
  shift) MUST end the current segment, and resuming MUST start a new one. A phase's total active or
  queue duration MUST be the sum of its segment durations, so elapsed durations remain correct
  after a browser refresh or server restart and exclude paused/idle time.
- **FR-010**: System MUST provide a storage abstraction for binary files (put, get, exists) with an
  initial local-disk implementation, so business logic never depends on file paths or names as
  identifiers.
- **FR-011**: System MUST provide a mechanism to record a notification event (type, related entity,
  recipients, payload) as part of the same transaction that caused it, independent of whether or
  how it is later delivered.
- **FR-012**: System MUST expose one consistent pattern (validated input, authenticated/authorized
  caller, typed error outcomes distinguishing "not signed in," "not permitted," "invalid
  transition," "a guard rejected it," and "invalid input") for every write operation defined by
  this feature.
- **FR-013**: System MUST render its application shell right-to-left in Arabic by default, using
  only direction-independent (start/end) layout spacing, and MUST filter its navigation menu to the
  sections the signed-in user's permissions allow.
- **FR-014**: System MUST provide a placeholder landing page ("My queue") reachable from the shell
  navigation, with no real business content yet.
- **FR-015**: System MUST include an automated test suite covering, at minimum, every forbidden
  Work Item transition and the rollback behavior when an audit write fails, plus a continuous
  integration pipeline that runs these tests and static checks on every proposed change.
- **FR-016**: System MUST include a development seed routine that populates a minimal working data
  set (an administrator, a set of departments, a handful of customers and orders) for local
  development and demos.
- **FR-017**: System MUST publish the contracts for its transition function, guard registration,
  Order status derivation, storage abstraction, and notification recording in a form the parallel
  authentication/customer/file/pricing track can build against without reading this feature's
  internal implementation.
- **FR-018**: System MUST record, for every Work Item transition, the acting user, the previous and
  new state, the time it occurred, and an optional reason — retrievable as part of that Work Item's
  permanent history.

### Key Entities

- **Customer**: A person or business that owns Orders; includes a single built-in "Cash Customer"
  used for walk-in sales with no formal account.
- **Order**: A customer's job — one or more Work Items grouped for intake, packaging, and delivery
  purposes. Carries a human-readable number, the customer it belongs to, intake channel, priority,
  packaging mode, and who/when it was created. Its status is always derived, never stored directly.
- **Work Item**: One unit of work within an Order (e.g. one banner, one set of business cards) —
  the atomic thing that moves through design, review, pricing, production, and delivery. Carries
  its product type, department, current state, design/review requirement flags, and assignee.
- **Work Item Transition**: An immutable record of one state change on a Work Item — previous state,
  new state, acting user, timestamp, and optional reason.
- **Phase Timing**: A record of time spent by a Work Item in a phase, split into queue time and
  active time, stored as start/end timestamps rather than a running counter.
- **Notification Event (Outbox)**: A record that something happened and who should hear about it,
  written in the same transaction as the event itself; separate from however it is later delivered.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of attempted Work Item state changes that are not on the allowed-transitions
  table are rejected, with zero instances of a Work Item ending up in an undocumented state.
- **SC-002**: 100% of successful Work Item state changes have exactly one matching transition
  record and one matching audit event; there are zero recorded state changes missing either.
- **SC-003**: An Order's displayed status matches its documented bucket-derivation rule in 100% of
  sampled cases across all six buckets (Not started, In production, Partially ready, Delivered,
  Completed, Cancelled), including mixed-state Orders correctly landing on "Partially ready".
- **SC-004**: A Work Item's shown elapsed phase duration is accurate to within one second of the
  true elapsed time after a simulated server restart, in 100% of tested cases.
- **SC-005**: A second engineer can implement a new guard or a new storage backend using only the
  published contract, with zero required changes to this feature's core files, verified by at least
  one working example of each before this feature is marked done.
- **SC-006**: Every pull request against the shared repository triggers automated checks and tests
  that must pass before merge, with a passing run on the `main` branch at all times.
- **SC-007**: The application shell renders correctly right-to-left in Arabic and contains zero
  hard-coded left/right spacing classes, verified by an automated lint check.

## Assumptions

- `ProductType` is treated as owned by the order-entry feature (011), not this one; this feature
  only stores a reference to a product type on the Work Item, not the catalog itself.
- The typed error model's exact wire format (HTTP status vs. structured result object) is an
  implementation detail decided in planning, not in this spec.
- "Local-disk stub" for the storage adapter is for development only; a production-grade backend is
  explicitly out of scope for this feature (see PRD file-versioning feature, 050).
- The audience able to view Order/Work Item status in User Story 1 is any authenticated internal
  staff member permitted to see that Order, per role/department scoping owned by the authentication
  feature (001), which this feature consumes but does not define.

## Clarifications

### Session 2026-09-22

- Q: From which states can a Work Item be cancelled — any non-terminal state, or only the states
  before production starts? → A: Any non-terminal state (not DELIVERED/COMPLETED/CANCELLED) can
  transition directly to CANCELLED.
- Q: When Head Designer rejects a Work Item, does it always return to IN_DESIGN for rework, or can
  it return to a different earlier state depending on what's wrong? → A: REWORK_REQUIRED can land
  on different states depending on the rejection category recorded with it (e.g. back to ASSIGNED
  when the rejection reflects a reassignment need, IN_DESIGN otherwise); the exact category→state
  mapping is finalized in planning.
- Q: When an Order's Work Items are in a mix of states (some delivered, some in production, some
  not started), what exact label and rule determines the Order's displayed status? → A: A fixed
  ordered bucket set (Not started, In production, Partially ready, Delivered, Completed,
  Cancelled). The Order shows the bucket matching its "furthest-behind" Work Item, except
  Delivered/Completed/Cancelled, which require every Work Item to match that bucket.
- Q: Should the Order number ever reset (e.g. yearly) or carry a prefix, or is it one
  ever-increasing sequence for the whole shop's lifetime? → A: A single ever-increasing sequence,
  no reset, no prefix.
- Q: When a designer pauses work (a break, end of shift) and resumes later, should the Active Work
  timer treat that as one continuous session or as separate active segments? → A: Both — pausing
  ends the current active segment and resuming starts a new one (separate timestamped segments,
  each a `PhaseTiming` row), and the Active Work total is the sum of those segment durations, so
  break/idle time is excluded without a separate pause/resume state machine.
