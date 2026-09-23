# Research: Customer Finding & Management

## Decision: Extend the existing Customer model with normalized phone/name search fields and related records

**Rationale**: `prisma/schema/core.prisma` already owns `Customer` and the required Order relationship. Adding customer-owned fields and separate phone/address/classification records preserves the canonical Order → Customer model, supports multiple phones and addresses, and keeps classification configurable.

**Alternatives considered**: A parallel customer model was rejected because it would violate the shared domain ownership and create ambiguous Order relationships. Storing alternate phones or addresses as unstructured JSON was rejected because uniqueness, search indexing, and targeted audit changes require queryable records.

## Decision: Normalize Egyptian phones at the server boundary and enforce uniqueness in persistent storage

**Rationale**: All accepted forms (`01...`, `+201...`, `00201...`, spaces, dashes) must resolve to one E.164 value before lookup or persistence. A unique normalized-phone constraint makes concurrent duplicate creation deterministic and supports the hard-block policy.

**Alternatives considered**: Client-only normalization was rejected because the server is authoritative. Search-time-only normalization was rejected because it cannot reliably enforce uniqueness under concurrent writes.

## Decision: Store a normalized Arabic search name separately from the display name

**Rationale**: Search normalization must map `أ/إ/آ → ا`, `ة ↔ ه`, `ى ↔ ي`, and strip tashkeel without altering the customer's displayed name. A persisted normalized value supports indexed prefix/contains search and predictable performance at 50,000 customers.

**Alternatives considered**: Mutating the display name was rejected because legal/customer-entered spelling must remain visible. Recomputing complex normalization only in the UI was rejected because all search entry points must behave consistently.

## Decision: Use server-side service/action boundaries with existing Result, typed errors, auth, and audit primitives

**Rationale**: The repository already uses `Result<T, DomainError>` and server-authority conventions. Customer operations should validate input, authorize `customer.manage`, perform atomic mutations, and call `audit.record` in the same transaction where applicable.

**Alternatives considered**: Client-side mutation and ad hoc thrown errors were rejected by Constitution Principles III and V.

## Decision: Treat Cash Customer as a seeded immutable record and promotion as an explicit audited reassignment

**Rationale**: Orders must always have a Customer, including walk-ins. A protected seeded record preserves traceability; promotion creates a normal customer and only re-links explicitly selected orders. Admin reversal is modeled as another audited mutation, never deletion.

**Alternatives considered**: Creating anonymous/null customers was rejected because Orders may never have a null customer. Re-linking all Cash Customer orders automatically was rejected because it would change unrelated history.

## Decision: Keep duplicate merging out of V1

**Rationale**: Hard-blocking duplicate phones prevents the primary source of new duplicates. Deferring merge avoids high-risk historical reassignment semantics while leaving a future audited workflow possible.

**Alternatives considered**: Including Admin merge/reversal in V1 was rejected as unnecessary scope and additional irreversible-data risk.

## Decision: Reception may edit all customer fields except archive and promotion; Admin is required for those actions

**Rationale**: This matches the clarified operating model while keeping destructive/lifecycle-sensitive actions elevated and auditable.

**Alternatives considered**: Restricting ordinary contact edits to Admin would slow counter work without improving the stated V1 workflow.

## Decision: Keep profile slots and CustomerPicker as stable UI contracts, not feature implementations owned by order entry

**Rationale**: 011 needs a fast selection/create flow and a returned `customerId`; 051, 052, and 054 need reserved profile extension points. Explicit contracts allow parallel work without coupling internal customer management details.

**Alternatives considered**: Embedding customer persistence inside the order form was rejected because it duplicates business rules and violates the feature boundary.
