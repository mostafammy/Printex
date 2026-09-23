# Feature Specification: Customer Finding & Management

**Feature Branch**: `010-customers`
**Created**: 2026-09-23
**Status**: Draft
**Input**: User description: "PRI-7 — Spec & plan: 010-customers. Define phone-first customer finding and management, Cash Customer handling, customer profile, and CustomerPicker contracts."
**PRD References**: §4.1, §23, §33, §55 Rule 2

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the customer during intake (Priority: P1)

Reception staff can identify a customer quickly by entering a complete or partial Egyptian phone number. If no phone matches, they can search by a customer name, including common Arabic spelling variants, and select the correct record for the job.

**Why this priority**: Phone-first lookup is the first action on every job and prevents duplicate records and lost history.

**Independent Test**: Seed customers with primary and alternate phones and Arabic names, then verify search returns the right record for each phone and normalized name query.

**Acceptance Scenarios**:

1. **Given** a customer with a stored phone, **When** Reception enters any supported Egyptian representation of that phone, **Then** the customer appears in results.
2. **Given** a customer with an alternate phone, **When** Reception searches using that alternate, **Then** the same customer appears.
3. **Given** customers whose names include `أ`, `إ`, `آ`, `ة`, `ه`, `ى`, `ي`, or tashkeel, **When** Reception searches with normalized variants, **Then** the intended customer appears.
4. **Given** multiple partial matches, **When** Reception types more characters, **Then** results update as they type and remain keyboard navigable.

---

### User Story 2 - Create and maintain a customer record (Priority: P1)

An authorized staff member can create a customer with a name and phone, add useful optional details, and later edit the record. The system preserves an audit trail for every edit and archives records instead of deleting them.

**Why this priority**: Accurate customer data supports repeat work, operational communication, and reliable order history.

**Independent Test**: Create a customer, edit each supported field, inspect audit events for before/after values, then archive the record and verify it is absent from normal search while its history remains available.

**Acceptance Scenarios**:

1. **Given** a valid name and one valid phone, **When** an authorized user saves a new customer, **Then** the customer is created with a canonical phone and appears in search.
2. **Given** missing name or phone, **When** the user submits the form, **Then** creation is rejected with field-level validation and no partial record is created.
3. **Given** an existing customer, **When** an authorized user changes any editable field, **Then** one audit event records the actor, time, field, before value, and after value.
4. **Given** an active customer, **When** an authorized user archives them, **Then** the customer is hidden from default search, cannot receive new orders through normal selection, and retained orders/history remain viewable.
5. **Given** an archived customer, **When** an authorized user views historical data, **Then** the customer and associated order history remain identifiable.

---

### User Story 3 - Use the Cash Customer safely (Priority: P1)

Reception can assign walk-in orders to one built-in Cash Customer record without creating a fake customer for every walk-in. The record is protected from mutation. A later cash buyer can be promoted to a real customer, with selected past orders optionally re-linked in an audited and reversible operation.

**Why this priority**: Walk-in work must remain traceable while the protected shared record prevents accidental corruption.

**Independent Test**: Attempt every prohibited Cash Customer mutation, create a cash order, promote a buyer, re-link selected orders, and verify audit history and reversal permissions.

**Acceptance Scenarios**:

1. **Given** the seeded Cash Customer record, **When** a user attempts to edit, rename, archive, or merge it, **Then** the server rejects the action.
2. **Given** a walk-in order, **When** Reception assigns Cash Customer, **Then** the order remains individually identifiable in Cash Customer history.
3. **Given** a cash buyer who provides details later, **When** an authorized user promotes them, **Then** a new real customer is created and the original cash record is unchanged.
4. **Given** a promotion, **When** the user selects past Cash Customer orders to re-link, **Then** only selected orders move, the action is audited, and an Admin can reverse it.

---

### User Story 4 - Review a customer profile and select from order intake (Priority: P2)

Staff can open a customer profile showing overview, orders, and notes. The order form can embed a fast CustomerPicker that searches, creates a new customer inline, and returns a `customerId` without owning customer-management rules.

**Why this priority**: Profiles support context at the counter, while the picker keeps order intake fast and consistent for the consuming 011 feature.

**Independent Test**: Open an active and archived profile, verify tabs and empty extension slots, then exercise CustomerPicker search, keyboard selection, inline creation, and returned identifier.

**Acceptance Scenarios**:

1. **Given** an existing customer, **When** staff opens the profile, **Then** Overview, Orders (active/completed), and Notes tabs are available.
2. **Given** the profile, **When** staff views extension areas, **Then** empty slots exist for Payments & balance, Special pricing, and Messages without implementing those features.
3. **Given** the order form's CustomerPicker, **When** staff searches and selects a result, **Then** `onSelect` receives the selected `customerId`.
4. **Given** no matching customer, **When** staff chooses create new in the picker and supplies required fields, **Then** the new customer is created and its `customerId` is returned.
5. **Given** keyboard-only use, **When** staff navigates search results and confirms a selection, **Then** the picker works without a pointer.

### Edge Cases

- A phone with spaces, dashes, country-code prefixes, or invalid digits is normalized or rejected with a clear validation error; it must never create an ambiguous stored value.
- A customer may have multiple phones, but each stored phone belongs to at most one customer; a duplicate phone shows the existing customer and blocks new-customer creation.
- Search must not return archived customers by default; an explicit history/admin context may include them.
- A partial phone query that is too short or contains unsupported characters must not cause an unbounded result set; the user receives a useful prompt or bounded results.
- Name search must be accent/tashkeel tolerant without changing the displayed legal/customer name.
- Concurrent create attempts for the same phone must resolve consistently under the chosen duplicate policy.
- Cash Customer must remain available for order assignment even though it is excluded from normal customer mutation flows.
- Promotion must not silently re-link all historical orders; selection, authorization, audit, and reversal must be explicit.
- Unauthorized users must receive a permission error, not a record existence leak, for protected customer operations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept Egyptian phone input in `01xxxxxxxxx`, `+201xxxxxxxxx`, and `00201...` forms, including spaces and dashes, and MUST store one canonical E.164 representation.
- **FR-002**: System MUST expose `normalizePhone(raw)` that returns the canonical phone for valid input and a structured validation error for invalid or ambiguous input.
- **FR-003**: System MUST allow one customer to have one primary phone and zero or more alternate phones; search MUST match any stored phone.
- **FR-004**: System MUST provide search-as-you-type by complete or partial phone, with name fallback when phone matching is absent or insufficient.
- **FR-005**: Name search MUST normalize `أ`, `إ`, and `آ` to `ا`, treat `ة` and `ه` as equivalent, treat `ى` and `ي` as equivalent, and strip tashkeel for matching while preserving the original display name.
- **FR-006**: System MUST require name and one phone to create a customer; alternate phones, national ID, multiple addresses, notes, and classification MUST be optional.
- **FR-007**: System MUST make classification configurable data, with starter values such as Individual, Company, Agency, and VIP, rather than a fixed enum.
- **FR-008**: When creation includes a phone already associated with a customer, the system MUST show the existing customer and hard-block creation of another customer with that phone.
- **FR-009**: System MUST audit every customer edit with actor, timestamp, action, entity ID, and before/after values through `audit.record`.
- **FR-010**: System MUST seed exactly one built-in Cash Customer record and MUST reject server-side any attempt to edit, rename, archive, or merge it.
- **FR-011**: Orders assigned to Cash Customer MUST remain individually identifiable and retrievable in Cash Customer history.
- **FR-012**: System MUST support promotion of a cash buyer by creating a real customer and optionally re-linking explicitly selected past Cash Customer orders; the re-link MUST be audited, reversible by Admin, and MUST leave other cash orders unchanged.
- **FR-013**: System MUST provide a customer profile with Overview, Orders split into active/completed, and Notes tabs.
- **FR-014**: The profile MUST expose empty extension slots for Payments & balance (052), Special pricing (051), and Messages (054), without implementing those features here.
- **FR-015**: System MUST provide `<CustomerPicker>` for order intake with a search box, result list, inline create-new flow, keyboard-friendly interaction, and `onSelect` callback returning `customerId`.
- **FR-016**: System MUST archive customers rather than hard-delete them; archived records and order history MUST remain retrievable in authorized history contexts.
- **FR-017**: Every customer-management entry point MUST authenticate and authorize the caller using `authorize('customer.manage')`; enforcement MUST occur server-side.
- **FR-018**: Every external/client input MUST be validated at the server boundary, and failed mutations MUST make no partial changes.
- **FR-019**: Phone search MUST return a matching customer in under 300 ms with 50,000 seeded customers under representative operating conditions.
- **FR-020**: The feature MUST extend the Customer base model from 002 in `prisma/schema/core.prisma`; customer-owned related models MAY be defined in `prisma/schema/customer.prisma`, without redefining the shared ownership model.
- **FR-021**: The feature MUST expose `findCustomers(query)`, `getCustomer(id)`, `createCustomer(input)`, `normalizePhone(raw)`, `<CustomerPicker onSelect>`, and the profile tab slot API as stable contracts for consuming features.
- **FR-022**: Customer data MUST remain operational data owned by the application, not by Accounting; balances and payments remain owned by 052.
- **FR-023**: The classification starter list and field-level role permissions MUST be documented before implementation. Reception MAY edit all customer fields except archive and promotion; Admin authorization is required for archive and promotion.

### Out of Scope

- Special pricing rules (051)
- Balances and payments (052)
- WhatsApp conversations (054)
- Order creation form (011), except for the CustomerPicker contract
- Customer self-service portal
- Duplicate-customer merging in V1

### Key Entities

- **Customer**: A person or business owning orders; has display name, normalized search name, primary and alternate phones, optional national ID, multiple addresses, notes, configurable classification, archive state, and audit history.
- **Customer Phone**: A canonical E.164 phone associated with one customer as primary or alternate, used as a lookup key.
- **Customer Address**: An optional address entry; customers may have multiple addresses.
- **Cash Customer**: The single immutable built-in customer record used for walk-in orders.
- **Customer Promotion**: An audited action creating a real customer from a cash buyer and optionally re-linking selected orders, with Admin reversal support.
- **Customer Audit Event**: An immutable record of each customer mutation with before/after values and actor context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid supported Egyptian phone representations normalize to the same E.164 value in automated tests; invalid inputs are rejected without persistence.
- **SC-002**: In a representative dataset of 50,000 customers, at least 95% of phone searches return the matching customer in under 300 ms, including alternate-phone matches.
- **SC-003**: Arabic spelling variants defined in FR-005 return the same intended customer in 100% of acceptance tests while displayed names remain unchanged.
- **SC-004**: Reception can identify or create a customer from the CustomerPicker in under 30 seconds in at least 90% of observed first-attempt trials.
- **SC-005**: 100% of customer edits produce one retrievable audit event containing before and after values; no ordinary customer operation hard-deletes data.
- **SC-006**: 100% of Cash Customer edit, archive, rename, and merge attempts are rejected server-side, while all Cash Customer orders remain individually identifiable.
- **SC-007**: 100% of authorized promotion re-links are limited to selected orders, audited, and reversible by Admin; unrelated orders remain linked to Cash Customer.
- **SC-008**: A consuming order-entry implementation can select an existing customer or create a new one through the published CustomerPicker contract without depending on internal customer-management details.

## Assumptions

- The shared Customer and Order base model, authentication, authorization, and audit primitives from 001/002 exist or are supplied by their owning features.
- The canonical phone format is E.164 for Egypt (`+20` followed by the national number); local Egyptian mobile input is interpreted as an Egyptian mobile number.
- Search matching is case/diacritic tolerant, but the original customer name and phone presentation remain available for display.
- Normal customer search excludes archived records; authorized history views may include them.
- Reception operates under the `customer.manage` permission and may edit all customer fields except archive and promotion; Admin authorization is required for archive and promotion.
- Customer merge is not implemented in V1; no merge UI or server operation is planned.
- Addresses and notes are customer-owned operational data; payment, balance, pricing, and messaging slots are extension points only.
- The system is Arabic-first and RTL under Constitution Principle IX, with keyboard operation required for counter workflows.

## Clarifications

### Session 2026-09-23

- Q: When a new customer uses a phone already assigned to another customer, should creation be blocked or require explicit confirmation for a shared phone? → A: Hard-block creation and show the existing customer.
- Q: Should merging duplicate customer records be included in V1, or remain out of scope? → A: Keep customer merging out of scope for V1.
- Q: Which customer fields may Reception edit directly, and which fields require Admin authorization? → A: Reception may edit all customer fields except archive and promotion; Admin authorization is required for archive and promotion.

### Planning note

- Classification starter list remains configurable data; proposed initial values are Individual, Company, Agency, and VIP.
