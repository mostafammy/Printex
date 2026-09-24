# Phase 1 Data Model: Collection, Discrepancies & Delivery

## Schema diff (`prisma/schema/core.prisma`)

### New enums

```prisma
/// PRD §20 — fixed vocabulary (like WorkItemState), not admin data.
enum DiscrepancyType {
  DAMAGED
  WASTE
  MISSING
  SHORT_PRODUCED
  INCORRECTLY_PRODUCED
  CUSTOMER_REJECTION
}

/// PRD §21 — fixed vocabulary.
enum CompensationKind {
  REPRINT
  REPLACEMENT_NEXT_ORDER
  CREDIT
  PRICE_ADJUSTMENT
  CUSTOMER_ACCEPTS_SHORTAGE
  OTHER
}
```

### `WorkItem` — new column, relations, index

```prisma
model WorkItem {
  // ...existing fields unchanged...

  /// --- 015-collection-delivery fields --------------------------------------
  /// Set only on a reprint Work Item created by a REPRINT compensation
  /// (research.md §9). Never changed after creation.
  reprintOfWorkItemId String?
  reprintOf           WorkItem?  @relation("WorkItemReprint", fields: [reprintOfWorkItemId], references: [id])
  reprints            WorkItem[] @relation("WorkItemReprint")
  /// --- end 015-collection-delivery fields ----------------------------------

  productionReceipts  ProductionReceipt[]
  discrepancies       Discrepancy[]
  deliveryLine        DeliveryLine?
  /// Back-relation: the REPRINT compensation that created this Work Item.
  createdByCompensation Compensation? @relation("CompensationReprint")

  @@index([orderId, state])          // existing
  @@index([state])                   // NEW — collection/delivery queues filter by state only (research.md §6)
  @@index([reprintOfWorkItemId])     // NEW — lineage lookups
}
```

### `Order` — new back-relations

```prisma
model Order {
  // ...existing fields unchanged...
  deliveries                Delivery[]
  replacementCompensations  Compensation[] @relation("CompensationReplacementOrder")
}
```

### `Department` — new back-relation

```prisma
model Department {
  // ...existing fields unchanged...
  discrepancies Discrepancy[]
}
```

### New model: `ProductionReceipt`

```prisma
/// One revision of the counted quantities for a Work Item (FR-004..FR-008,
/// FR-012). Append-only: a recount or a post-receipt discrepancy creates
/// revision n+1; rows are never updated or deleted (constitution III).
/// DB CHECK: accepted + damaged + missing + waste = expectedQuantity, all >= 0.
model ProductionReceipt {
  id                   String   @id @default(cuid())
  workItemId           String
  workItem             WorkItem @relation(fields: [workItemId], references: [id])
  /// 1 = the initial receipt; the highest revision is current.
  revision             Int
  expectedQuantity     Int
  /// true when WorkItem.quantity was null and producedQuantity was used.
  expectedFromProduced Boolean  @default(false)
  /// Snapshot of WorkItem.producedQuantity (014) at revision time.
  producedQuantity     Int?
  acceptedQuantity     Int
  damagedQuantity      Int
  missingQuantity      Int
  wasteQuantity        Int
  notes                String?
  recordedById         String
  recordedBy           User     @relation("ProductionReceiptRecordedBy", fields: [recordedById], references: [id])
  createdAt            DateTime @default(now())

  discrepancies Discrepancy[]
  deliveryLines DeliveryLine[]

  @@unique([workItemId, revision])
}
```

### New model: `DiscrepancyCause`

```prisma
/// Admin-configured cause categories (constitution VI, FR-013). Never
/// deleted — deactivated; historical discrepancies keep their cause.
model DiscrepancyCause {
  id        String   @id @default(cuid())
  name      String   @unique
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  discrepancies Discrepancy[]
}
```

### New model: `Discrepancy`

```prisma
/// One classified loss against a Work Item (PRD §20, FR-009..FR-012).
/// Append-only. Attachments are 050 Attachment rows linked polymorphically
/// by (entityType = "Discrepancy", entityId = id) — no FK here (050
/// data-model.md "Attachment polymorphic links").
model Discrepancy {
  id                      String          @id @default(cuid())
  workItemId              String
  workItem                WorkItem        @relation(fields: [workItemId], references: [id])
  type                    DiscrepancyType
  quantity                Int
  causeId                 String
  cause                   DiscrepancyCause @relation(fields: [causeId], references: [id])
  responsibleUserId       String?
  responsibleUser         User?           @relation("DiscrepancyResponsibleUser", fields: [responsibleUserId], references: [id])
  /// Defaults to the Work Item's effective production department.
  responsibleDepartmentId String?
  responsibleDepartment   Department?     @relation(fields: [responsibleDepartmentId], references: [id])
  /// The receipt revision this discrepancy is counted in; null only for a
  /// CUSTOMER_REJECTION recorded after delivery (research.md §8).
  receiptId               String?
  receipt                 ProductionReceipt? @relation(fields: [receiptId], references: [id])
  /// Work Item state when recorded: PRODUCTION_COMPLETED (at receipt),
  /// READY_FOR_COLLECTION, or DELIVERED.
  recordedInState         WorkItemState
  notes                   String?
  recordedById            String
  recordedBy              User            @relation("DiscrepancyRecordedBy", fields: [recordedById], references: [id])
  recordedAt              DateTime        @default(now())

  compensations Compensation[]

  @@index([workItemId])
  @@index([recordedAt, id])
  @@index([responsibleDepartmentId, recordedAt])
}
```

### New model: `Compensation`

```prisma
/// How some quantity of a discrepancy was resolved (PRD §21, FR-014..FR-018).
/// Append-only. Sum(quantity) per discrepancy <= discrepancy.quantity.
model Compensation {
  id                 String           @id @default(cuid())
  discrepancyId      String
  discrepancy        Discrepancy      @relation(fields: [discrepancyId], references: [id])
  kind               CompensationKind
  quantity           Int
  /// EGP; required (> 0) for CREDIT and PRICE_ADJUSTMENT, null otherwise
  /// (constitution: Decimal for money). DB CHECK enforces the pairing.
  amount             Decimal?         @db.Decimal(12, 2)
  reason             String
  notes              String?
  /// Optional pointer for REPLACEMENT_NEXT_ORDER when the next order exists.
  replacementOrderId String?
  replacementOrder   Order?           @relation("CompensationReplacementOrder", fields: [replacementOrderId], references: [id])
  /// Set only for REPRINT — the Work Item this compensation created.
  reprintWorkItemId  String?          @unique
  reprintWorkItem    WorkItem?        @relation("CompensationReprint", fields: [reprintWorkItemId], references: [id])
  resolvedById       String
  resolvedBy         User             @relation("CompensationResolvedBy", fields: [resolvedById], references: [id])
  resolvedAt         DateTime         @default(now())

  @@index([discrepancyId])
  @@index([kind, resolvedAt])
}
```

### New models: `Delivery`, `DeliveryLine`

```prisma
/// One hand-over event for an Order (PRD §22, FR-022..FR-024). Append-only.
model Delivery {
  id              String   @id @default(cuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id])
  handedOverById  String
  handedOverBy    User     @relation("DeliveryHandedOverBy", fields: [handedOverById], references: [id])
  receivedByName  String
  /// Normalized with 010's normalizePhone when present.
  receivedByPhone String?
  /// Business time of the hand-over (<= now, >= latest receipt createdAt).
  deliveredAt     DateTime
  /// Server-derived: true when some non-cancelled Work Item of the Order
  /// remains undelivered after this hand-over.
  isPartial       Boolean
  /// Required when isPartial && Order.mode = GROUPED.
  partialReason   String?
  notes           String?
  recordedById    String
  recordedBy      User     @relation("DeliveryRecordedBy", fields: [recordedById], references: [id])
  createdAt       DateTime @default(now())

  lines DeliveryLine[]

  @@index([orderId, deliveredAt])
}

model DeliveryLine {
  id                String            @id @default(cuid())
  deliveryId        String
  delivery          Delivery          @relation(fields: [deliveryId], references: [id])
  /// @unique — a Work Item is handed over at most once (FR-023).
  workItemId        String            @unique
  workItem          WorkItem          @relation(fields: [workItemId], references: [id])
  /// Server-derived = receipt.acceptedQuantity of the current revision.
  deliveredQuantity Int
  /// The receipt revision that was current at hand-over.
  receiptId         String
  receipt           ProductionReceipt @relation(fields: [receiptId], references: [id])

  @@index([deliveryId])
}
```

### New model: `CollectionPolicy`

```prisma
/// Single-row Admin configuration (id = "default") — constitution VI,
/// FR-020, FR-021. Updated in place by updateCollectionPolicy() with an
/// audit event carrying before/after (configuration, not operational
/// history).
model CollectionPolicy {
  id                          String   @id @default("default")
  /// 0 < value <= 100; default 10.00 (spec Clarifications).
  majorDiscrepancyPercent     Decimal  @db.Decimal(5, 2) @default(10.00)
  /// RoleKey strings for NotificationEvent.recipientRoles.
  majorDiscrepancyNotifyRoles String[] @default(["ADMIN_OWNER"])
  readyNoticeRoles            String[] @default(["RECEPTION"])
  updatedAt                   DateTime @updatedAt
  updatedById                 String?
  updatedBy                   User?    @relation("CollectionPolicyUpdatedBy", fields: [updatedById], references: [id])
}
```

### `User` (identity.prisma) — new back-relations

```prisma
model User {
  // ...existing fields unchanged...
  productionReceiptsRecorded ProductionReceipt[] @relation("ProductionReceiptRecordedBy")
  discrepanciesRecorded      Discrepancy[]       @relation("DiscrepancyRecordedBy")
  discrepanciesResponsible   Discrepancy[]       @relation("DiscrepancyResponsibleUser")
  compensationsResolved      Compensation[]      @relation("CompensationResolvedBy")
  deliveriesHandedOver       Delivery[]          @relation("DeliveryHandedOverBy")
  deliveriesRecorded         Delivery[]          @relation("DeliveryRecordedBy")
  collectionPolicyUpdates    CollectionPolicy[]  @relation("CollectionPolicyUpdatedBy")
}
```

### No workflow-edge change

`PRODUCTION_COMPLETED → READY_FOR_COLLECTION`, `READY_FOR_COLLECTION → DELIVERED`,
`DELIVERED → COMPLETED` and `NEW → READY_FOR_PRODUCTION` (reprint) all already exist in
`src/server/core/workflow/edges.ts`. `edges.ts` is not touched.

## Append-only / integrity enforcement (`prisma/manual-sql/collection-integrity.sql`)

```sql
ALTER TABLE "ProductionReceipt" ADD CONSTRAINT production_receipt_counts_sum
  CHECK ("acceptedQuantity" + "damagedQuantity" + "missingQuantity" + "wasteQuantity" = "expectedQuantity");
ALTER TABLE "ProductionReceipt" ADD CONSTRAINT production_receipt_counts_nonneg
  CHECK ("acceptedQuantity" >= 0 AND "damagedQuantity" >= 0 AND "missingQuantity" >= 0
         AND "wasteQuantity" >= 0 AND "expectedQuantity" > 0 AND revision >= 1);
ALTER TABLE "Discrepancy"  ADD CONSTRAINT discrepancy_quantity_pos CHECK (quantity > 0);
ALTER TABLE "Compensation" ADD CONSTRAINT compensation_quantity_pos CHECK (quantity > 0);
ALTER TABLE "Compensation" ADD CONSTRAINT compensation_amount_pairing CHECK (
  (kind IN ('CREDIT','PRICE_ADJUSTMENT') AND amount IS NOT NULL AND amount > 0)
  OR (kind NOT IN ('CREDIT','PRICE_ADJUSTMENT') AND amount IS NULL));
ALTER TABLE "DeliveryLine" ADD CONSTRAINT delivery_line_qty_nonneg CHECK ("deliveredQuantity" >= 0);
REVOKE UPDATE, DELETE ON "ProductionReceipt", "Discrepancy", "Compensation", "Delivery", "DeliveryLine"
  FROM CURRENT_USER;
```

The `CHECK`s also go into the Prisma migration's `migration.sql` (research.md §13); the `REVOKE`
carries the same non-superuser deployment prerequisite documented in
`prisma/manual-sql/audit-event-append-only.sql`. Backup scope: all new tables live in the existing
PostgreSQL database already covered by the backup plan (constitution "Backups") — no new store.

## Derived values (never stored)

- **Current receipt**: the `ProductionReceipt` with the highest `revision` for a Work Item.
- **Bucket of a discrepancy type** (`quantities.ts`, total function): `DAMAGED`,
  `INCORRECTLY_PRODUCED`, `CUSTOMER_REJECTION` → `damaged`; `MISSING`, `SHORT_PRODUCED` → `missing`;
  `WASTE` → `waste`.
- **Resolved quantity of a discrepancy**: `sum(Compensation.quantity WHERE discrepancyId = …)`;
  **open** iff `< Discrepancy.quantity`. Order-level open count via one
  `groupBy(discrepancyId)` over the Order's Work Items.
- **Ready for customer** (`readiness.ts`): separate mode — per Work Item, `state =
  READY_FOR_COLLECTION`; grouped mode — per Order, every non-`CANCELLED` Work Item in
  `{READY_FOR_COLLECTION, DELIVERED}` and at least one `READY_FOR_COLLECTION`.
- **waitingSince** (queues): `min(PhaseTiming.startedAt)` over the Order's Work Items' open `QUEUE`
  segment for the queue's phase (opened by `transitionWorkItem` step 5).
- **isMajor** (`quantities.ts`): `(damaged + missing + waste) / expected * 100 >=
  policy.majorDiscrepancyPercent`, evaluated on the revision a command just created, only when this
  command increased the non-accepted total.
- **Closure conditions** (`closure.ts`): `NOT_ALL_DELIVERED`, `PRICING_UNRESOLVED`,
  `OPEN_DISCREPANCIES`, `UNPAID_BALANCE` (`remaining > 0 && !creditApproved`),
  `FINANCE_UNAVAILABLE`.
- **Lineage**: ancestors via `reprintOfWorkItemId` (walk up, max depth 10), descendants via
  `reprints`.

## Validation rules

- `receiveProduction`: Work Item state MUST be `PRODUCTION_COMPLETED` (`INVALID_STATE`); all four
  counts integers ≥ 0 (Zod); sum = expected (`QUANTITY_MISMATCH { expected, sum }`); per bucket, sum
  of line quantities = bucket count (`UNCLASSIFIED_QUANTITY { bucket, counted, classified }`); line
  types MUST NOT include `CUSTOMER_REJECTION` (`DISCREPANCY_TYPE_NOT_ALLOWED`); every `causeId` MUST
  reference an active cause (`NOT_FOUND`/`VALIDATION`); expected MUST be > 0 — if both
  `WorkItem.quantity` and `producedQuantity` are null → `EXPECTED_QUANTITY_UNKNOWN`; `notes` ≤ 2000
  chars; ≤ 20 lines.
- `recordDiscrepancy`: allowed types by state (FR-011): `READY_FOR_COLLECTION` → `DAMAGED`,
  `MISSING`, `INCORRECTLY_PRODUCED`, `CUSTOMER_REJECTION`; `DELIVERED` → `CUSTOMER_REJECTION`;
  otherwise `DISCREPANCY_TYPE_NOT_ALLOWED` / `INVALID_STATE`; any Work Item of the Order `COMPLETED`
  → `ORDER_CLOSED`; quantity ≤ current accepted (`READY_FOR_COLLECTION`) or ≤ delivered quantity
  minus prior post-delivery rejections (`DELIVERED`) → else `EXCEEDS_AVAILABLE`.
- `resolveDiscrepancy`: Zod discriminated union on `kind`; `reason` non-empty after trim;
  `quantity` positive integer ≤ discrepancy quantity − resolved quantity
  (`RESOLUTION_EXCEEDS_DISCREPANCY`); `amount` decimal string `^\d{1,10}(\.\d{1,2})?$`, > 0, required
  iff `CREDIT | PRICE_ADJUSTMENT`; `replacementOrderId` only for `REPLACEMENT_NEXT_ORDER` and must
  belong to the same customer; refused if the Order is closed (`ORDER_CLOSED`).
- `recordDelivery`: `workItemIds` non-empty, unique, all in the given Order and
  `READY_FOR_COLLECTION` (`INVALID_STATE` listing offenders); `receivedByName` trimmed 1..120;
  `receivedByPhone` optional, normalized via `~/server/customers`' `normalizePhone`;
  `handedOverById` optional, an active `User`; `deliveredAt` optional, ≤ now and ≥ each line's
  current receipt `createdAt`; grouped mode + partial → `partialConfirmed === true` and
  `partialReason` non-empty (`PARTIAL_REASON_REQUIRED`); pricing pre-check →
  `PRICING_UNRESOLVED { items }`.
- `updateCollectionPolicy`: `majorDiscrepancyPercent` in (0, 100]; role arrays ⊆ 001's `RoleKey`
  values, non-empty.
- Causes: `name` trimmed 1..80, unique case-insensitively (`DUPLICATE_NAME`).

## State transitions performed by this feature (all via `transitionWorkItem`)

| From | To | By | Guard(s) |
|---|---|---|---|
| `PRODUCTION_COMPLETED` | `READY_FOR_COLLECTION` | `receiveProduction` | none |
| `NEW` | `READY_FOR_PRODUCTION` | `resolveDiscrepancy` (REPRINT) on the new Work Item | any registered on `→ READY_FOR_PRODUCTION` |
| `READY_FOR_COLLECTION` | `DELIVERED` | `recordDelivery` | `deliveryPricingGuard` (`PRICING_UNRESOLVED`) |
| `DELIVERED` | `COMPLETED` | `tryFinancialClosure` | `closureGuard` (`CLOSURE_CONDITIONS_UNMET`) |

## Seed additions (`prisma/seed.ts`)

- `CollectionPolicy { id: "default" }` with defaults.
- `DiscrepancyCause`: "Machine fault", "Material defect", "Operator error", "Handling / storage",
  "File / design error", "External vendor", "Customer-side", "Other" (upsert by name).
- No permission/role changes.
