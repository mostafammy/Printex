# Data Model: Order Production Workflow (Phase 1)

Source: [spec.md](spec.md) · Decisions: [research.md](research.md). All changes additive; existing tables/columns untouched except new nullable fields and new tables.

## Extended: WorkItem (core.prisma, additive fields)

| Field | Type | Notes |
|---|---|---|
| customerWidthCm | Decimal(10,2)? | Original requested width, never overwritten |
| productionWidthCm | Decimal(10,2)? | Canonical round-up result; set server-side |
| heightM | Decimal(10,2)? | Canonical metres; validated 0 < h ≤ configured max (50) |
| productionAreaM2 | Decimal(12,4)? | Derived `prodWidthM × heightM × qty`, stored snapshot |
| basePricePerM2 | Decimal(12,2)? | Frozen per-item rate, validated 80–120 for roll class |
| baseTotal | Decimal(12,2)? | Frozen `area × baseRate` snapshot |
| finishingTotal | Decimal(12,2)? | Frozen Σ finishing snapshot |
| finalTotal | Decimal(12,2)? | Frozen `base + finishing`, whole-EGP rounding |
| designerCompletedAt | DateTime? | Set on valid designer completion |
| designerFileVersionId | String? | DesignVersion id satisfying the file gate |
| accountantApprovedAt | DateTime? | Set on accountant approval |
| accountantApprovedById | String? → User | Approver ref |

Existing `widthValue/heightValue/dimensionUnit` (011) remain for legacy items; new canonical fields are populated for roll-class items and backfilled where unambiguous. Validation: `productionWidthCm` must equal `resolveProductionWidth(customerWidthCm)`; `productionAreaM2` must equal recomputation — enforced in transition/quote functions, not just schema.

State: reuse `WorkItemState` (no new enum). Pipeline milestone is a derived view over state + presence fields (see research R-05).

## New: FinishingService (config data, Constitution VI)

| Field | Type | Notes |
|---|---|---|
| id | String PK | cuid |
| code | String unique | e.g. `SULFAN` |
| labelAr / labelEn | String | Localized display |
| ratePerM2 | Decimal(12,2) | e.g. 90 EGP; effective-dated |
| effectiveFrom / effectiveTo | DateTime / DateTime? | Historical retention |
| status | ACTIVE / RETIRED | Never hard-deleted |
| productClass | String | e.g. `ROLL`; scopes 80–120 rule |

## New: WorkItemFinishing (per-item frozen snapshot)

| Field | Type | Notes |
|---|---|---|
| id | String PK | |
| workItemId → WorkItem | FK | |
| finishingServiceId → FinishingService | FK | |
| ratePerM2 | Decimal(12,2) | Frozen at selection time |
| amount | Decimal(12,2) | Frozen `area × rate` |
| createdBy / createdAt | User / DateTime | Audit link |

Current selection = rows not superseded; price change writes new rows + new WorkItemPrice, never updates.

## New: WidthExceptionTicket

| Field | Type | Notes |
|---|---|---|
| id | String PK | |
| workItemId → WorkItem | FK, unique open | One open ticket per item |
| requestedWidthCm | Decimal(10,2) | The >320 value |
| reason | String | Required |
| status | PENDING / APPROVED / REJECTED | |
| requestedBy / decidedBy | User refs | |
| decidedAt | DateTime? | |

Item stays in reception while PENDING; APPROVED with a manager-set custom width is audited and still stores both customer and authorized production widths distinctly.

## Config: RollProductConstraints (seed/config row or YAML)

`productionWidthsCm = [80,110,150,210,260,270,320]`, `minBaseRate = 80`, `maxBaseRate = 120`, `maxHeightM = 50`, scoped by productClass `ROLL`. Loaded at startup, validated, admin-editable with audit.

## Relations & integrity

- WorkItem 1—N WorkItemFinishing, WorkItemPrice (existing), WidthExceptionTicket (0—1 open).
- FinishingService N—N WorkItems via WorkItemFinishing snapshots.
- All pipeline transitions write WorkItemTransition + audit in the same tx (existing table reused).
- File gate references DesignVersion (012) and/or FileVersion APPROVED category (050); completion stores the satisfying version id.
- Returns reuse existing Return model (origin/category/assignee/reason).

## Migration sketch (plan-time detail for tasks.md)

1. Additive migration: new columns nullable + 3 new tables + indexes (`[state]`, `[assigneeId,state]` already exist; add `[productionWidthCm]`, finishing lookups, open-ticket partial unique).
2. Backfill: map existing states to milestones; freeze current quote totals into snapshot columns where computable; leave legacy dimension columns intact.
3. Seed: width table, 80–120 constraint, Sulfan 90, 50 m cap for ROLL class.
4. Verify: rounding/area/total recomputation matches stored snapshots for backfilled rows; audit event written for the migration itself.
