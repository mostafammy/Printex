# Feature Specification: Orders & Reception

**Feature Branch**: `011-orders-reception`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Getting every customer request into the system as an Order with Work Items, and letting anyone see where it is — the reception desk's main screen. Quick Create, full order form, product type catalog, reception queue, order detail page with timeline, order search, cancel with reason, edit before design starts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Create a walk-in or phone request (Priority: P1)

A reception user answers a phone call or greets a walk-in customer who wants something printed.
They need to log the request in the system immediately — before the caller hangs up, before the
walk-in customer gets impatient — even if they don't yet know every detail (exact size, material,
department). They pick or create the customer, type one line describing what's needed, set a
priority, and save. The system creates the order and a first Work Item right away, flags it as
incomplete, and the reception user can fill in the rest later or hand it to whoever will.

**Why this priority**: This is the single most common action a reception user performs, many times
an hour, and it's the front door for every other feature (design, production, pricing, delivery).
Nothing downstream exists in the system until a request lands here. Constitution requires every
customer request to exist as an Order — this story is what makes that true in practice, not just
in principle.

**Independent Test**: Can be fully tested by opening Quick Create, entering only a customer, a
one-line description, and a priority, saving, and confirming an Order + one Work Item now exist
in the reception queue, flagged incomplete, with an audit event recorded.

**Acceptance Scenarios**:

1. **Given** a reception user is signed in, **When** they open Quick Create, pick an existing
   customer, type a one-line description, choose a channel and priority, and save, **Then** a new
   Order and one Work Item are created in under 10 seconds of user effort, and the order appears in
   the reception queue flagged "incomplete" with a list of the fields still missing.
2. **Given** a reception user is on a phone call with someone who isn't an existing customer,
   **When** they choose "Cash Customer" instead of picking a customer record, **Then** the order is
   created against the shared Cash Customer and saved just as fast.
3. **Given** a reception user is using only the keyboard (no mouse), **When** they complete Quick
   Create, **Then** every field and the save action are reachable and operable by keyboard alone.
4. **Given** an order was just created via Quick Create, **When** any user later opens its detail
   page, **Then** they can see it was created via Quick Create and which fields are still missing.

---

### User Story 2 - Build a full multi-item order (Priority: P1)

A reception user has a customer in front of them (or on a detailed call) who wants several distinct
things printed — a banner, some business cards, an outdoor sign — each with its own size, material,
and finishing notes, and possibly headed to different departments. The reception user needs to
capture all of it as one order without losing the fact that each item is tracked and routed
separately.

**Why this priority**: Multi-item orders are the normal case for a print shop, not the exception —
this is the form reception actually lives in most of the day, and it's what makes per-item routing
(department, design, review) possible at all. Equally P1 with Quick Create because a shop that can
only log one-line requests isn't usable for real work.

**Independent Test**: Can be fully tested by creating one order with four Work Items, each set to a
different target department, and confirming all four appear correctly routed and independently
traceable on the order detail page.

**Acceptance Scenarios**:

1. **Given** a reception user is filling out the full order form, **When** they add multiple Work
   Items, each with product type, quantity, width × height with a unit, material, finish/sides
   notes, and a target department, **Then** all items save under the same order and each shows up
   as its own card on the order detail page with its own state badge.
2. **Given** an order has four Work Items routed to four different departments, **When** any one of
   those Work Items changes state, **Then** the other three are unaffected and the order's overall
   status reflects all four correctly (per the 002 status-derivation rule).
3. **Given** a reception user is adding a Work Item, **When** they mark it as not requiring design
   review, **Then** that flag is saved and later respected by the design/review workflow (002)
   without reception needing to do anything further.
4. **Given** a reception user is adding a Work Item, **When** they attach one or more customer-
   supplied files, **Then** those files are stored under the "Original" category and visible from
   the Work Item.
5. **Given** an order's items are logically one job, **When** reception sets the order to "grouped"
   presentation, **Then** the items are shown together in every list view while remaining
   individually traceable (state, history, routing are per-item, never merged).

---

### User Story 3 - Reception queue: see what needs attention (Priority: P1)

A reception user starts their shift and needs to know, at a glance, which orders are new and
unassigned, which are still incomplete, and which are urgent — without having to search or ask
around.

**Why this priority**: A queue nobody can see isn't a queue — this is the shared operational view
that makes the rest of the feature useful day to day, and it's the first thing a reception user
looks at. P1 alongside the two creation stories because logging a request that nobody then sees is
equivalent to not logging it.

**Independent Test**: Can be fully tested by creating a mix of orders (some urgent, some normal,
some incomplete, in various creation-time order) and confirming the queue sorts and flags them
correctly with no manual refresh needed to reflect new state.

**Acceptance Scenarios**:

1. **Given** several orders exist with different priorities, **When** a reception user opens the
   queue, **Then** urgent orders are shown first, then the rest oldest-first.
2. **Given** an order was created via Quick Create and never completed, **When** it appears in the
   queue, **Then** it's visibly flagged as incomplete.
3. **Given** a reception user changes an order's priority to urgent after creation, **When** they
   save that change, **Then** the change is recorded in the order's audit history and the order
   immediately moves to the front of the queue — but no workflow gate is skipped because of it.

---

### User Story 4 - Order detail page with full timeline (Priority: P2)

Anyone who needs to answer "where is this order?" — reception, a designer, an admin, eventually a
customer-facing conversation — opens the order and sees everything: who created it, every Work
Item's current state, and a complete timeline of every transition with who made it, when, and why.

**Why this priority**: Essential for trust and troubleshooting, and required by the constitution's
audit-trail principle, but the shop can still take and route orders (Stories 1–3) before this page
exists in its complete form — it becomes urgent the first time someone asks "why is this late,"
which is a slightly later moment than order intake itself.

**Independent Test**: Can be fully tested by creating an order, driving one of its Work Items
through several transitions and a cancellation, then opening the detail page and confirming every
transition appears in the timeline with actor, timestamp, and reason where applicable.

**Acceptance Scenarios**:

1. **Given** an order has one or more Work Items, **When** a user opens its detail page, **Then**
   they see the customer, channel, priority, and the order's derived overall status, plus one card
   per Work Item with a clear state badge.
2. **Given** a Work Item has been through several state transitions, **When** a user views the
   order detail page, **Then** every transition appears on the timeline in order, showing actor,
   timestamp, and reason (where one was required or given).
3. **Given** an order or a Work Item was cancelled, **When** a user views its detail page, **Then**
   the cancellation and its required reason are visible on the timeline, and all prior history
   remains visible — nothing is hidden or deleted.
4. **Given** downstream features (designer assignment, pricing, payments, files, messages) are not
   yet built or not yet applicable to a given order, **When** a user views the order detail page,
   **Then** the page shows clearly-labeled empty/placeholder areas for that information rather than
   broken or missing sections.

---

### User Story 5 - Find an order fast (Priority: P2)

A reception user (or anyone else) needs to pull up a specific order when a customer calls back,
by order number, phone number, or customer name — without scrolling the whole queue.

**Why this priority**: Important for daily operation once there's any volume of orders, but the shop
functions for its first orders without search (small volume at first) — becomes necessary quickly
but is not on the critical path for the very first order to exist.

**Independent Test**: Can be fully tested by creating a few orders with distinct numbers, customer
names, and phone numbers, then searching by each and confirming the right order is found every
time.

**Acceptance Scenarios**:

1. **Given** orders exist in the system, **When** a user searches by exact order number, **Then**
   that order is returned.
2. **Given** orders exist in the system, **When** a user searches by a customer's phone number or
   name (full or partial), **Then** all matching orders are returned.

---

### User Story 6 - Cancel an order or a Work Item (Priority: P2)

A customer changes their mind, or a mistake was made at intake. Reception needs to cancel the whole
order or just one Work Item within it, and must give a reason — the record stays, it's never
deleted.

**Why this priority**: Necessary for real-world operation (cancellations happen) but not needed for
the very first successful order to flow through the system — reasonably deferred slightly behind
the P1 creation/queue stories.

**Independent Test**: Can be fully tested by cancelling a Work Item with a reason and confirming its
state becomes CANCELLED, the reason and actor are recorded, and the order's derived status reflects
the cancellation while every other Work Item on the order is unaffected.

**Acceptance Scenarios**:

1. **Given** a Work Item is in a non-terminal state, **When** a reception user cancels it and
   provides a required reason, **Then** its state becomes CANCELLED, the reason is recorded on the
   timeline, and this cannot be done without a reason.
2. **Given** a Work Item has already been delivered, **When** a user attempts to cancel it,
   **Then** the system refuses (delivered/completed Work Items cannot be cancelled — matches the
   002 workflow's terminal-state rules).
3. **Given** all Work Items on an order are cancelled, **When** a user views the order, **Then**
   its derived status reflects that every item was cancelled, and the full history remains visible.

---

### User Story 7 - Add a Work Item to an order already in progress (Priority: P2)

A customer who already has an order in the system calls back to add something else — another item
they forgot, or a follow-on request — while their original items are already in design or
production. Reception needs to attach the new Work Item to the *same* order rather than starting a
new one, so the customer's whole relationship stays on one record.

**Why this priority**: A common real-world flow (customers add to existing orders constantly) and
directly enabled by this feature's own Order/Work Item model — deferring it would push reception
back to workarounds (creating a disconnected new order) that this feature exists to avoid.

**Independent Test**: Can be fully tested by taking an order with one Work Item already past NEW
(e.g. IN_DESIGN), adding a second Work Item to that same order, and confirming both items appear
on the same order detail page with fully independent states and histories.

**Acceptance Scenarios**:

1. **Given** an order has at least one Work Item that has left the NEW state, **When** a reception
   user adds a new Work Item to that same order, **Then** it saves successfully, starts at NEW
   independent of the other items' progress, and appears on the same order's detail page.
2. **Given** an order is fully DELIVERED or every Work Item on it is CANCELLED/COMPLETED, **When**
   a reception user attempts to add a Work Item to it, **Then** the system refuses and directs them
   to create a new order instead (an order that's finished shouldn't silently reopen).
3. **Given** a Work Item is added to an order after some of its siblings have progressed, **When**
   the order's overall status is displayed, **Then** it correctly reflects the mix of states across
   every Work Item (per the 002 derivation rule), including the newly-added one.

---

### User Story 8 - Edit an order before design starts (Priority: P3)

Before design work has begun on a Work Item, reception sometimes needs to fix a typo, adjust a
quantity, or correct a dimension. This is a simple, audited edit — not a formal change-control
process (that's a separate, later feature for changes after production starts).

**Why this priority**: A real need, but the least urgent of the stories here — most orders don't
need a pre-design edit, and reception can work around it today by cancelling and recreating a Work
Item if this isn't yet available. Safe to ship last within this feature.

**Independent Test**: Can be fully tested by editing a Work Item's quantity while it's still in the
NEW state, saving, and confirming the change is reflected and recorded as an audited edit.

**Acceptance Scenarios**:

1. **Given** a Work Item has not yet entered design (state is NEW or ASSIGNED with no design
   started), **When** a reception user edits its quantity, dimensions, material, or notes,
   **Then** the change saves and is recorded as an audited edit (actor, timestamp, what changed).
2. **Given** a Work Item has already entered design or later, **When** a reception user attempts to
   edit it here, **Then** the system refuses and directs them toward the appropriate later process
   (out of scope for this feature — see Assumptions).

---

### Edge Cases

- What happens when Quick Create is used for a customer whose only distinguishing detail is a phone
  number that turns out to belong to an existing customer? (Handled by 010's CustomerPicker
  matching — out of scope here to redefine, but the order MUST reference whichever customer record
  the picker returns.)
- What happens when a reception user tries to save a Work Item with no department and the item
  requires design? (Department may be left unset at intake — see FR-006 — but the item must still
  be creatable and land correctly in the queue as needing routing.)
- What happens when two reception users try to change the same order's priority at nearly the same
  time? (Last write wins is acceptable; every change is independently audited, so no change is
  silently lost from history even if a later one supersedes it.)
- What happens when a customer's request doesn't map to any existing product type in the catalog?
  (Reception must still be able to create the Work Item — product type is a data field, not a hard
  gate to logging the request; see FR-004.)
- What happens when an order has zero Work Items? (Not a reachable state through this feature's own
  flows — every path that creates an Order creates at least one Work Item in the same action. An
  order can end up with all-cancelled Work Items, which is different from zero Work Items and is
  covered by Story 6.)
- What happens when someone tries to cancel an order directly rather than its Work Items? (Cancelling
  "the order" cancels every non-terminal Work Item on it, each with the same required reason,
  as one audited action per item — there's no separate "order-level cancelled" flag, since status
  is always derived from Work Items per the 002 contract.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a reception user create an Order and one Work Item in a single
  Quick Create action, capturing at minimum: customer (or Cash Customer), a one-line description,
  priority, and channel.
- **FR-001a**: Quick Create MUST complete in three or fewer required user inputs and MUST NOT
  require any field beyond what FR-001 lists.
- **FR-002**: An Order created via Quick Create with fields left unset MUST be flagged "incomplete"
  and MUST show the reception user which required fields (per FR-009) are still missing.
- **FR-003**: The system MUST let a reception user build a full order containing multiple Work
  Items in one session, each capturing: product type, quantity, width × height with a unit of
  measure, material, finish/sides notes, whether it requires design, whether it requires review,
  target department (optional at creation), an optional per-item due date, and optional initial
  customer files.
- **FR-003a**: The system MUST let a reception user set an optional order-level due date that acts
  as the default for any Work Item on that order without its own due date set; setting a Work
  Item's own due date MUST override the order-level default for that item only.
- **FR-004**: The system MUST provide a Product Type catalog (name, default department, default
  requires-design/requires-review, a pricing-mode hint for 051 to consume) that an Admin can
  create, rename, and retire. A Work Item's product type MUST be a reference to this catalog, but
  MUST remain optional at Work Item creation (an unset product type does not block saving).
- **FR-005**: The system MUST let reception present an order's Work Items as "grouped" or
  "separate" for display purposes only; this setting MUST NOT change that every Work Item is
  independently tracked, routed, and reported on.
- **FR-006**: A Work Item's target department MUST be settable at creation but MAY be left unset;
  an order containing a Work Item with no department MUST still save and appear in the reception
  queue.
- **FR-007**: The system MUST support exactly two order priorities, NORMAL and URGENT. Changing an
  order's priority MUST be recorded as an audited event (actor, timestamp, old and new value).
- **FR-007a**: URGENT priority MUST cause an order to sort ahead of NORMAL orders everywhere orders
  are listed, and MUST NOT cause any workflow gate (design, review, pricing, etc.) to be skipped.
- **FR-008**: The system MUST provide a reception queue showing new/unassigned orders, with
  incomplete orders visibly flagged, sorted urgent-first and then oldest-first within each priority.
- **FR-008a**: The reception queue MUST reflect a "delayed" flag on a Work Item when that
  information is available from the delay-detection feature (053); the queue MUST function
  correctly (without the flag) when that feature has not yet supplied it.
- **FR-009**: The system MUST provide an order detail page showing: customer, channel, priority,
  the order's derived overall status, one card per Work Item with a clear state badge, and a
  chronological timeline of every transition recorded against any of its Work Items (actor,
  timestamp, reason where applicable).
- **FR-009a**: The order detail page MUST reserve clearly-labeled areas for information owned by
  other features not yet built or not yet applicable (designer assignment, pricing, payments,
  files, messages) rather than omitting them silently or showing a broken section.
- **FR-010**: The system MUST let any authorized user search for orders by exact order number, and
  by customer phone number or name (partial match).
- **FR-011**: The system MUST let an authorized user cancel a Work Item that is not in a terminal
  state (DELIVERED, COMPLETED, or already CANCELLED), requiring a reason, and MUST record the
  cancellation, its reason, and its actor on that Work Item's timeline. The system MUST refuse to
  cancel a Work Item already in a terminal state.
- **FR-011a**: The system MUST let an authorized user cancel an entire order in one action, which
  MUST cancel every one of its non-terminal Work Items, each with the same supplied reason,
  recorded as an individually audited transition per Work Item.
- **FR-011b**: The system MUST let an authorized user add a new Work Item to an existing order at
  any time, regardless of the state of that order's other Work Items, as long as the order is not
  fully DELIVERED and does not consist entirely of CANCELLED/COMPLETED Work Items; the new Work
  Item MUST start at NEW independent of its siblings' progress. The system MUST refuse this action
  once the order has reached that finished condition and MUST direct the user to create a new order
  instead.
- **FR-012**: The system MUST let an authorized user edit a Work Item's quantity, dimensions,
  material, or notes while it has not yet entered design (state NEW, or ASSIGNED with no design
  work started), and MUST record each such edit as an audited event (actor, timestamp, what
  changed, old and new value).
- **FR-012a**: The system MUST refuse this kind of edit once a Work Item has entered design or any
  later state, and MUST indicate to the user that further changes go through a separate process
  (out of scope for this feature).
- **FR-013**: Every action this feature performs that creates or changes an Order, Work Item, or
  Product Type MUST be attributable to the authenticated actor who performed it and MUST be
  recorded in a way that cannot later be altered or deleted (constitution III).
- **FR-014**: Every capability in this feature MUST be gated by the same authorization check
  (001), and MUST be equally available to any user holding the Reception role, so reception staff
  can cover for one another.

### Key Entities

- **Order**: Represents one customer request as logged by reception; already defined by 002
  (customer, channel, priority, mode, creator, created-at, its Work Items). This feature is the
  primary way Orders come into existence and are viewed, searched, and cancelled, and adds an
  optional order-level default due date (FR-003a), but does not otherwise redefine its shape.
- **Work Item**: Represents one distinct thing to be produced within an order; already defined by
  002 (state, department, requires-design/review flags, assignee, transitions, phase timings).
  This feature is the primary way Work Items come into existence (with their descriptive fields —
  product type, quantity, dimensions, material, finish notes) and are edited or cancelled before
  design begins.
- **Product Type**: A catalog entry describing a kind of printable product (e.g. "Roll-up Banner,"
  "Business Cards"): name, default department, default requires-design/requires-review, and a
  pricing-mode hint. Owned by this feature; referenced (not owned) by 051's pricing rules and by
  Work Items.
- **Customer**: Who the order belongs to; base shape (name, Cash Customer flag) owned by 002,
  full profile owned by 010. This feature only references customers via 010's picker — it never
  creates or edits customer records itself.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reception user can log a new request (Quick Create) in under 10 seconds of active
  effort, using three or fewer inputs.
- **SC-002**: 100% of customer requests that reach reception, regardless of channel (walk-in,
  phone, WhatsApp, returning customer, direct-to-designer), can be represented as an Order with at
  least one Work Item — there is no request type this feature cannot log.
- **SC-003**: A single order can contain Work Items routed to at least four different departments,
  with each item's state, history, and routing fully independent of the others.
- **SC-004**: 100% of order/Work Item creations, edits, priority changes, and cancellations are
  visible on that order's timeline with actor, timestamp, and reason where applicable — nothing
  this feature does to an order is invisible or reversible-without-trace.
- **SC-005**: A user can find a specific order by number, phone, or customer name in one search
  action, without browsing the full queue.
- **SC-006**: Quick Create is fully operable using only a keyboard, with no functionality that
  requires a mouse.
- **SC-007**: An order's overall status always reflects its current Work Items with no manual
  "status" field for reception to keep in sync — it is impossible for the displayed status to
  contradict the actual state of its Work Items.

## Clarifications

### Session 2026-09-23

- Q: What counts as a "complete" order (vs. flagged incomplete)? → A: Every Work Item needs product
  type, quantity, width × height + unit, and target department set.
- Q: Where do due dates live? → A: Both — an optional order-level default plus an optional
  per-item override that takes precedence when set.
- Q: Can reception add Work Items to an order that already has items in production? → A: Yes,
  anytime the order isn't fully finished (DELIVERED, or every item CANCELLED/COMPLETED); the new
  item starts at NEW independent of its siblings.

## Assumptions

- **Product type starter list**: this feature ships with a small starter catalog (e.g. Roll-up
  Banner, Business Cards, Flyer/Poster, Vinyl Sticker, Outdoor Sign, Laser-cut Sign) covering the
  five departments already seeded by 002 (Digital, Banner, Outdoor, Laser, External); an Admin can
  add more at any time. This is a reasonable starting point, not a business requirement to
  validate.
- **"Edit before design starts" is a lightweight mechanism**, not the formal versioned change-
  control process — that process (016-change-control) governs edits after design/production has
  begun, and is a separate feature this one does not build or depend on for its own scope.
- Reception users share one undifferentiated capability set (constitution/PRD: "reception users all
  have the same capabilities so they can cover each other") — this feature does not introduce
  sub-roles within Reception.
- The 010-customers feature's `CustomerPicker` component and customer search/create flow are
  consumed, not built, here; until 010 ships, this feature's UI integrates against 010's documented
  contract shape and Cash Customer fallback remains usable standalone.
- The 050-files feature's `FilePanel` component is consumed, not built, here, for attaching initial
  customer files to a Work Item at creation.
- The 053-notifications feature's delayed-Work-Item signal is optional input to the reception
  queue (FR-008a) — this feature functions correctly before 053 exists.
