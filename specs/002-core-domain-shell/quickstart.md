# Quickstart: Core Domain & Shell

Validates that this feature's slice works end to end once implemented. Run after `/speckit-tasks`
→ `/speckit-implement` complete the build.

## Prerequisites

- Postgres running locally (`./start-database.sh`, existing T3 script) with `DATABASE_URL` and a
  second `DATABASE_URL_TEST` pointing at a separate database on the same instance.
- `pnpm install` (pulls in the new Vitest/shadcn dependencies added by this feature).
- `pnpm db:push` (or `prisma migrate dev`) against `prisma/schema/` to apply the split schema.

## 1. Seed and inspect the data model

```bash
pnpm prisma db seed
pnpm prisma studio
```

**Expected**: a `Department` table with a few rows, one `Customer` with `isCashCustomer = true`,
and a couple of seeded `Order`/`WorkItem` rows — proves the seed script (FR-016) and the
multi-file schema (research.md §1) both work.

## 2. Run the automated suite

```bash
pnpm check      # lint + typecheck
pnpm test       # vitest, against DATABASE_URL_TEST
```

**Expected**: the table-driven 15×15 transition test passes (every edge in
[data-model.md](./data-model.md#allowed-edges-table-authoritative) succeeds; every other pair
raises `INVALID_TRANSITION`), and the audit-rollback test proves a failed `audit.record` call rolls
back the `WorkItem.state` write (User Story 2, spec Acceptance Scenario 3).

## 3. Exercise `transitionWorkItem` directly

```ts
// tests/integration/transition-smoke.ts (or a REPL via `pnpm tsx`)
import { transitionWorkItem } from "~/server/core";

await db.$transaction(async (tx) => {
  const wi = await transitionWorkItem(tx, {
    workItemId: seededWorkItemId,
    to: "ASSIGNED",
    actor: { id: seededUserId, roles: ["reception"], departmentIds: [] },
  });
  console.log(wi.state); // "ASSIGNED"
});
```

**Expected**: one new `WorkItemTransition` row and one audit event, both referencing the same
actor/timestamp; `WorkItem.state` updated. Retrying with an invalid `to` (e.g. `"DELIVERED"`)
returns/throws `INVALID_TRANSITION` and leaves the row untouched.

## 4. Check `deriveOrderStatus`

```ts
import { deriveOrderStatus } from "~/server/core";

deriveOrderStatus([{ state: "DELIVERED" }, { state: "IN_PRODUCTION" }]);
// → "PARTIALLY_READY"
```

**Expected**: matches the six-bucket rule in
[data-model.md](./data-model.md#order-status-derivation-bucket-rule-from-speckit-clarify) for all
combinations exercised by the unit test suite (SC-003).

## 5. Load the app shell

```bash
pnpm dev
```

Open `http://localhost:3000` as a seeded user.

**Expected**: page renders right-to-left in Arabic (`<html dir="rtl" lang="ar">`), the sidebar
shows only sections the seeded user's role permits, and `/my-queue` renders the placeholder
landing page (User Story 3). Inspect the shell's stylesheet output — no `ml-`/`mr-`/`pl-`/`pr-`
classes should appear (SC-007; also enforced by the added lint rule).

## 6. Confirm CI

Open a PR touching any file under `src/server/core/`. **Expected**: `.github/workflows/ci.yml`
runs automatically and must pass before merge (SC-006).

## Handing off to Fady

Once steps 1–4 pass locally, the contracts in [contracts/](./contracts/) are considered frozen —
point Fady at them for 001/010/050/053 to build against without needing this feature's internals.
