# Phase 1 Data Model: Core Domain & Shell

Source: [spec.md](./spec.md) Key Entities + Functional Requirements, resolved against
[research.md](./research.md). This is the authoritative shape for `prisma/schema/core.prisma`.

## Entities

### Department

Admin-configured production department (Digital, Banner, Outdoor, Laser, External, …), per
constitution VI — data, not an enum.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | unique |
| isActive | Boolean | default true; Admin can retire without deleting (history stays intact) |
| createdAt | DateTime | |

### Customer

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | |
| isCashCustomer | Boolean | default false; exactly one row has this true (seeded, not user-creatable) |
| createdAt | DateTime | |
| orders | Order[] | relation |

*Full customer profile fields (phone, address, pricing tier, etc.) belong to 010 — this feature
only defines the base shape 010 extends via Prisma model composition in a later migration.*

### Order

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| number | Int | unique; DB sequence, ever-increasing, no reset, no prefix (FR-008a) |
| customerId | String | FK → Customer, required (constitution I: every Order belongs to a Customer or Cash Customer) |
| channel | OrderChannel (enum) | WALK_IN \| WHATSAPP \| PHONE \| RETURNING \| DIRECT_TO_DESIGNER |
| priority | OrderPriority (enum) | NORMAL \| URGENT |
| mode | OrderMode (enum) | GROUPED \| SEPARATE |
| createdById | String | FK → User (from 001) |
| createdAt | DateTime | |
| workItems | WorkItem[] | relation |

Status is **not** a column — see [contracts/orders.md](./contracts/orders.md#deriveorderstatus).

### WorkItem

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| orderId | String | FK → Order, required |
| productTypeId | String? | FK reference only; catalog owned by 011 (Assumptions) |
| departmentId | String? | FK → Department; nullable until routed |
| state | WorkItemState (enum) | one of the 15 states below; written **only** by `transitionWorkItem` |
| requiresDesign | Boolean | default true |
| requiresReview | Boolean | default true |
| assigneeId | String? | FK → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| transitions | WorkItemTransition[] | relation |
| phaseTimings | PhaseTiming[] | relation |

### WorkItemTransition

Immutable — application code never updates or deletes a row here (constitution III).

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| workItemId | String | FK → WorkItem |
| from | WorkItemState | |
| to | WorkItemState | |
| actorId | String | FK → User |
| at | DateTime | default now() |
| reason | String? | required by the caller for REWORK_REQUIRED and CANCELLED edges (enforced in `transitionWorkItem`, not the schema) |
| rejectionCategory | RejectionCategory? (enum) | set only on edges landing in REWORK_REQUIRED; drives the landing-state choice (FR-003b) |
| meta | Json? | free-form, e.g. links a rejection's attachments |

### PhaseTiming

Timestamped segments, not a stopwatch (constitution III, FR-009).

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| workItemId | String | FK → WorkItem |
| phase | WorkItemState | which state this timing segment belongs to |
| userId | String? | FK → User; null for QUEUE segments (nobody "actively" queues) |
| kind | PhaseTimingKind (enum) | QUEUE \| ACTIVE |
| startedAt | DateTime | |
| endedAt | DateTime? | null while the segment is open; pausing sets this, and resuming starts a new segment (spec FR-009, `/speckit-clarify` timer decision) |

A phase's total queue/active duration = `sum(endedAt - startedAt)` over its segments, with an open
segment (`endedAt = null`) contributing `now() - startedAt` when displayed.

### NotificationEvent (Outbox)

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| type | String | event type discriminator, e.g. `"work_item.rejected"` |
| entityType | String | e.g. `"WorkItem"` |
| entityId | String | |
| recipientUserIds | String[] | |
| recipientRoles | String[] | |
| recipientDepartmentIds | String[] | |
| payload | Json? | |
| createdAt | DateTime | default now() |
| deliveredAt | DateTime? | left null; written by 053 |
| deliveryStatus | String? | left null; written by 053 |

## Enums

```text
WorkItemState:
  NEW, ASSIGNED, IN_DESIGN, DESIGN_COMPLETED, WAITING_REVIEW, REWORK_REQUIRED, APPROVED,
  WAITING_PRICING, READY_FOR_PRODUCTION, IN_PRODUCTION, PRODUCTION_COMPLETED,
  READY_FOR_COLLECTION, DELIVERED, COMPLETED, CANCELLED

OrderChannel:      WALK_IN, WHATSAPP, PHONE, RETURNING, DIRECT_TO_DESIGNER
OrderPriority:     NORMAL, URGENT
OrderMode:         GROUPED, SEPARATE
PhaseTimingKind:   QUEUE, ACTIVE
RejectionCategory: DESIGN_ISSUE, DIMENSION_ISSUE, CUSTOMER_CHANGE, PRICING_ISSUE,
                   ACCOUNTING_ISSUE, PRODUCTION_ISSUE, MISSING_INFORMATION, OTHER
```

## Allowed-Edges Table (authoritative)

Terminal states (no outgoing edges): **COMPLETED**, **CANCELLED**.
"Non-terminal" for the purposes of the CANCELLED rule (FR-003a) = every state except DELIVERED,
COMPLETED, CANCELLED — i.e. DELIVERED itself cannot be cancelled (PRD §22's delivery gate is meant
to be the last checkpoint before a job is considered final-in-practice).

| From | To | Condition |
|---|---|---|
| NEW | ASSIGNED | default (requiresDesign = true) |
| NEW | READY_FOR_PRODUCTION | skip path: requiresDesign = false |
| NEW | CANCELLED | — |
| ASSIGNED | IN_DESIGN | — |
| ASSIGNED | CANCELLED | — |
| ASSIGNED | REWORK_REQUIRED | *incoming* — reachable target of a reassignment-category rejection (see REWORK_REQUIRED rows below); not a forward edge from ASSIGNED itself |
| IN_DESIGN | DESIGN_COMPLETED | — |
| IN_DESIGN | CANCELLED | — |
| DESIGN_COMPLETED | WAITING_REVIEW | default (requiresReview = true) |
| DESIGN_COMPLETED | APPROVED | skip path: requiresReview = false |
| DESIGN_COMPLETED | CANCELLED | — |
| WAITING_REVIEW | APPROVED | Head Designer approves |
| WAITING_REVIEW | REWORK_REQUIRED | Head Designer rejects; rejectionCategory required |
| WAITING_REVIEW | CANCELLED | — |
| REWORK_REQUIRED | IN_DESIGN | default landing (rejectionCategory ≠ one that implies reassignment) |
| REWORK_REQUIRED | ASSIGNED | landing when rejectionCategory implies reassignment is needed |
| REWORK_REQUIRED | CANCELLED | — |
| APPROVED | WAITING_PRICING | pricing not yet resolved (entered per a pricing-feature guard, not hardcoded here — research.md §3) |
| APPROVED | READY_FOR_PRODUCTION | default; open unless a later feature registers a guard blocking it |
| APPROVED | CANCELLED | — |
| WAITING_PRICING | READY_FOR_PRODUCTION | pricing resolved |
| WAITING_PRICING | CANCELLED | — |
| READY_FOR_PRODUCTION | IN_PRODUCTION | — |
| READY_FOR_PRODUCTION | CANCELLED | — |
| IN_PRODUCTION | PRODUCTION_COMPLETED | — |
| IN_PRODUCTION | CANCELLED | — |
| PRODUCTION_COMPLETED | READY_FOR_COLLECTION | — |
| PRODUCTION_COMPLETED | CANCELLED | — |
| READY_FOR_COLLECTION | DELIVERED | pricing-before-delivery guard (051, future) runs here |
| READY_FOR_COLLECTION | CANCELLED | — |
| DELIVERED | COMPLETED | financial closure |

Every other (from, to) pair — including any edge into NEW, any edge out of COMPLETED/CANCELLED,
and any edge not listed above — is **forbidden** and MUST raise `INVALID_TRANSITION`. This is the
literal source data for the required 15×15 table-driven test (spec Acceptance / SC-001).

## Order Status Derivation (bucket rule, from `/speckit-clarify`)

Buckets, in "how far behind" order: `NOT_STARTED < IN_PRODUCTION < PARTIALLY_READY < DELIVERED <
COMPLETED`; `CANCELLED` is a separate terminal override.

```text
if any Work Item is CANCELLED and ALL Work Items are CANCELLED → CANCELLED
else if ALL Work Items are COMPLETED                            → COMPLETED
else if ALL Work Items are DELIVERED or COMPLETED                → DELIVERED
else if ALL Work Items are one of {NEW, ASSIGNED} (nothing routed to production yet)
                                                                  → NOT_STARTED
else if ANY Work Item is IN_PRODUCTION and NONE are DELIVERED/COMPLETED
     and NOT ALL are pre-production                              → IN_PRODUCTION
else                                                              → PARTIALLY_READY
```

The exact boundary conditions above are pinned down as literal test cases in
`tests/unit/deriveOrderStatus.test.ts` (task-level detail), not repeated here to avoid two sources
of truth; this pseudocode is the spec for that test file.

## Relationships Summary

```text
Customer 1───* Order 1───* WorkItem 1───* WorkItemTransition
                                  │
                                  ├──* PhaseTiming
                                  └──? Department (nullable FK)

WorkItem/Order/etc. ──* NotificationEvent   (polymorphic via entityType/entityId, not a Prisma relation)
```
