# Feature Specification: Collection, Discrepancies & Delivery

**Feature Branch**: `015-collection-delivery`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Collection, Discrepancies & Delivery — the last mile of the Work Item
lifecycle: receiving printed output from production, checking quantities, recording
damage/waste/missing and how each was compensated, and handing over to the customer — never before
pricing is resolved. PRD §19, §20, §21, §22, §55 (Rules 7 and 10). Constitution II applies
directly."

## Clarifications

### Session 2026-09-24

All answers below were chosen without access to the owner and are recorded as assumptions to be
confirmed. Each lists the alternatives that were rejected.

- Q: Is partial delivery allowed? → A: Yes, at Work-Item granularity only. In separate-mode orders
  any subset of ready Work Items may be handed over; in grouped-mode orders a subset may be handed
  over only when the user explicitly marks the delivery as partial and gives a reason. A single Work
  Item is handed over exactly once, with its full accepted quantity; any outstanding quantity is
  handed over later through its linked reprint Work Item (FR-017). (ASSUMPTION — pending owner
  confirmation) Rejected: no partial delivery at all; quantity-level split deliveries of one Work
  Item; partial delivery of grouped orders without a reason.
- Q: What exactly is "financial closure" / when does a Work Item become `COMPLETED`? → A: Closure is
  evaluated per Order. An Order is financially closed — and all of its `DELIVERED` Work Items move
  to `COMPLETED` together — only when (a) every non-cancelled Work Item is `DELIVERED`; (b) pricing
  is resolved for every non-cancelled Work Item; (c) no discrepancy on the Order is still open
  (every discrepancy's quantity is fully covered by recorded resolutions); and (d) the Order's
  remaining balance is zero or less, or the Order is covered by approved customer credit. Closure is
  re-evaluated automatically after every delivery, every discrepancy resolution, and every payment,
  and can be requested manually. (ASSUMPTION — pending owner confirmation) Rejected: per-Work-Item
  closure (finance is order-level); "delivered = completed" (skips the financial gate the PRD §7
  lifecycle names); manual-only closure by accounting (orders would linger open).
- Q: Who may approve a compensation? → A: Print Reception/Delivery staff (whoever may receive
  production) may record non-monetary resolutions — Reprint, Replacement in next order, Customer
  accepts shortage, Other. Monetary resolutions — Credit and Price adjustment — require the
  Admin/Owner override permission and a mandatory reason. (ASSUMPTION — pending owner confirmation)
  Rejected: a new dedicated "resolve discrepancy" permission (requires a change to 001's fixed
  permission list — can be added later without changing this feature's behavior); Admin-only for
  every resolution (bottleneck on the most common case, reprints); Reception for everything (money
  leaves the business without owner sign-off).
- Q: Does a major discrepancy alert the owner, and at what threshold? → A: Yes. When a single
  receipt or a single later discrepancy makes the non-accepted quantity of a Work Item reach or
  exceed a configurable percentage of its expected quantity (default 10%), the configured
  recipients (default: Admin/Owner) are notified. The threshold and recipients are Admin-configured
  data. (ASSUMPTION — pending owner confirmation) Rejected: no alert (PRD §38 lists "Major
  discrepancy" for Owner/Admin); a fixed absolute-unit threshold (meaningless across 10-unit and
  10,000-unit jobs); alerting on every discrepancy (noise).
- Q: Until the pricing feature (051) exists, how does the pricing gate behave? → A: Fail closed —
  delivery is refused with "pricing unresolved" and a message that the pricing module is not yet
  connected. The gate is never bypassed, including for urgent orders. (ASSUMPTION — pending owner
  confirmation) Rejected: fail open until 051 ships (a shortcut the constitution forbids);
  inventing a temporary pricing-status flag inside this feature (a parallel source of truth 051
  would have to migrate).
- Q: Who may see the customer's balance at delivery? → A: Anyone permitted to record deliveries sees
  the Order's total, paid, remaining amount and whether the customer is on approved credit —
  read-only, no payment history. (ASSUMPTION — pending owner confirmation) Rejected: finance-view
  permission only (the seeded Print Reception/Delivery role lacks it, so the person handing over
  would not know whether to collect money); hiding the balance entirely.
- Q: Is the "ready for collection" customer notification automatic or manual? → A: Automatic: the
  system records a customer-notification request the moment an Order (grouped mode) or a Work Item
  (separate mode) becomes ready for the customer. Whether and how it is actually sent (template,
  WhatsApp policy, retries) is owned by the WhatsApp feature (054). (ASSUMPTION — pending owner
  confirmation) Rejected: manual trigger only (staff forget; PRD §19 "prepare work for customer
  delivery"); this feature sending messages itself (constitution VII).
- Q: Where does a reprint live? → A: A reprint is a new Work Item in the same Order, linked to the
  original Work Item and to the discrepancy resolution that created it, routed to the same
  production department, going straight to the production queue with the original's approved file
  (no new design or review). The original Work Item keeps its own history untouched. (ASSUMPTION —
  pending owner confirmation) Rejected: re-opening the original Work Item (no backward edge exists
  and its history would be overwritten); putting the reprint in a new Order (breaks "where is my
  order").
- Q: What is the expected quantity when a Work Item has no quantity in its specification? → A: The
  produced quantity reported by production is used as the expected quantity, and the receive screen
  labels it as such. (ASSUMPTION — pending owner confirmation) Rejected: blocking receipt until
  Reception fills the quantity (the specification is no longer editable after design starts, so the
  item would be stuck).
- Q: Are discrepancy causes a fixed list? → A: No — causes are an Admin-configured list (seeded
  with common print-shop causes); discrepancy *types* are the fixed six from PRD §20.
  (ASSUMPTION — pending owner confirmation) Rejected: a fixed code list of causes (constitution VI).
- Q: Can a customer rejection be recorded after hand-over? → A: Yes, until the Order is financially
  closed; it must then be resolved (e.g. reprint or credit) before closure. After closure it needs
  an explicit administrative action outside this feature. (ASSUMPTION — pending owner confirmation)
  Rejected: counter-only rejections (customers often complain the next day); unlimited post-closure
  rejections (reopens closed financial records).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collection staff see what has arrived from production (Priority: P1)

A Print Reception/Delivery employee opens the collection queue and sees every Work Item that
production has completed but nobody has yet received, grouped under its Order (order number,
customer, order mode, priority), urgent orders first then the order that has been waiting longest.
Each Order row shows how many of its Work Items are waiting to be received and how many are already
received or still in production, so the employee knows whether the customer's package is complete.

**Why this priority**: Nothing in this feature has a starting point without the queue; it is the
"what do I need to do next?" screen for the collection area (PRD §19, constitution IX).

**Independent Test**: Seed two Orders, one urgent and one normal, each with Work Items in mixed
states (production completed, in production, cancelled); open the queue as a collection employee
and confirm both Orders appear with the urgent one first, each showing only its
production-completed items as "waiting to receive" and the others as context.

**Acceptance Scenarios**:

1. **Given** two Orders with production-completed Work Items, one urgent and one normal, **When**
   the collection employee opens the queue, **Then** the urgent Order is listed first and each
   Order lists its production-completed Work Items together.
2. **Given** an Order with one production-completed Work Item and one still in production, **When**
   the queue is shown, **Then** the Order appears once, with one item waiting to be received and one
   shown as still in production.
3. **Given** a user without the collection permission, **When** they request the queue directly,
   **Then** the request is refused.
4. **Given** more Orders waiting than fit on one page, **When** the employee pages through the
   queue, **Then** every waiting Order appears exactly once across the pages.

---

### User Story 2 - Receive production output and count it (Priority: P1)

The employee opens a received Work Item and sees its expected quantity (from the specification) and
the produced quantity production reported. They count and enter the accepted, damaged, missing and
waste quantities. If anything is not accepted, they record at least one discrepancy per affected
quantity (type, cause, the responsible employee if known, notes, optionally a voice note, photo or
file). On save, the Work Item becomes ready for collection.

**Why this priority**: Receiving and counting is the core responsibility of the collection area
(PRD §19) and the only point where "every production discrepancy is recorded" (PRD §55 Rule 7) can
be guaranteed.

**Independent Test**: Receive a production-completed Work Item with expected 100, entering accepted
90, damaged 6, missing 0, waste 4 and two discrepancy lines covering the 6 damaged and 4 waste;
confirm the Work Item is ready for collection, the counts and discrepancies are stored with the
employee and time, and both are in the audit log. Repeat with counts summing to 99 and confirm the
server refuses it.

**Acceptance Scenarios**:

1. **Given** a production-completed Work Item with expected quantity 100, **When** the employee
   submits accepted 90 + damaged 6 + missing 0 + waste 4 with discrepancies covering the 10
   non-accepted units, **Then** the receipt is stored, the Work Item becomes ready for collection,
   and the receipt and each discrepancy appear in the audit log with the employee and time.
2. **Given** the same Work Item, **When** a submission's accepted + damaged + missing + waste does
   not equal the expected quantity — whether from the screen or from a direct server call —
   **Then** the server refuses it with a quantity-mismatch error and nothing is stored.
3. **Given** a submission with 6 damaged units but discrepancy lines covering only 4 of them,
   **When** it is submitted, **Then** it is refused because every non-accepted unit must be
   classified.
4. **Given** a discrepancy line, **When** the employee attaches a voice note, photo or file,
   **Then** the attachment is stored privately and linked to that discrepancy.
5. **Given** a Work Item that is not production-completed (e.g. still in production, or already
   received), **When** a receipt is submitted for it, **Then** it is refused.

---

### User Story 3 - Hand over to the customer, never before pricing is resolved (Priority: P1)

At the counter, the employee opens the Order's delivery screen, sees which Work Items are ready and
their accepted quantities, the Order's total / paid / remaining balance and whether the customer is
on credit, and records the hand-over: which Work Items, who handed over, who received them (name
and phone), and when. If any selected Work Item's pricing is unresolved, the hand-over is refused
with a clear reason naming the Work Items and who to ask, and nothing changes — even for urgent
orders and even when called directly on the server.

**Why this priority**: The pricing-before-delivery gate is the business gate this feature exists to
enforce (PRD §22 Mandatory Gate, §55 Rule 10, constitution II). Without delivery the Work Item
lifecycle never reaches the customer.

**Independent Test**: Prepare an Order with two ready Work Items, one with resolved pricing and one
with pending pricing; attempt to deliver both through a direct server call and confirm it is
refused with "pricing unresolved" naming the pending item and nothing is delivered; resolve the
pricing and retry; confirm both are delivered with the hand-over details stored.

**Acceptance Scenarios**:

1. **Given** an Order whose ready Work Items include one with pending pricing, **When** a delivery
   of that Order is requested through a direct server call, **Then** it is refused with the error
   `PRICING_UNRESOLVED`, the response names the pending Work Item(s) and who to ask, and no Work
   Item changes state and no delivery record is created.
2. **Given** the same Order marked urgent, **When** delivery is requested, **Then** it is refused in
   exactly the same way (urgent never skips the gate).
3. **Given** an attempt to move a ready Work Item to delivered through the central workflow
   transition directly (bypassing the delivery screen), **When** its pricing is pending, **Then**
   the transition is refused by the pricing guard.
4. **Given** an Order whose ready Work Items all have resolved pricing, **When** the employee
   records the hand-over with the receiver's name and phone, **Then** each delivered Work Item
   becomes delivered, the delivered quantity equals its accepted quantity, and the hand-over
   (handed over by, received by name/phone, date-time) is stored and audited.
5. **Given** a credit customer with a remaining balance, **When** the delivery screen is shown,
   **Then** the balance and credit status are displayed and delivery is not blocked by the balance.
6. **Given** a grouped-mode Order with three ready Work Items, **When** the employee tries to
   deliver only two without marking the delivery partial with a reason, **Then** it is refused;
   with the partial flag and a reason, it succeeds and the remaining item stays ready.
7. **Given** a separate-mode Order, **When** the employee delivers one of its ready Work Items,
   **Then** it succeeds without a partial reason and the delivery is recorded as partial.

---

### User Story 4 - Record a discrepancy found after receipt (Priority: P2)

After receipt — while the goods wait on the shelf, at the counter when the customer inspects them,
or after hand-over when the customer comes back — an employee records a new discrepancy (damaged,
missing, incorrectly produced, or customer rejection) against a Work Item. For goods still in the
shop, the stated quantity moves out of the accepted count and the receipt counts are re-recorded as
a new revision, so the four quantities still add up and the earlier counts stay in history.

**Why this priority**: Discrepancies are not only found at receipt; customer rejection in particular
happens at or after hand-over (PRD §20). It builds on the receipt from US2.

**Independent Test**: Take a ready Work Item received with accepted 90; record a damaged
discrepancy of 5; confirm a new receipt revision shows accepted 85 / damaged +5 still summing to
expected, the previous revision is still retrievable, and the discrepancy is audited. Record a
customer rejection of 3 against a delivered Work Item and confirm it is stored without altering the
delivered quantity.

**Acceptance Scenarios**:

1. **Given** a ready Work Item with 90 accepted, **When** a damaged discrepancy of 5 is recorded,
   **Then** a new receipt revision shows 85 accepted with the damaged count increased by 5, the
   total still equals expected, and the previous revision remains visible.
2. **Given** a ready Work Item with 90 accepted, **When** a discrepancy of 95 is recorded, **Then**
   it is refused because it exceeds the accepted quantity.
3. **Given** a delivered Work Item, **When** a customer rejection is recorded, **Then** it is
   stored against the Work Item and the delivered quantity is unchanged; **When** any other type is
   recorded against a delivered Work Item, **Then** it is refused.
4. **Given** an Order that is financially closed, **When** any discrepancy is recorded against its
   Work Items, **Then** it is refused.

---

### User Story 5 - Record how each discrepancy was compensated (Priority: P2)

For each discrepancy, an authorized employee records one or more resolutions covering its quantity:
Reprint, Replacement in next order, Credit, Price adjustment, Customer accepts shortage, or Other —
each with a reason and notes, and an amount for Credit and Price adjustment. A Reprint immediately
creates a new, linked Work Item in the same Order for the reprinted quantity, sent back to the
production queue with the originally approved file; the original and the reprint each keep their
own full history and point to each other.

**Why this priority**: PRD §21 requires every discrepancy's resolution to be recorded; reprints are
the most common operational consequence. Depends on discrepancies (US2/US4).

**Independent Test**: Resolve a 10-unit damaged discrepancy with a reprint of 10; confirm a new Work
Item exists in the same Order with quantity 10, linked to the original and to the resolution,
waiting in the original department's production queue; the original Work Item's history is
unchanged; the resolution is audited. Attempt a Credit resolution as a collection employee without
the override permission and confirm it is refused.

**Acceptance Scenarios**:

1. **Given** a 10-unit discrepancy, **When** it is resolved with a Reprint of 10, **Then** a new Work
   Item for 10 units is created in the same Order, linked to the original Work Item and to the
   resolution, placed in the production queue of the original's department with the original's
   approved file, and both Work Items' histories are retrievable in full.
2. **Given** a 10-unit discrepancy, **When** it is resolved as 6 reprinted and 4 "customer accepts
   shortage", **Then** both resolutions are stored and the discrepancy counts as resolved; **When**
   a further resolution would exceed 10 units, **Then** it is refused.
3. **Given** a collection employee without the override permission, **When** they record a Credit
   or Price adjustment resolution, **Then** it is refused; **Given** an Admin/Owner, **When** they
   record one with an amount and reason, **Then** it is stored and a notice is recorded for the
   pricing (051) and finance (052) features to act on.
4. **Given** any resolution, **When** it is submitted without a reason, **Then** it is refused.
5. **Given** any recorded resolution, **When** the audit log is viewed, **Then** it shows who
   resolved it, when, the resolution type, quantity, amount (if any), reason and notes.

---

### User Story 6 - The customer is told when their order is ready (Priority: P2)

When a separate-mode Work Item, or the last outstanding Work Item of a grouped-mode Order, becomes
ready for collection, the system records a "ready for collection" customer notification request
and an internal "order ready" notice for Reception, exactly once per time it becomes ready.

**Why this priority**: Customer notification is part of PRD §19/§37 and the Print
Reception/Delivery role (PRD §48), but the hand-over works without it, so it follows the P1 flow.

**Independent Test**: For a grouped Order with two Work Items, receive the first and confirm no
customer notification is recorded; receive the second and confirm exactly one is recorded. For a
separate Order, receive one item and confirm a notification for that item is recorded.

**Acceptance Scenarios**:

1. **Given** a grouped-mode Order with two non-cancelled Work Items, **When** only the first is
   received, **Then** no customer notification is recorded; **When** the second is received,
   **Then** exactly one "Order ready for collection" notification is recorded.
2. **Given** a grouped-mode Order where one Work Item is cancelled, **When** all remaining Work
   Items are received, **Then** the Order counts as ready (cancelled items are ignored).
3. **Given** a separate-mode Order, **When** one Work Item is received, **Then** a notification for
   that Work Item is recorded.
4. **Given** a grouped Order that was ready and then gained a reprint Work Item, **When** the
   reprint is later received, **Then** a new ready notification is recorded (the Order became ready
   again).

---

### User Story 7 - Orders close financially and become completed (Priority: P3)

Once an Order is fully delivered, fully priced, has no open discrepancies, and is paid (or covered
by approved credit), its Work Items become completed automatically. Staff can see, for an Order that
is delivered but not closed, exactly which condition is still missing.

**Why this priority**: Completes the PRD §7 lifecycle ("Financial Closure → Completed") but depends
on pricing (051) and finance (052) data, which may arrive later.

**Independent Test**: With a fully delivered, fully priced Order and a zero remaining balance,
trigger closure and confirm every delivered Work Item becomes completed; with a remaining balance
and no credit, confirm closure is refused naming "unpaid balance".

**Acceptance Scenarios**:

1. **Given** an Order meeting all four closure conditions, **When** closure is evaluated (after the
   last delivery, a resolution, a payment, or on request), **Then** every delivered Work Item
   becomes completed in one step and the closure is audited.
2. **Given** a delivered Order with a remaining balance and no approved credit, **When** closure is
   evaluated, **Then** nothing changes and the Order shows "unpaid balance" as the missing
   condition.
3. **Given** a delivered Order with an open discrepancy, **When** closure is evaluated, **Then**
   nothing changes and the Order shows "open discrepancy" as the missing condition.
4. **Given** an attempt to move a delivered Work Item to completed through the central workflow
   transition directly while a closure condition is unmet, **Then** it is refused.

---

### User Story 8 - Management gets the loss history (Priority: P3)

The Admin/Owner can retrieve every discrepancy with its type, quantity, cause, department, material,
product type, responsible employee and resolutions, filtered by date range, so the management
dashboard (090) can compute waste, damage and missing percentages, reprint frequency and loss by
department, material and employee (PRD §21, §32 Quality).

**Why this priority**: The data is captured by US2–US5; this story only exposes it for analytics,
which the dashboard feature (090) builds on later.

**Independent Test**: Record discrepancies across two departments and two date ranges; query for
one date range and confirm only matching discrepancies return, each with its resolutions and
expected quantity.

**Acceptance Scenarios**:

1. **Given** discrepancies recorded on different days, **When** the Admin/Owner requests a date
   range, **Then** only discrepancies in that range are returned, each with its resolutions.
2. **Given** a user without the report permission, **When** they request the history, **Then** the
   request is refused.

---

### Edge Cases

- Production reports more units than expected (over-run): accepted may not exceed the expected
  quantity; the surplus is noted in the receipt notes and is not a discrepancy.
- Produced quantity lower than expected: the shortfall must still be counted into missing (as
  "Short-produced" or "Missing") so the four quantities add up to the expected quantity.
- All units rejected at receipt (accepted = 0): the Work Item still becomes ready for collection so
  its lifecycle can continue; it is shown as "nothing to hand over" and, when delivered, records a
  delivered quantity of 0. Its customer-facing replacement travels as the linked reprint Work Item.
- A Work Item is cancelled while waiting in the collection queue: it leaves the queue (cancellation
  is owned by 011) and is ignored by grouped-mode readiness and by closure.
- Two employees submit a receipt for the same Work Item at the same moment: the first wins; the
  second is refused because the Work Item is no longer waiting to be received.
- Two employees record delivery of the same Work Item at once: the first wins; the second is
  refused and no second delivery record exists.
- A reprint of a reprint: allowed — the new Work Item links to the Work Item it replaces (the
  reprint), so the full chain back to the original remains traceable.
- The pricing or finance feature is not yet connected: delivery is refused with "pricing
  unresolved — pricing module not connected", and the balance area shows "finance not connected";
  closure is refused. Nothing is bypassed.
- Pricing changes from resolved back to pending between opening the delivery screen and submitting:
  the server re-checks at submission and refuses.
- A monetary resolution (Credit / Price adjustment) is recorded but not yet applied by pricing or
  finance: the Order cannot close until pricing reports resolved and finance reports the balance
  settled — this feature never applies money itself.
- A recorded resolution was a mistake: resolutions are never edited or deleted in V1; the mistake is
  corrected by an Admin through an explicit, audited action outside this feature (see Assumptions).
- Delivery date-time entered in the past (paperwork entered after the fact): allowed if not in the
  future and not before the Work Item was received; the system also stores when it was actually
  recorded.

## Requirements *(mandatory)*

### Functional Requirements

**Collection queue (PRD §19)**

- **FR-001**: System MUST provide a collection queue listing every Order that has at least one Work
  Item in `PRODUCTION_COMPLETED`, grouped by Order, showing order number, customer, order mode,
  priority, the Work Items waiting to be received, and the states of the Order's other Work Items.
- **FR-002**: The collection queue MUST sort urgent Orders first, then by how long the Order's
  earliest waiting Work Item has waited (oldest first), and MUST be paginated.
- **FR-003**: System MUST provide a delivery queue listing every Order with at least one Work Item in
  `READY_FOR_COLLECTION`, showing whether the Order is "ready for customer" (FR-019) and, per Order,
  its pricing status summary.

**Receiving and counting (PRD §19, §20)**

- **FR-004**: The receive screen MUST show, for a Work Item, its expected quantity (the
  specification quantity, or the produced quantity when the specification has none — labelled as
  such), the produced quantity reported by production, and inputs for accepted, damaged, missing
  and waste quantities.
- **FR-005**: System MUST reject, on the server, any receipt whose accepted + damaged + missing +
  waste does not equal the expected quantity, or where any quantity is negative or not a whole
  number.
- **FR-006**: System MUST require that every non-accepted unit in a receipt is classified by
  discrepancy lines: the damaged, missing and waste counts MUST each equal the sum of the
  quantities of the discrepancy lines of the matching kind (FR-009).
- **FR-007**: A successful receipt MUST move the Work Item from `PRODUCTION_COMPLETED` to
  `READY_FOR_COLLECTION` through the central workflow transition, in the same atomic step as storing
  the receipt, its discrepancies and their audit events.
- **FR-008**: Receipt counts MUST be append-only: any later change to the counts (FR-012) creates a
  new receipt revision; earlier revisions remain retrievable and are never edited or deleted.

**Discrepancies (PRD §20, §55 Rule 7)**

- **FR-009**: Each discrepancy MUST record: type (one of Damaged, Waste, Missing, Short-produced,
  Incorrectly produced, Customer rejection), quantity (positive whole number), cause (from the
  configured cause list), the responsible employee (optional), the responsible department (defaults
  to the Work Item's production department), the recording employee, timestamp, and notes. Types
  count against quantities as follows: Damaged, Incorrectly produced and Customer rejection count
  as "damaged" (present but unusable); Missing and Short-produced count as "missing"; Waste counts
  as "waste".
- **FR-010**: A discrepancy MAY carry optional voice-note, image and file attachments, stored as
  private files through the shared files feature (050) and linked to the discrepancy.
- **FR-011**: Discrepancy types MUST be restricted by the Work Item's state: at receipt — all types
  except Customer rejection; while `READY_FOR_COLLECTION` — Damaged, Missing, Incorrectly produced,
  Customer rejection; while `DELIVERED` (Order not yet closed) — Customer rejection only; any other
  state — refused.
- **FR-012**: A discrepancy recorded while a Work Item is `READY_FOR_COLLECTION` MUST NOT exceed the
  current accepted quantity and MUST create a new receipt revision that moves that quantity from
  accepted into the matching count, keeping the four quantities equal to the expected quantity. A
  customer rejection recorded while `DELIVERED` MUST NOT exceed the delivered quantity and does not
  change any receipt or delivery record.
- **FR-013**: Discrepancy causes MUST be Admin-configured data (add, rename, deactivate — never
  delete), seeded with a default list; deactivated causes remain on historical records.

**Compensation / resolution (PRD §21)**

- **FR-014**: System MUST let an authorized user record resolutions against a discrepancy, each with
  a kind (Reprint, Replacement in next order, Credit, Price adjustment, Customer accepts shortage,
  Other), quantity, mandatory reason, and optional notes; Credit and Price adjustment MUST also carry
  a positive monetary amount (EGP), and other kinds MUST NOT.
- **FR-015**: The total quantity of a discrepancy's resolutions MUST NOT exceed the discrepancy's
  quantity; a discrepancy is "open" until its resolutions cover its full quantity, and "resolved"
  after. Resolutions are append-only.
- **FR-016**: Recording a Credit or Price adjustment resolution MUST require the Admin/Owner
  override permission; other kinds require the collection permission. Recording a monetary
  resolution MUST publish a notice that the pricing (051) and finance (052) features can act on;
  this feature MUST NOT change any price, payment or balance itself.

**Reprint (PRD §21)**

- **FR-017**: A Reprint resolution MUST, in the same atomic step, create a new Work Item in the same
  Order with the reprinted quantity, a copy of the original's descriptive specification and
  production department, no design or review requirement, linked to the Work Item it replaces and
  to the resolution; and MUST move it into the production queue (`READY_FOR_PRODUCTION`) through the
  central workflow transition. Production MUST be able to download the approved file of the Work
  Item it replaces from the reprint's job card.
- **FR-018**: Neither the original Work Item's nor the reprint's history (transitions, receipts,
  discrepancies, resolutions, audit events) may be altered by creating the reprint; both MUST be
  retrievable, and the link MUST be navigable in both directions.

**Readiness and notification (PRD §4.3, §19, §37, §38)**

- **FR-019**: "Ready for customer" MUST be determined per Work Item for separate-mode Orders (the
  Work Item is `READY_FOR_COLLECTION`) and per Order for grouped-mode Orders (every non-cancelled Work
  Item is `READY_FOR_COLLECTION` or `DELIVERED`, and at least one is `READY_FOR_COLLECTION`),
  derived at read time from Work Item states and the Order's existing mode, never stored.
- **FR-020**: When a Work Item (separate mode) or an Order (grouped mode) becomes ready for customer,
  the system MUST record, in the same atomic step, one customer "ready for collection" notification
  request for the WhatsApp feature (054) to deliver, and one internal "order ready" notice to the
  configured internal recipients (default Reception). It MUST NOT record a duplicate while the Order
  stays ready.
- **FR-021**: When a single receipt or later discrepancy makes a Work Item's non-accepted quantity
  reach or exceed the configured major-discrepancy percentage of its expected quantity (default
  10%), the system MUST record a "major discrepancy" notice to the configured recipients (default
  Admin/Owner). The percentage and recipients MUST be Admin-configurable.

**Delivery and the pricing gate (PRD §22, §55 Rule 10, constitution II)**

- **FR-022**: System MUST let an authorized user record a hand-over of one or more of an Order's
  `READY_FOR_COLLECTION` Work Items, capturing who handed over (defaults to the recording user; may
  be another active staff user, e.g. a courier colleague), who received (name required, phone
  optional), date-time (defaults to now; not in the future; not before the Work Item's receipt),
  and optional notes. Each delivered Work Item's delivered quantity MUST be its current accepted
  quantity, determined by the server.
- **FR-023**: Each delivered Work Item MUST move from `READY_FOR_COLLECTION` to `DELIVERED` through
  the central workflow transition; all Work Items in one hand-over MUST be delivered together or not
  at all; a Work Item MUST NOT be delivered twice.
- **FR-024**: Partial delivery (fewer than all of the Order's non-cancelled Work Items) MUST be
  allowed freely for separate-mode Orders and MUST require an explicit partial flag and reason for
  grouped-mode Orders. The system MUST record whether each hand-over was partial.
- **FR-025**: The transition of any Work Item to `DELIVERED` MUST be refused while its pricing is
  unresolved, by a guard registered on the central workflow transition itself (not only by the
  delivery screen), so that every path — including direct server calls — is gated. Urgent priority
  MUST NOT skip this guard. The refusal MUST surface to the caller as `PRICING_UNRESOLVED` with the
  affected Work Items, how long each has waited for pricing, and who is responsible for pricing it.
- **FR-026**: Pricing status MUST be read from the pricing feature (051); until 051 is connected the
  gate MUST treat pricing as unresolved (fail closed).
- **FR-027**: The delivery screen MUST show the Order's total, paid and remaining amounts and whether
  the customer is covered by approved credit, read from the finance feature (052); an unpaid
  balance MUST NOT block delivery. When finance is not connected, the screen MUST say so.

**Financial closure (PRD §7, §22)**

- **FR-028**: System MUST move all of an Order's `DELIVERED` Work Items to `COMPLETED` together, in
  one atomic step, when and only when all closure conditions hold: every non-cancelled Work Item is
  `DELIVERED`; pricing is resolved for every non-cancelled Work Item; no discrepancy on the Order is
  open; and the remaining balance is zero or less, or the Order is covered by approved credit.
- **FR-029**: Closure MUST be re-evaluated automatically after each delivery and each discrepancy
  resolution, MUST be invocable by the finance feature (052) after a payment, and MUST be requestable
  manually; each evaluation MUST report which conditions are unmet.
- **FR-030**: The `DELIVERED → COMPLETED` transition MUST be refused by a guard on the central
  workflow transition whenever a closure condition is unmet, so no path can complete a Work Item
  early.

**Cross-cutting (constitution III, V)**

- **FR-031**: Every receipt, receipt revision, discrepancy, resolution, reprint creation, delivery,
  closure and configuration change MUST write an audit event (actor, action, entity, timestamp,
  before/after, reason) in the same atomic step as the change.
- **FR-032**: Every action MUST be authorized on the server: receiving, recording discrepancies and
  non-monetary resolutions require the collection permission; recording deliveries requires the
  delivery permission; monetary resolutions require the Admin/Owner override permission;
  configuration requires the Admin configuration permission; loss-history reports require the
  audit-view permission.
- **FR-033**: No operational record in this feature (receipts, discrepancies, resolutions,
  deliveries) may be edited in place or hard-deleted by any user.
- **FR-034**: System MUST expose the discrepancy history (FR-009 fields, expected quantity,
  resolutions, product type, material, department) filtered by date range and optionally by
  department, paginated, for the management dashboard (090).

### Key Entities

- **Production Receipt**: one revision of the counted quantities for a Work Item — expected,
  produced (as reported by production), accepted, damaged, missing, waste, notes, who received and
  when; revisions are numbered and the latest is current.
- **Discrepancy**: one classified loss against a Work Item — type, quantity, cause, responsible
  employee/department, recording employee, timestamp, notes, attachments; links to the receipt
  revision it produced (if any).
- **Discrepancy Cause**: Admin-configured cause category (e.g. machine fault, material defect,
  operator error, handling, file/design error, vendor, other).
- **Compensation (Resolution)**: how some quantity of a discrepancy was resolved — kind, quantity,
  amount (monetary kinds), reason, notes, who and when; a Reprint resolution links to the Work Item
  it created.
- **Delivery (Hand-over)**: one hand-over event for an Order — handed over by, received by
  name/phone, date-time, partial flag and reason, notes, recorded by; with one line per delivered
  Work Item and its delivered quantity.
- **Collection Policy**: Admin-configured settings for this feature — major-discrepancy percentage,
  major-discrepancy recipients, ready-notice recipients.
- **Work Item** (existing, 002/011/014): gains a link to the Work Item it reprints; reaches
  `READY_FOR_COLLECTION`, `DELIVERED` and `COMPLETED` through this feature.
- **Order** (existing, 011): its existing grouped/separate mode drives readiness; its derived status
  reflects delivery and completion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A collection employee can find a waiting Order and finish receiving one Work Item with
  no discrepancies in under 60 seconds from opening the queue.
- **SC-002**: 100% of stored receipts have accepted + damaged + missing + waste equal to the
  expected quantity; zero mismatching receipts can be stored through the screen or a direct server
  call.
- **SC-003**: 100% of delivery attempts on Work Items with unresolved pricing are refused, including
  urgent orders and direct server calls — zero Work Items reach delivered with unresolved pricing.
- **SC-004**: 100% of discrepancies, resolutions, receipts, deliveries and closures have a matching
  audit event naming the responsible employee.
- **SC-005**: Every non-accepted unit in every receipt is attributed to a discrepancy type and cause
  (0 unclassified units), so waste, damage and missing percentages per department and material can
  be computed from stored data alone.
- **SC-006**: For every reprint, both the original and the reprint Work Item can be traced to each
  other and their complete histories retrieved in a single lookup each.
- **SC-007**: Exactly one customer "ready for collection" notification request is recorded per time
  an Order (grouped) or Work Item (separate) becomes ready — no duplicates, no misses.
- **SC-008**: No Order becomes completed while it has an undelivered item, unresolved pricing, an
  open discrepancy, or an unpaid balance without approved credit.

## Assumptions

- Roles and permissions come from 001 unchanged: the seeded Print Reception/Delivery role already
  holds "collection.receive" and "delivery.record"; Admin/Owner holds every permission including
  "admin.override", "admin.config" and "audit.view". No new permission key is introduced.
- Pricing (051), finance (052), files/attachments (050) and WhatsApp (054) are not built yet. This
  feature depends on each through a narrow interface it defines; until each is connected the
  feature behaves safely (fail closed for pricing and closure, "not connected" for balance, no
  attachments for discrepancies, customer notifications queued in the existing outbox for 054 to
  deliver later). The exact interfaces are cross-team contracts with the Track B owner (see
  plan.md).
- Order mode (grouped/separate) is the existing Order field set at order creation (011); this
  feature does not change it.
- Loss by machine (PRD §21) is out of scope: 014 routes to departments, not machines. Loss by
  department, material, product type and employee is supported.
- Correcting a mistaken receipt count uses a new revision (FR-012 for reductions of accepted).
  Correcting a mistaken resolution or increasing the accepted quantity after receipt is out of scope
  for V1 and requires an explicit Admin action outside this feature.
- Out of scope: recording payments (052); applying price changes from price adjustments (051);
  applying customer credit (052); WhatsApp sending mechanics and templates (054); loss analytics
  dashboards and aggregates (090); delivery by courier/shipping tracking; post-closure complaints.
