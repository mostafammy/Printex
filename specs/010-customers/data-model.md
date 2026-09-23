# Data Model: Customer Finding & Management

## Existing model extension

### Customer

Extends `prisma/schema/core.prisma` model `Customer`; preserves the existing `Customer.id`, `name`, `isCashCustomer`, timestamps, and `orders` relation.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Existing immutable identifier. |
| `name` | text | Required display name; non-empty after trimming. |
| `normalizedName` | text | Derived search value; Arabic normalization: `أ/إ/آ → ا`, `ة ↔ ه`, `ى ↔ ي`, tashkeel removed. Indexed for search. |
| `isCashCustomer` | boolean | Exactly one seeded true record; protected server-side. |
| `nationalId` | text nullable | Optional; Reception may edit under clarified policy. Access must be authorized. |
| `classificationId` | ID nullable | Optional relation to configurable classification data. |
| `isArchived` | boolean | Default false; archive, not delete. Admin-only mutation. |
| `createdAt` / `updatedAt` | timestamp | UTC persistence. |

### CustomerPhone

One row per primary or alternate phone.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable identifier. |
| `customerId` | ID | Required Customer relation. |
| `phoneE164` | text | Required canonical Egyptian E.164 value; unique across all customers. |
| `kind` | `PRIMARY` / `ALTERNATE` | Exactly one primary phone per customer; one or more alternates allowed. |
| `createdAt` / `updatedAt` | timestamp | UTC persistence. |

A phone is normalized before validation, duplicate lookup, or persistence. Removing/changing a phone is audited as a Customer edit.

### CustomerAddress

Multiple optional addresses per customer.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable identifier. |
| `customerId` | ID | Required Customer relation. |
| `label` | text nullable | Optional label such as home or business. |
| `value` | text | Required address text. |
| `isDefault` | boolean | At most one default address per customer. |
| `createdAt` / `updatedAt` | timestamp | UTC persistence. |

### CustomerClassification

Configurable data, not an enum.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable identifier. |
| `name` | text | Required unique display name. |
| `isActive` | boolean | Inactive values remain on historical customers but are unavailable for new selection. |
| `createdAt` / `updatedAt` | timestamp | UTC persistence. |

Initial seed values: Individual, Company, Agency, VIP. Admin configuration may add, rename, deactivate, or reorder values according to the shared configuration policy.

### CustomerPromotion

Audited promotion/re-link operation.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable operation identifier. |
| `sourceCustomerId` | ID | Always Cash Customer. |
| `targetCustomerId` | ID | Newly created real Customer. |
| `orderIds` | ID list / relation | Explicitly selected orders only. |
| `performedById` | ID | Authorized actor. |
| `performedAt` | timestamp | UTC. |
| `reversedAt` / `reversedById` | nullable | Set only by Admin reversal. |
| `reason` | text | Required explanation for promotion/reversal. |

Reversal reassigns only orders recorded by this promotion. It succeeds only when every selected Order still belongs to the promoted customer; if any selected Order was reassigned afterward, the entire reversal is rejected with a conflict result and no Order is changed. An Admin must resolve the conflict through a separate audited action.

### CustomerAuditEvent

Uses existing append-only `audit.record` infrastructure. Each mutation records actor, action, entity/entity ID, timestamp, and before/after values. No update/delete path is exposed.

## Relationships

- Customer 1—many CustomerPhone.
- Customer 1—many CustomerAddress.
- Customer many—1 CustomerClassification (optional).
- Customer 1—many Order, inherited from core; every Order has exactly one Customer.
- CustomerPromotion links Cash Customer and target Customer and records selected Orders.
- Customer profile Orders tab reads active/completed Order records; Notes are customer-owned operational records or the project’s existing note abstraction.

## Invariants

1. Exactly one seeded Cash Customer exists; it cannot be edited, renamed, archived, or merged.
2. Every Order has a non-null Customer, including walk-in Orders.
3. Every Customer has at least one primary phone after creation; phone values are unique canonical E.164 strings.
4. Archived Customers remain queryable only through authorized history contexts and retain Orders/audit history.
5. Customer data mutations, archive, promotion, and promotion reversal are server-authorized and audited.
6. Customer merging is not part of V1.
