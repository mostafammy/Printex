# Contract: Product Type Catalog

Owner: 011. Consumers: order-entry forms (this feature's own `createOrder`/`addWorkItem` UIs, which
read `ProductType` to populate a picker and pre-fill `defaultDepartmentId`/`defaultRequiresDesign`/
`defaultRequiresReview` onto a new Work Item), 051 (pricing reads `pricingModeHint`).

Lives in `src/server/orders/productTypes.ts`, re-exported from the barrel.

## `createProductType`

```ts
function createProductType(
  actor: Actor,
  input: {
    name: string;
    defaultDepartmentId?: string;
    defaultRequiresDesign: boolean;
    defaultRequiresReview: boolean;
    pricingModeHint?: string;
  },
): Promise<{ productTypeId: string }>;
```

1. `authorize(actor, "admin.config")` — product type catalog management is Admin configuration,
   same permission ProductType admin CRUD already anticipated in 001's seed (per plan.md's summary
   of existing permission coverage) — do not add a new `Permission` key.
2. Zod-validate (`name` non-empty, trimmed, 1-100 chars).
3. `tx = db.$transaction`:
   a. `tx.productType.create({ data: { name: input.name.trim(), defaultDepartmentId: input.defaultDepartmentId ?? null, defaultRequiresDesign, defaultRequiresReview, pricingModeHint: input.pricingModeHint ?? null } })`
      — Prisma's `@unique` on `name` surfaces a `P2002` on duplicate; catch it and rethrow as
      `new DomainOrderError("DUPLICATE_NAME", \`A product type named "${input.name}" already exists.\`)`.
   b. `audit.record(tx, { action: "producttype.created", entityType: "ProductType", entityId: productType.id, actorId: actor.userId, after: input })`.
4. Return `{ productTypeId }`.

## `renameProductType`

```ts
function renameProductType(actor: Actor, productTypeId: string, name: string): Promise<void>;
```

1. `authorize(actor, "admin.config")`.
2. Zod-validate `name`.
3. `tx = db.$transaction`:
   a. `existing = tx.productType.findUniqueOrThrow({ where: { id: productTypeId } })`.
   b. `tx.productType.update({ where: { id: productTypeId }, data: { name: name.trim() } })` — same
      `P2002` → `DUPLICATE_NAME` handling as `createProductType`.
   c. `audit.record(tx, { action: "producttype.renamed", entityType: "ProductType", entityId: productTypeId, actorId: actor.userId, before: { name: existing.name }, after: { name } })`.

## `updateProductTypeDefaults`

```ts
function updateProductTypeDefaults(
  actor: Actor,
  productTypeId: string,
  patch: Partial<{
    defaultDepartmentId: string | null;
    defaultRequiresDesign: boolean;
    defaultRequiresReview: boolean;
    pricingModeHint: string | null;
  }>,
): Promise<void>;
```

1. `authorize(actor, "admin.config")`.
2. Zod-validate `patch` (at least one key present).
3. `tx = db.$transaction`:
   a. `existing = tx.productType.findUniqueOrThrow({ where: { id: productTypeId } })`.
   b. `tx.productType.update({ where: { id: productTypeId }, data: patch })`.
   c. `audit.record(tx, { action: "producttype.defaults_updated", entityType: "ProductType", entityId: productTypeId, actorId: actor.userId, before: pick(existing, Object.keys(patch)), after: patch })`.

**Note**: changing these defaults never retroactively touches existing `WorkItem` rows — they are
copied onto a Work Item only at the moment of creation (`createOrder`/`addWorkItem` read the
`ProductType`'s current defaults and write them onto the new `WorkItem`'s own
`requiresDesign`/`requiresReview`/`departmentId` fields). This matches constitution I: a Work Item
is the unit of truth for its own workflow once created, not a live join against `ProductType`.

## `deactivateProductType`

```ts
function deactivateProductType(actor: Actor, productTypeId: string): Promise<void>;
```

1. `authorize(actor, "admin.config")`.
2. `tx = db.$transaction`:
   a. `tx.productType.update({ where: { id: productTypeId }, data: { isActive: false } })` — soft
      delete only; never a hard `delete()`, since existing `WorkItem` rows hold a real FK to this
      row (constitution III: nothing that has ever been referenced is destroyed).
   b. `audit.record(tx, { action: "producttype.deactivated", entityType: "ProductType", entityId: productTypeId, actorId: actor.userId })`.
3. Order-entry pickers (`createOrder`/`addWorkItem` forms) filter their `ProductType` list to
   `isActive: true` only — a deactivated type simply stops appearing as a choice for new Work Items;
   it is never removed from types already assigned to existing Work Items.

## Admin UI

`src/app/(shell)/admin/product-types/page.tsx` — Server Component + inline `"use server"` Server
Actions, replicating `src/app/(shell)/admin/departments/page.tsx`'s exact pattern (list table +
create form + inline rename/deactivate actions per row, `formStr()` helper reused for all
`FormData` narrowing, `revalidatePath("/admin/product-types")` after every mutation).

## Authorization table

| Function | Permission |
|---|---|
| `createProductType`, `renameProductType`, `updateProductTypeDefaults`, `deactivateProductType` | `admin.config` |
