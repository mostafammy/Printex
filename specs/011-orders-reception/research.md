# Phase 0 Research: Orders & Reception

Source: [spec.md](./spec.md) requirements resolved against the existing codebase (001/002 already
shipped) and [plan.md](./plan.md)'s Technical Context. No `[NEEDS CLARIFICATION]` markers remain in
spec.md after the interactive clarification session — this file resolves *implementation-level*
unknowns the plan surfaced (not spec-level scope questions).

## 1. `Order.number`'s real sequence

**Decision**: Add `@default(autoincrement())` to `Order.number` in `prisma/schema/core.prisma`.
Prisma maps this to a real Postgres `SERIAL`/sequence-backed integer column on `db push`.

**Rationale**: `prisma/seed.ts` already documents, in its own words, that `Order.number` "has no
DB-level `@default(autoincrement())` in core.prisma today — it's a plain unique `Int` the
application layer is expected to assign... see contracts/orders.md for the real sequence logic,
owned outside this feature [002]." This feature (011) is that "outside" owner — it's the feature
that actually creates Orders through normal application flows, so it's the correct place to finish
this. `autoincrement()` satisfies FR-008's "DB sequence, ever-increasing, no reset, no prefix"
verbatim, with zero custom code (no manual `SELECT nextval(...)` or race-prone
"max + 1" queries).

**Alternatives considered**:
- Custom Postgres sequence + manual `nextval()` call in `quickCreateOrder`/`createOrder`: strictly
  more code than Prisma's native `autoincrement()` for an identical result — rejected as
  unnecessary complexity (constitution's "no hard-coding / no reinvention" spirit, and Complexity
  Tracking would have nothing to justify it against).
- Generating the number in application code via `Math.max(...) + 1`: race-prone under concurrent
  Quick Creates (two reception users saving at once could compute the same "next" number before
  either commits) — rejected outright, this is exactly the bug class DB sequences exist to avoid.

**Migration note**: `prisma db push` on a column changing from "no default" to
`@default(autoincrement())` needs the column's existing values to already be sequential-ish for
Postgres to set the sequence's start value sensibly. Since `Order.number` today only holds seed-
script values (large `process.hrtime.bigint() % 1_000_000_000n`-derived numbers, per seed.ts) and
this is pre-production (V1 not yet live), the task list includes truncating existing seeded Order
rows (via re-seeding, not a hand migration) rather than writing a data-preserving migration —
acceptable because no real customer data exists yet. Once V1 is live, any *future* schema change to
an operational table would need the data-preservation plan constitution's Development Workflow
section requires; this one predates go-live.

## 2. Dimension units

**Decision**: New Prisma enum `WorkItemDimensionUnit { MM CM M IN }` (millimeters, centimeters,
meters, inches) stored alongside `widthValue`/`heightValue` (Prisma `Decimal`). No unit conversion
logic — a Work Item's dimensions are always displayed in the unit they were entered in.

**Rationale**: Print shop measurements realistically span small items (business cards, in mm/cm)
to large-format banners/signs (in m or ft/in depending on convention) — spec.md's FR-003 requires
"width × height with a unit," without prescribing which units, and no PRD passage in the source
issue names a single fixed unit. A small fixed enum (not free-text) keeps this constitution-VI-
compliant (fixed vocabulary, not configurable data — units of measure are a code-level concept
like `WorkItemState`, not shop-configurable business data) while covering the realistic range.
Conversion is explicitly out of scope: nothing in spec.md requires cross-unit comparison or
aggregation in this feature (051's pricing, when it reads these fields, is responsible for its own
unit handling if it needs one).

**Alternatives considered**:
- Single fixed unit (e.g. always cm): simpler, but forces reception to do mental math for very
  large or very small jobs — rejected, conflicts with constitution IX's "minimize clicks / avoid
  friction" and FR-003's plain "with a unit" wording implying unit choice matters.
- Free-text unit string: rejected — constitution VI reserves free-text/configurable-data treatment
  for genuinely business-configurable things (departments, price lists); measurement units are a
  fixed, small, code-level set.

## 3. File attachment at Work Item creation (FR-003's "optional initial customer files")

**Decision**: This round of 011 does **not** implement file upload UI or storage wiring. The full
order form and add-Work-Item form reserve a visually clear placeholder slot ("Files: available once
050 ships") but no `<input type="file">` is wired to anything. No `WorkItem`-to-file relation is
added to the schema by this feature — 050 owns that model and will add its own FK when it ships.

**Rationale**: spec.md's own Assumptions section states "The 050-files feature's `FilePanel`
component is consumed, not built, here." 050 (File Storage & Versioning) has not started (it's
still in the Track B backlog, after 010). Building a throwaway upload mechanism now that 050 would
have to replace wholesale is waste; a labeled empty slot matches the same pattern already used for
other not-yet-built consumers on the order detail page (FR-009a) and keeps 011's scope honest about
what it actually delivers this round.

**Alternatives considered**:
- Build a minimal ad hoc upload-to-local-disk mechanism now: rejected — constitution IV requires
  files to go through *the* storage abstraction (`src/server/core/storage/adapter.ts`, already
  built by 002) with proper versioning metadata; a parallel one-off mechanism here would violate
  constitution I's "no parallel source of truth" spirit applied to files, and 050 would need to
  migrate or discard it.

## 4. Order/Work Item "completeness" check placement

**Decision**: `isOrderComplete()` lives in `src/server/orders/completeness.ts` as a pure function
(no DB access), taking an already-fetched order+workItems shape and returning `boolean`, mirroring
002's `deriveOrderStatus` pattern exactly (pure, synchronous, unit-testable with plain object
literals, called at read time — never persisted as a stored flag).

**Rationale**: Matches the existing precedent (`deriveOrderStatus`) this codebase already
established for "derived, never stored" values, and spec.md's own Edge Cases section implies
completeness must always reflect current data, not a stale flag set once at creation.

**Alternatives considered**:
- Stored `Order.isComplete` boolean, updated on every write: rejected for the same reason
  `deriveOrderStatus` isn't a stored column — risk of drift between the flag and reality is exactly
  what the derived-value pattern exists to eliminate, and 002's contract explicitly warns against
  this exact mistake ("Never persist the return value as if it were a database column").

## 5. Search implementation

**Decision**: `searchOrders()` runs a single Prisma query with `OR` conditions: exact match on
`Order.number` (when the query parses as an integer), `contains`/`mode: "insensitive"` on
`Customer.name`, and `contains` on a phone field. Phone search depends on 010's `Customer.phone`
field, which does not exist in the codebase yet (010 hasn't shipped) — `searchOrders()`'s phone
matching is written against the field name 010's spec/contract will define, guarded so search still
works (name + number only) if 010 hasn't landed when 011 is implemented.

**Rationale**: A single indexed query keeps this simple and correct for V1 scale (§5.5); guarding
the phone clause keeps 011 buildable independent of 010's exact merge timing without inventing a
duplicate phone field this feature would have to own and later reconcile.

**Alternatives considered**: Building 011's own minimal `Customer.phone` field now: rejected — same
"don't build a field another feature owns" reasoning as the file-upload deferral above; 010's spec
(PRI-7, in progress) is the authoritative owner of Customer's full profile fields.

## 6. Module boundary for `src/server/orders/**`

**Decision**: Add an `eslint.config.js` rule identical in shape to the existing
`src/server/core/**` and `src/server/auth/**` rules — code outside `src/server/orders/**` (except
`tests/**`) may only import from `~/server/orders` (the barrel), not its internal files.

**Rationale**: Established, working precedent in this codebase (two prior instances); keeps 012/
051/052/054 (all of which will need to read Order/WorkItem/ProductType data this feature owns)
honest about depending on a stable public surface rather than internal file layout.
