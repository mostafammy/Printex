# Phase 1 Data Model: Orders & Reception

Source: [spec.md](./spec.md) Key Entities + Functional Requirements, resolved against
[research.md](./research.md). This extends `prisma/schema/core.prisma` (002's file) — no new
schema file, since these are additive fields on models 002 already owns plus one new model this
feature owns outright.

## Schema diff against `prisma/schema/core.prisma`

### New enum

```prisma
enum WorkItemDimensionUnit {
  MM
  CM
  M
  IN
}
```

### New model: ProductType

```prisma
/// Admin-configured product catalog (constitution VI: data, not an enum).
/// Owned by 011. Referenced by WorkItem.productTypeId and, later, by 051's
/// pricing rules (via pricingModeHint) — neither relation is declared on
/// this side beyond WorkItem's, to avoid coupling this model to a feature
/// (051) that doesn't exist yet.
model ProductType {
  id                     String      @id @default(cuid())
  name                   String      @unique
  defaultDepartmentId    String?
  defaultDepartment      Department? @relation(fields: [defaultDepartmentId], references: [id])
  defaultRequiresDesign  Boolean     @default(true)
  defaultRequiresReview  Boolean     @default(true)
  /// Free-form hint string for 051 to interpret (e.g. "FIXED" | "VARIABLE"
  /// | "QUOTE") — 011 stores it opaquely and does not validate its values
  /// against 051's vocabulary, since 051 doesn't exist yet (constitution:
  /// don't couple to an unbuilt feature's internals).
  pricingModeHint        String?
  isActive               Boolean     @default(true)
  createdAt              DateTime    @default(now())

  workItems WorkItem[]
}
```

### `Department` — add back-relation only

```prisma
model Department {
  // ...existing fields unchanged...
  productTypes ProductType[]   // NEW — back-relation for ProductType.defaultDepartmentId
}
```

### `Order` — additive fields

```prisma
model Order {
  id          String        @id @default(cuid())
  /// CHANGED: was a plain unique Int the application had to assign;
  /// research.md §1 — now a real Postgres sequence.
  number      Int           @unique @default(autoincrement())
  customerId  String
  customer    Customer      @relation(fields: [customerId], references: [id])
  channel     OrderChannel
  priority    OrderPriority
  mode        OrderMode
  /// NEW — FR-003a: optional order-level default due date; a Work Item's
  /// own dueDate (below) overrides this for that item only. Purely a
  /// display/default convenience — never read by transitionWorkItem or any
  /// gate.
  dueDate     DateTime?
  createdById String
  createdBy   User          @relation(fields: [createdById], references: [id])
  createdAt   DateTime      @default(now())

  workItems WorkItem[]
}
```

### `WorkItem` — additive fields + new relation

```prisma
model WorkItem {
  id              String       @id @default(cuid())
  orderId         String
  order           Order        @relation(fields: [orderId], references: [id])
  /// CHANGED: was FK-reference-only (no relation) since the catalog didn't
  /// exist yet — 011 now owns ProductType, so this becomes a real relation.
  productTypeId   String?
  productType     ProductType? @relation(fields: [productTypeId], references: [id])
  departmentId    String?
  department      Department?  @relation(fields: [departmentId], references: [id])
  state           WorkItemState
  requiresDesign  Boolean      @default(true)
  requiresReview  Boolean      @default(true)
  assigneeId      String?
  assignee        User?        @relation("WorkItemAssignee", fields: [assigneeId], references: [id])

  /// --- NEW fields, all owned by 011 (spec.md Key Entities) -------------
  /// One-line description — populated by Quick Create (FR-001); optional
  /// on the full form (product type + notes may be enough).
  description     String?
  quantity        Int?
  widthValue      Decimal?     @db.Decimal(10, 2)
  heightValue     Decimal?     @db.Decimal(10, 2)
  dimensionUnit   WorkItemDimensionUnit?
  material        String?
  finishNotes     String?
  /// Per-item due date override (FR-003a) — null means "use Order.dueDate".
  dueDate         DateTime?
  /// --- end NEW fields ----------------------------------------------------

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  transitions  WorkItemTransition[]
  phaseTimings PhaseTiming[]

  @@index([orderId, state])
}
```

All new `WorkItem` fields are nullable/optional — this preserves FR-006 ("department MUST be
settable but MAY be left unset") generalized to every descriptive field: Quick Create only ever
sets `description`, leaving the rest null until reception (or nobody) fills them in later, which is
exactly what `isOrderComplete()` (below) checks for.

## Derived rule: `isOrderComplete` (FR-002, Clarifications session 2026-09-23)

Pure function — no database access (research.md §4, same pattern as 002's `deriveOrderStatus`).

```ts
function isOrderComplete(order: {
  workItems: ReadonlyArray<{
    productTypeId: string | null;
    quantity: number | null;
    widthValue: unknown | null;
    heightValue: unknown | null;
    departmentId: string | null;
  }>;
}): boolean {
  return order.workItems.every(
    (wi) =>
      wi.productTypeId !== null &&
      wi.quantity !== null &&
      wi.widthValue !== null &&
      wi.heightValue !== null &&
      wi.departmentId !== null,
  );
}
```

An order with zero Work Items is not a reachable state through this feature (spec.md Edge Cases) —
`isOrderComplete` on an empty `workItems` array returns `true` (vacuous `every`) by construction,
but callers never encounter this because creation always produces at least one Work Item.

## "Finished order" rule (FR-011b — add-item eligibility)

Used by `addWorkItem` to decide whether to refuse (research.md's guard). Not a stored flag —
computed at call time from current Work Item states:

```ts
function isOrderFinished(workItems: ReadonlyArray<{ state: WorkItemState }>): boolean {
  return workItems.every((wi) => wi.state === "DELIVERED" || wi.state === "COMPLETED" || wi.state === "CANCELLED");
}
```

An order is "finished" (refuse new items) only when **every** Work Item has reached one of those
three terminal-ish states — matches Clarifications' "Yes, anytime the order isn't fully finished"
answer precisely: a single still-open item is enough to allow appending.

## Allowed edit window (FR-012/FR-012a — pre-design edit eligibility)

```ts
const PRE_DESIGN_EDITABLE_STATES: ReadonlySet<WorkItemState> = new Set(["NEW", "ASSIGNED"]);
```

`editWorkItem` (contracts/order-entry.md) refuses when `workItem.state` is not in this set. `NEW`
and `ASSIGNED` are the only states preceding `IN_DESIGN` in 002's allowed-edges table — this is a
direct reading of that table, not a new rule invented here.

## Module boundary

`src/server/orders/**` gets the same ESLint `no-restricted-imports` rule shape as
`src/server/core/**`/`src/server/auth/**` (research.md §6): only `~/server/orders` (the barrel,
`src/server/orders/index.ts`) is importable from outside the module; `tests/**` is exempted, same
as the existing two rules.

## Seed data addition

`prisma/seed.ts` gains a `seedProductTypes()` step (called from the existing seed `main()`,
upserted by `name` like `seedDepartments()` already is) creating the starter catalog from
spec.md's Assumptions: Roll-up Banner, Business Cards, Flyer/Poster, Vinyl Sticker, Outdoor Sign,
Laser-cut Sign — each mapped to one of the five existing seeded departments (Digital, Banner,
Outdoor, Laser, External respectively; Business Cards/Flyer default to Digital) with reasonable
`defaultRequiresDesign`/`defaultRequiresReview` values (true/true except Business Cards, which
defaults `defaultRequiresReview: false` as a lower-risk repeat product — an Admin can change this
at any time, it's not a rule this feature enforces elsewhere).
