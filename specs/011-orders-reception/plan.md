# Implementation Plan: Orders & Reception

**Branch**: `011-orders-reception` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-orders-reception/spec.md`

## Summary

Reception's main screen: get every customer request into the system as an Order with one or more
Work Items (Quick Create in ≤3 inputs, or a full multi-item form), let anyone see where an order
stands (queue, detail page with timeline, search), and let reception cancel or lightly edit before
design starts. Technical approach: this feature owns the **descriptive fields** of `WorkItem`
(product type, quantity, dimensions, material, notes, due date) and a new `ProductType` catalog —
both additions to 002's existing `Order`/`WorkItem` models, not new parallel objects (constitution
I). It also finally implements `Order.number`'s real DB sequence, which 002 deliberately deferred
(see `prisma/seed.ts`'s own comment on this). All writes go through a `src/server/orders/**`
service layer built on top of 002's `transitionWorkItem`/`deriveOrderStatus` and 001's
`authorize`/`audit`, following the exact Server Component + inline Server Action pattern already
established by `src/app/(shell)/admin/departments/page.tsx`.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 (matches CI)

**Primary Dependencies**: Next.js 15 (App Router, React Server Components + Server Actions),
Prisma ORM (PostgreSQL), Zod (input validation), Tailwind CSS (RTL logical properties), Better
Auth session (via 001's `getActor()`)

**Storage**: PostgreSQL, via the existing `prismaSchemaFolder` multi-file schema
(`prisma/schema/core.prisma` extended by this feature; no new schema file — `ProductType` and the
new `WorkItem`/`Order` columns belong in `core.prisma` alongside the models they extend)

**Testing**: Vitest — unit tests for pure logic (completeness check, search-term matching),
integration tests against a real Postgres test database (`tests/helpers/testDb.ts`, same pattern
as 001/002), contract tests for `deriveOrderStatus` interactions this feature relies on (already
covered by 002 — this feature adds contract tests only for its *own* new contracts)

**Target Platform**: Server-rendered web app, local LAN deployment (constitution VII)

**Project Type**: Web application (single Next.js project — Option 1 from the plan template,
matching 001/002; no separate frontend/backend split)

**Performance Goals**: Quick Create completes (network round trip + DB writes) well under the
human-perceptible "instant" threshold on LAN — no specific number in spec.md beyond "≤10 seconds of
user effort" (SC-001), which is a UX/step-count budget, not a latency budget; no unusual performance
engineering needed for V1 scale.

**Constraints**: Arabic-first RTL UI (constitution IX) using only logical Tailwind properties
(`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`), matching every existing `(shell)` page. Every write MUST
go through `transitionWorkItem` for state changes (constitution V) — this feature never sets
`WorkItem.state` directly except at creation time (initial `NEW` value on `create`, which is not a
"transition" since there is no prior state — see §5.3).

**Scale/Scope**: Single print shop, tens of reception users, hundreds of orders/day at full scale —
no sharding/pagination-at-scale concerns for V1; simple `orderBy` + `take` pagination is sufficient
for the queue and search.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design in §"Post-Design
Constitution Check" below.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item Is the Canonical Model | Every request becomes an Order+WorkItem via this feature's own creation paths; no parallel object introduced; grouped/separate stays presentation-only (FR-005) | PASS |
| II. Business Gates Are Inviolable | This feature never writes `WorkItem.state` itself except the initial `NEW` on creation (no gate to bypass at that point); urgent priority sorts but never skips a gate (FR-007a); cancellation still respects terminal-state rules (FR-011) | PASS |
| III. History Is Append-Only | Every create/edit/cancel/priority-change calls `audit.record` in the same `tx` (§5.3); no hard deletes anywhere in this feature | PASS |
| IV. Files Are Immutable, Private Versions | This feature does not implement file storage — it only reserves a UI slot for 050's `FilePanel` (FR-009a); no file-handling code is written here until 050 ships | PASS (deferred, not violated) |
| V. The Server Is the Only Authority | Every mutation is a Server Action calling an `authorize()`-gated `src/server/orders/**` function; all form input parsed with Zod at the server boundary (§5.3) | PASS |
| VI. Configuration Over Hard-Coding | `ProductType` is Admin-configurable data (FR-004), not an enum; `Department` (already data, from 002) is referenced, not re-implemented | PASS |
| VII. Local-First, Isolated Integrations | No external integration in this feature | PASS (N/A) |
| VIII. AI Is Optional and Assistive | No AI in this feature | PASS (N/A) |
| IX. Arabic-First, Task-Oriented UX | Quick Create is the primary flow (FR-001/FR-001a), queue-first navigation, RTL logical properties throughout | PASS |

No violations — Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/011-orders-reception/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── order-entry.md   # createOrder, quickCreateOrder, addWorkItem, editWorkItem,
│   │                    # cancelWorkItem, cancelOrder, searchOrders, isOrderComplete
│   └── product-types.md # ProductType CRUD contract
└── tasks.md             # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
prisma/schema/
└── core.prisma                          # MODIFIED — see data-model.md for the exact diff:
                                          #   + ProductType model
                                          #   + WorkItemDimensionUnit enum
                                          #   + WorkItem: description, quantity, widthValue,
                                          #     heightValue, dimensionUnit, material, finishNotes,
                                          #     dueDate, productType relation
                                          #   + Order: dueDate, number gets @default(autoincrement())

src/server/orders/                       # NEW — this feature's service layer
├── index.ts                             # barrel — the ONLY legal import surface from outside
│                                         #   (mirrors src/server/auth/index.ts's module-boundary
│                                         #   pattern; add the matching eslint.config.js rule)
├── orderNumber.ts                       # nextOrderNumber() — wraps the new DB sequence
├── completeness.ts                      # isOrderComplete() — pure function, no I/O
├── create.ts                            # quickCreateOrder(), createOrder()
├── workItems.ts                         # addWorkItem(), editWorkItem(), cancelWorkItem()
├── cancelOrder.ts                       # cancelOrder()
├── search.ts                            # searchOrders()
└── productTypes.ts                      # createProductType(), renameProductType(),
                                          #   updateProductTypeDefaults(), deactivateProductType()

src/app/(shell)/
├── reception/                           # NEW route group — replaces the placeholder
│   │                                    #   nav entry already wired in nav.ts (id: "reception")
│   ├── page.tsx                         # Reception queue (US3) — Server Component, direct
│   │                                    #   db reads (mirrors admin/departments/page.tsx)
│   ├── quick-create/
│   │   └── page.tsx                     # Quick Create screen (US1) — the fast path, own route
│   │                                    #   so it's linkable/keyboard-jumpable
│   ├── new/
│   │   └── page.tsx                     # Full order form (US2) — multi-Work-Item builder
│   └── search/
│       └── page.tsx                     # Order search (US5) — form + results list
├── orders/
│   └── [orderId]/
│       └── page.tsx                     # Order detail page (US4) — header, WI cards, timeline,
│                                        #   placeholder slots for 012/050/051/052/054
└── admin/
    └── product-types/
        └── page.tsx                     # ProductType admin CRUD (FR-004) — same pattern as
                                          #   admin/departments/page.tsx

prisma/seed.ts                           # MODIFIED — seed the starter ProductType catalog
                                          #   (Assumptions §"Product type starter list")

tests/
├── unit/
│   ├── completeness.test.ts             # isOrderComplete() pure-logic cases
│   └── orderSearch.test.ts              # search term matching, if any client-side logic exists
│                                        #   (most matching happens in the DB query — see research.md)
├── contract/
│   └── order-entry.test.ts              # createOrder/quickCreateOrder/addWorkItem/cancelWorkItem/
│                                        #   cancelOrder/editWorkItem against the frozen contract
│                                        #   shapes in contracts/order-entry.md
└── integration/
    ├── quick-create.test.ts             # US1 end-to-end against a real test DB
    ├── full-order-form.test.ts          # US2 — multi-item order, 4 departments
    ├── reception-queue.test.ts          # US3 — sort/flag behavior
    ├── order-detail.test.ts             # US4 — timeline assembly across several transitions
    ├── order-search.test.ts             # US5
    ├── cancel.test.ts                   # US6 — order + work item cancellation
    ├── add-item-to-open-order.test.ts   # US7 — append to in-progress order; refuse on finished
    └── edit-before-design.test.ts       # US8 — pre-design edit allowed/refused boundary
```

**Structure Decision**: Single Next.js project (Option 1), consistent with 001/002. New business
logic lives in `src/server/orders/**` (a new top-level module alongside `src/server/core`,
`src/server/auth`, `src/server/admin`), not inside `src/server/core/**` — this feature's logic is
feature-specific (Order/WorkItem *entry*, not the workflow engine itself) and constitution V's
"centralized transition function" requirement is satisfied by continuing to call 002's
`transitionWorkItem`, not by reimplementing it. `src/server/orders/**` gets its own
`eslint.config.js` module-boundary rule (barrel-only imports from outside), matching the existing
`src/server/core/**` and `src/server/auth/**` rules — see data-model.md's "Module boundary" note.

## Architecture & Design Patterns

### 5.1 Architectural style: thin Server Action adapters over a small service layer

Same shape as `src/server/admin/departments.ts` (001) — there is no separate "core" abstraction
for this feature the way 002 built one for the workflow engine, because this feature's job is
CRUD-shaped (create/read/update Order & WorkItem descriptive data) plus calling into 002's already-
centralized `transitionWorkItem`, not implementing a new state machine. Each `src/server/orders/*.ts`
file exports a small number of `async function name(actor: Actor, ...): Promise<T>` functions that:

1. Call `authorize(actor, permission)` first (throws `ForbiddenError`/`UnauthenticatedError` — see
   001's `contracts/auth.md`; Server Actions let this propagate, Next.js renders the nearest error
   boundary).
2. Validate any raw/string input with a Zod schema (defined alongside the function or in a shared
   `src/server/orders/validation.ts` if schemas are reused across 3+ call sites — start local,
   extract only if duplicated, per the project's no-premature-abstraction convention).
3. Run the actual DB work inside `db.$transaction(async (tx) => { ... })`, calling
   `audit.record(tx, {...})` for every mutation and, where a `WorkItem.state` change is involved,
   `transitionWorkItem(tx, {...})` — never writing `state` via a plain `tx.workItem.update`.
4. Return a plain typed value (not `Result`/`ActionResult` — this feature is not part of
   `src/server/core/**`, so it is not bound by that module's "never throw" contract; it follows the
   same "let it throw, Server Action boundary catches" convention `src/server/admin/**` already
   uses). Page-level Server Actions that need a user-visible error message catch and translate, the
   same way `authorize()` failures already surface today.

### 5.2 Design patterns applied

- **Adapter pattern** (Server Action → service function): every mutating page action is a
  `"use server"` function that does `getActor()` → call one `src/server/orders/*` function →
  `revalidatePath(...)`. No business logic lives in the Server Action itself, exactly like
  `addDepartmentAction` in `admin/departments/page.tsx`.
- **Repository-free direct Prisma access**: consistent with the rest of the codebase, there is no
  repository/DAO layer — `db` (or `tx`) is called directly inside `src/server/orders/**`. Reads for
  display (queue, search results, detail page) query `db` directly from the Server Component, same
  as `admin/departments/page.tsx`'s `db.department.findMany(...)`.
- **Pure function extraction for testable logic**: `isOrderComplete()` (completeness rule, FR-002)
  and the order-number sequence wrapper are the two places this feature has logic worth unit-
  testing without a database — both are pure or single-responsibility enough to isolate (see §5.3).
- **Reuse over reinvention**: `deriveOrderStatus` (002) is *called*, never reimplemented, anywhere
  this feature displays an order's status (queue, detail page, search results) — per that
  contract's own "do not reimplement this logic elsewhere" rule.

### 5.3 Core public types (the actual contracts, in TypeScript)

Full detail lives in `contracts/order-entry.md` and `contracts/product-types.md` — this is the
shape summary a reviewer needs without opening those files.

```ts
// src/server/orders/index.ts (barrel — only these names are importable from outside this module)

// --- Order/WorkItem creation -------------------------------------------
function quickCreateOrder(
  actor: Actor,
  input: {
    customerId: string;              // from 010's CustomerPicker, or the Cash Customer's id
    description: string;             // one-line description → WorkItem.description
    priority: OrderPriority;         // "NORMAL" | "URGENT"
    channel: OrderChannel;           // "WALK_IN" | "WHATSAPP" | "PHONE" | "RETURNING" | "DIRECT_TO_DESIGNER"
  },
): Promise<{ orderId: string; orderNumber: number; workItemId: string }>;

function createOrder(
  actor: Actor,
  input: {
    customerId: string;
    channel: OrderChannel;
    priority: OrderPriority;
    mode: OrderMode;                 // "GROUPED" | "SEPARATE"
    dueDate?: Date;                  // order-level default (FR-003a)
    workItems: ReadonlyArray<{
      productTypeId?: string;
      quantity: number;              // positive integer
      widthValue: number;            // positive decimal
      heightValue: number;
      dimensionUnit: WorkItemDimensionUnit; // "MM" | "CM" | "M" | "IN"
      material?: string;
      finishNotes?: string;
      requiresDesign: boolean;
      requiresReview: boolean;
      departmentId?: string;
      dueDate?: Date;                // per-item override (FR-003a)
      description?: string;
    }>;
  },
): Promise<{ orderId: string; orderNumber: number; workItemIds: string[] }>;

// --- Adding to / editing an existing order ------------------------------
function addWorkItem(
  actor: Actor,
  orderId: string,
  input: Omit<Parameters<typeof createOrder>[1]["workItems"][number], never>, // same per-item shape
): Promise<{ workItemId: string }>;      // throws DomainOrderError("ORDER_FINISHED") if refused (FR-011b)

function editWorkItem(
  actor: Actor,
  workItemId: string,
  patch: Partial<{
    quantity: number;
    widthValue: number;
    heightValue: number;
    dimensionUnit: WorkItemDimensionUnit;
    material: string;
    finishNotes: string;
    dueDate: Date | null;
  }>,
): Promise<void>;                        // throws DomainOrderError("PAST_EDIT_WINDOW") once design has started (FR-012a)

// --- Cancellation ---------------------------------------------------------
function cancelWorkItem(actor: Actor, workItemId: string, reason: string): Promise<void>;
                                          // delegates the state write to transitionWorkItem(tx, { to: "CANCELLED", reason, ... })
function cancelOrder(actor: Actor, orderId: string, reason: string): Promise<{ cancelledWorkItemIds: string[] }>;
                                          // calls cancelWorkItem's core logic once per non-terminal WorkItem, same tx

// --- Read-side helpers used by pages (not authorize-gated on their own —
// callers authorize before calling; these are plain data shaping) --------
function isOrderComplete(order: { workItems: ReadonlyArray<{
  productTypeId: string | null; quantity: number | null;
  widthValue: unknown | null; heightValue: unknown | null; departmentId: string | null;
}> }): boolean;                          // pure — FR-002's rule, unit-testable with plain literals

function searchOrders(
  actor: Actor,
  query: { orderNumber?: number; phone?: string; customerName?: string },
): Promise<OrderSearchResult[]>;         // OrderSearchResult shape in contracts/order-entry.md

// --- Product Type catalog (Admin) ---------------------------------------
function createProductType(actor: Actor, input: {
  name: string; defaultDepartmentId?: string;
  defaultRequiresDesign: boolean; defaultRequiresReview: boolean;
  pricingModeHint?: string;
}): Promise<{ productTypeId: string }>;
function renameProductType(actor: Actor, productTypeId: string, newName: string): Promise<void>;
function updateProductTypeDefaults(actor: Actor, productTypeId: string, patch: Partial<{
  defaultDepartmentId: string | null; defaultRequiresDesign: boolean;
  defaultRequiresReview: boolean; pricingModeHint: string | null;
}>): Promise<void>;
function deactivateProductType(actor: Actor, productTypeId: string): Promise<void>;
```

`DomainOrderError` is a small local error class (`src/server/orders/errors.ts`), NOT `core`'s
`DomainError`/`Result` type (this feature isn't part of `src/server/core/**`) — it carries a
`code: "ORDER_FINISHED" | "PAST_EDIT_WINDOW" | "TERMINAL_WORK_ITEM"` string so Server Actions can
pattern-match it into a user-facing message, the same informal convention
`UnauthenticatedError`/`ForbiddenError` already establish in `src/server/auth/**`.

### 5.4 Type safety

- Every `src/server/orders/*.ts` function's public parameters and return types are written out in
  full (§5.3) — no `any`, no implicit `unknown` escaping the module.
- Raw `FormData` from every Server Action is parsed through a Zod schema before it reaches a
  service function — service functions themselves take already-typed, already-validated input
  (numbers as `number`, not `string`), matching constitution V's "validated with a schema (Zod) at
  the server boundary."
- `WorkItemDimensionUnit` is a new Prisma enum (fixed vocabulary, code-level — like
  `WorkItemState`), not a free-text field or admin-configurable data; unit conversion is out of
  scope (values are stored and displayed as entered, never converted between units).
- Money/pricing fields are explicitly **not** touched by this feature (051 owns them) — no
  `Decimal` handling needed here beyond `widthValue`/`heightValue`, which use Prisma `Decimal` for
  precision (dimensions, not currency, but still not floats — avoids `12.1 + 0.2` class bugs when a
  later feature sums areas for pricing).

### 5.5 Performance

- Reception queue and search both use a single indexed query each (see data-model.md for the new
  indexes on `Order.number`, `Customer.name`/phone via 010, and `WorkItem` fields used in
  completeness checks) — no N+1 risk: `db.order.findMany({ include: { workItems: true, customer: true } })`
  style single-query reads, consistent with how `admin/departments/page.tsx` reads.
- `quickCreateOrder`/`createOrder`/`addWorkItem` each run inside exactly one `db.$transaction` —
  no sequential round trips per Work Item beyond what Prisma's nested `create` already batches.

### 5.6 Scalability & maintainability

- `ProductType` and the new `WorkItem` descriptive fields are additive to 002's existing models —
  no breaking change to `transitionWorkItem`, `deriveOrderStatus`, or any already-shipped 002 code
  path; 002's own tests continue to pass unmodified (verified in tasks.md's polish phase).
- The reception queue/search/detail pages are plain Server Components reading fresh from `db` on
  every request (no client-side cache to invalidate) — matches the rest of the `(shell)` app and
  avoids a whole class of staleness bugs for V1's scale.
- `src/server/orders/**`'s barrel + ESLint module-boundary rule means 012 (designer assignment),
  051 (pricing), 052 (payments) can safely import `ProductType`'s public shape and `Order`/
  `WorkItem` read helpers without depending on this feature's internals.

## Post-Design Constitution Check

*Re-checked after Phase 1 (data-model.md, contracts/, quickstart.md) — see those files for the
concrete design this re-validates.*

| Principle | Re-check after design | Result |
|---|---|---|
| I | `ProductType` and new `WorkItem` fields are additive, not a parallel model; `data-model.md` confirms no new "status" column anywhere | PASS |
| III | `data-model.md`'s field list confirms every new mutation path (`create`, `addWorkItem`, `editWorkItem`, `cancelWorkItem`, `cancelOrder`, ProductType CRUD) has a paired `audit.record` call in `contracts/order-entry.md`/`contracts/product-types.md` | PASS |
| V | `contracts/order-entry.md` confirms every mutating function is `authorize()`-gated and takes already-Zod-validated input | PASS |
| VI | `contracts/product-types.md` confirms `ProductType` has no seeded rows an Admin can't later change (starter catalog is a seed convenience, not a hard-coded restriction) | PASS |

No new violations introduced by the detailed design — Complexity Tracking remains empty.

## Complexity Tracking

*No violations — table intentionally empty.*
