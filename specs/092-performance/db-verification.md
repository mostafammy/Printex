# DB Verification — 092-performance (DB-001…DB-005, AC-019/AC-020)

Evidence artifact for T035 (repo source-of-truth) and T036 (deployed schema/indexes).
Constraints honored: **strictly read-only** — no DDL, no migrations, no schema edits; Prisma CLI limited to `migrate status`; SQL limited to `pg_indexes`/`pg_tables`/`_prisma_migrations` catalog reads and `EXPLAIN` (**no ANALYZE**).

- Part 1 (T035) compiled: **2026-09-30 09:15 EDT**
- Part 2 (T036) executed: **2026-09-29 → 2026-09-30**, Prisma CLI **6.19.3**, repo branch `fix-nav-slow`

---

## Part 1 — Repo source-of-truth (T035) · 2026-09-30

### (a) Prisma schema configuration (file evidence)

`package.json`:

```json
"prisma": { "schema": "prisma/schema", "seed": "node prisma/seed.ts" }
```

`prisma/schema/schema.prisma:9` (generator block):

```prisma
previewFeatures = ["prismaSchemaFolder", "relationJoins"]
```

- `prismaSchemaFolder` makes `prisma/schema/` a multi-file schema folder (schema entry = the **folder**, per `package.json#prisma.schema`).
- Datasource declares `directUrl = env("DIRECT_URL")` (`schema.prisma:21`) — migration commands bypass the pgbouncer pooler (port 6543) and connect on 5432.
- CLI note (stderr, verbatim): ``warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7.`` — irrelevant to resolution today (Prisma 6.19.3).

### (b) Full migration-tree inventory (`ls`, verbatim)

`prisma/migrations/` — **6 migrations** (+ `migration_lock.toml`):

```
0_init
20260923150000_customers
20260923160000_orders_reception
20260924175658_016_change_control
20260926_board_live_and_send_to_production
20260926140000_workitem_order_perf_indexes
migration_lock.toml
```

`prisma/schema/migrations/` — **4 migrations** (+ `migration_lock.toml`):

```
20260924084346_add_files_schema
20260924170000_pricing
20260925000000_finance
20260926090000_notifications
migration_lock.toml
```

All 10 directories contain `migration.sql` (checked individually).

### (c) Which directory `prisma migrate deploy` / `migrate status` resolves

**Reasoning (from Prisma docs behavior + config):** Prisma resolves the migrations directory **relative to the schema's location**, not the project root. `package.json` points the schema at the folder `prisma/schema` (with `prismaSchemaFolder`), so the expected migrations directory is `prisma/schema/migrations` (sibling of the schema files).

**Empirical confirmation (decisive probe, Prisma 6.19.3, 2026-09-30):**

| Step | Action | `prisma migrate status` result |
|---|---|---|
| 1 | baseline run | `4 migrations found in prisma/migrations` → up to date |
| 2 | temp migration added under **`prisma/migrations/99999999999999_zzprobe`** | **still 4 found** (root tree ignored) |
| 3 | temp migration added under **`prisma/schema/migrations/99999999999999_zzprobe`** | **5 found**, probe name listed as pending |
| 4 | both probes deleted (repo restored; both trees re-listed clean) | — |

The found-count (4) matches the schema tree exactly and the schema-tree probe alone changed the count → **the resolved directory is `prisma/schema/migrations`**.

**Display caveat:** the CLI prints `4 migrations found in prisma/migrations` even though it reads `prisma/schema/migrations` — the printed path string (apparently `dirname(package.json#prisma.schema)` = `prisma` + `/migrations`) does **not** match the directory actually scanned. Do not trust the printed path alone; the count/probe evidence above is authoritative.

**Confidence: CONFIRMED** (empirical probe on this machine, this Prisma version; docs reasoning agrees).

### (d) Where the performance indexes live · 091 plan · CI

- `workitem_order_perf_indexes` lives **only in the root tree**: `prisma/migrations/20260926140000_workitem_order_perf_indexes/migration.sql` — contains `WorkItem_state_idx`, `WorkItem_assigneeId_state_idx`, `Order_customerId_idx` (`CREATE INDEX IF NOT EXISTS`, lines 7–9).
- `WorkItem_state_idx` is **also declared in the schema**: `prisma/schema/core.prisma:224` `@@index([state])` (and `:225` `@@index([assigneeId, state])`) → `prisma db push` recreates it from the schema regardless of migration trees.
- **R1/R2/R3 exist nowhere in the repo schema or either migration tree** — grep over `prisma/` for `state_createdAt_id|archivedAt_createdAt|entityId_action_createdAt` → **no matches**.
- **091's plan** (`specs/091-deploy-backup`): baseline is planned in the **root tree** — `data-model.md:163` `prisma/migrations/0_baseline/migration.sql` (generated via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema`), plus `1_baseline_constraints`; `plan.md:63-66`; `research.md §11` (`migrate resolve --applied 0_baseline`). Deployment command: `contracts/compose.md:39` → **`pnpm exec prisma migrate deploy --schema prisma/schema`**. `plan.md:249`: CI switches from `db push` to `migrate deploy` post-baseline.
- **CI today** (`.github/workflows/ci.yml:97`): **`pnpm exec prisma db push --skip-generate`**, then manual SQL (`prisma/manual-sql/016-change-control-constraints.sql`, ci.yml:106) — CI environments are shaped from the **.prisma declarations**, not from either migration tree.
- **Drift observation (for T038 / 091, recorded only):** 091's baseline target path (`prisma/migrations/0_baseline`, root tree) ≠ the directory `migrate deploy` actually reads (`prisma/schema/migrations`) — the baseline fold must land in the tree proven authoritative here, or resolution must be reconciled in 091. 092 performs no tree rewrite (DB-004, FR-027).

### (e) Conclusion — which tree a production deploy consumes, and what it implies for R1–R3

A production deploy that runs the documented `prisma migrate deploy --schema prisma/schema` (091 `compose.md:39`) consumes **`prisma/schema/migrations` only** — the 4-migration tree (`add_files_schema`, `pricing`, `finance`, `notifications`). The root tree (`0_init`, `customers`, `orders_reception`, `016_change_control`, `board_live…`, **`workitem_order_perf_indexes`**) is **not consumed by `migrate deploy` at all**. CI instead uses `db push`, which ignores both trees and materializes `prisma/schema/*.prisma`.

Implications:

1. **R1–R3 are produced by no path today**: not by either migration tree, not by `db push` (no schema declarations), not by manual SQL in CI. Whatever environment exists, R1–R3 are absent **unless created manually** — must be verified live (Part 2).
2. `WorkItem_state_idx` and the change-control tables (`SpecVersion`, `ChangeRequest`, `LateCancellation`) are double-sourced for `db push` (schema declarations + root-tree SQL) but **single-sourced (root tree) for `migrate deploy`** — a `migrate deploy`-only environment that never ingested the root tree would lack them; 091's `0_baseline` exists to close exactly that gap.
3. Because CI = `db push`, **the verified database (Part 2) reflects the schema + `db push` history**, which is why `_prisma_migrations` holds only the 4 schema-tree migrations.

---

## Part 2 — Deployed schema & indexes (T036) · executed 2026-09-29→30

> **Database label:** all checks ran against the database configured in the local `.env`. `DATABASE_URL_TEST`, `DATABASE_URL`, and `DIRECT_URL` were each connected (read-only) and resolve to the **same PostgreSQL instance and database**: identical `current_database() = postgres`, identical server address (`2a05:d018:837:ae00:a09b:290f:87cd:dafc/128`), identical `pg_postmaster_start_time() = 2026-09-22 15:10:12.815667+00`, and identical `_prisma_migrations` rows. Host for all three: `aws-1-eu-west-1.pooler.supabase.com` (TEST/DIRECT on :5432, DATABASE_URL on :6543 pgbouncer). **Per task instructions this is treated as the TEST/dev database; production reachability may differ** (the investigation recorded `P1001` from its machine — here all three URLs connected with no error). A production deploy that injects different env vars must re-run Part 2 against that target before any DDL (T037's hard gate).

### 2.1 `prisma migrate status` (verbatim)

```
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Environment variables loaded from .env
Prisma schema loaded from prisma\schema
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-eu-west-1.pooler.supabase.com:5432"

4 migrations found in prisma/migrations

Database schema is up to date!
```

Exit code **0**. No errors. Datasource used **:5432** (DIRECT_URL bypass of the pooler, as declared). Directory resolution: see Part 1(c) — the `prisma/migrations` path string is a display quirk; the scanned directory is **`prisma/schema/migrations`** (4 migrations = the count shown).

### 2.2 `_prisma_migrations` (applied history, read-only)

| migration_name | finished_at |
|---|---|
| `20260924084346_add_files_schema` | 2026-09-24 11:43:47 +0300 |
| `20260924170000_pricing` | 2026-09-24 22:53:28 +0300 |
| `20260925000000_finance` | 2026-09-27 11:49:32 +0300 |
| `20260926090000_notifications` | 2026-09-27 11:49:33 +0300 |

Exactly the schema-tree 4. **No root-tree rows** (`0_init`, `workitem_order_perf_indexes`, `016_change_control`, …) — consistent with `db push` shaping the database plus four `migrate deploy`/`migrate` runs of the schema tree.

### 2.3 Index inventory — `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN (…)` (22 rows)

Note: the investigation's lowercase filter (`'workitem','order','file_object'`) misses the unmapped tables `WorkItem`, `Order`, `FileObject` (no `@@map` in `core.prisma`/`files.prisma`), so the filter was run case-insensitively (`lower(tablename) IN (…,'fileobject')`). Verbatim results:

| table | index | key columns |
|---|---|---|
| WorkItem | `WorkItem_pkey` | `id` (unique) |
| WorkItem | `WorkItem_state_idx` | `state` |
| WorkItem | `WorkItem_assigneeId_state_idx` | `"assigneeId", state` |
| WorkItem | `WorkItem_orderId_state_idx` | `"orderId", state` |
| WorkItem | `WorkItem_currentSpecVersionId_key` | `"currentSpecVersionId"` (unique) |
| Order | `Order_pkey` | `id` (unique) |
| Order | `Order_customerId_idx` | `"customerId"` |
| Order | `Order_number_key` | `number` (unique) |
| notification | `notification_pkey` | `id` (unique) |
| notification | `notification_userId_idx` | `"userId"` |
| notification | `notification_userId_readAt_createdAt_idx` | `"userId", "readAt", "createdAt" DESC` |
| notification | `notification_userId_type_createdAt_idx` | `"userId", type, "createdAt" DESC` |
| notification | `notification_sourceEventId_idx` | `"sourceEventId"` |
| notification | `notification_sourceEventId_userId_key` | `"sourceEventId", "userId"` (unique) |
| audit_event | `audit_event_pkey` | `id` (unique) |
| audit_event | `audit_event_action_createdAt_idx` | `action, "createdAt"` |
| audit_event | `audit_event_actorId_createdAt_idx` | `"actorId", "createdAt"` |
| audit_event | `audit_event_entityType_entityId_idx` | `"entityType", "entityId"` |
| FileObject | `FileObject_pkey` | `id` (unique) |
| FileObject | `FileObject_sha256_key` | `sha256` (unique) |
| FileObject | `FileObject_sha256_idx` | `sha256` (non-unique) |
| FileObject | `FileObject_storageKey_key` | `"storageKey"` (unique) |

Change-control tables confirmed present (from the same catalog read): `SpecVersion`, `ChangeRequest`, `LateCancellation` — i.e. this database carries the 016 tables even though `_prisma_migrations` has no `016` row (db push origin).

### 2.4 Representative query plans — `EXPLAIN` only, **no ANALYZE** (test/dev DB; row estimates only)

**Board lane** (`lanePage`: `state` equality → `ORDER BY createdAt, id` → `LIMIT 50`):

```
Limit  (cost=979.37..979.50 rows=50 width=34)
  ->  Sort  (cost=979.37..990.14 rows=4305 width=34)
        Sort Key: "createdAt", id
        ->  Bitmap Heap Scan on "WorkItem"  (cost=43.55..836.36 rows=4305 width=34)
              Recheck Cond: (state = 'NEW'::"WorkItemState")
              ->  Bitmap Index Scan on "WorkItem_state_idx"  (cost=0.00..42.48 rows=4305 width=0)
                    Index Cond: (state = 'NEW'::"WorkItemState")
```

Filters via single-column `WorkItem_state_idx`, then **full sort** — R1 compound absent, sort not eliminated (investigation §9 R1 rationale confirmed).

**Bell list** (`center.ts`: `userId` + `archivedAt IS NULL` → `ORDER BY createdAt DESC` → `LIMIT 10`):

```
Limit  (cost=2.51..2.51 rows=1 width=34)
  ->  Sort  (cost=2.51..2.51 rows=1 width=34)
        Sort Key: "createdAt" DESC
        ->  Index Scan using "notification_userId_idx" on notification (cost=0.28..2.50 rows=1 width=34)
              Index Cond: ("userId" = 'dummy-user-id'::text)
              Filter: ("archivedAt" IS NULL)
```

Scans the user's notifications then **filters + sorts** — no index leads with `archivedAt`; R2 absent (investigation §9 R2 rationale confirmed).

**Order-detail audit probe** (`orders/[orderId]/page.tsx:456`: `entityId` + `action` → `ORDER BY createdAt ASC` → `LIMIT 1`):

```
Limit  (cost=179.11..179.11 rows=1 width=34)
  ->  Sort  (cost=179.11..179.11 rows=1 width=34)
        Sort Key: "createdAt"
        ->  Bitmap Heap Scan on audit_event  (cost=4.05..179.10 rows=1 width=34)
              Recheck Cond: (action = 'order.created'::text)
              Filter: ("entityId" = 'dummy-entity'::text)
              ->  Bitmap Index Scan on "audit_event_action_createdAt_idx"  (cost=0.00..4.04 rows=208 width=0)
                    Index Cond: (action = 'order.created'::text)
```

Uses `audit_event_action_createdAt_idx` on `action` only, then **filters `entityId` and sorts** — no index leads with `entityId`; R3 absent (investigation §9 R3 rationale confirmed).

No `EXPLAIN ANALYZE` was run (per T036 instruction: `EXPLAIN` without ANALYZE is sufficient and risk-free).

---

## VERDICT — indexes present/missing ON THE VERIFIED DATABASE

> Scope caveat: **"verified database" = the database reachable via local `.env` (`DATABASE_URL_TEST`; `DATABASE_URL` and `DIRECT_URL` connect to the same instance/database — proven in Part 2 header). This is labeled TEST/dev per task instructions; production reachability was not independently proven. All verdicts are explicitly about this verified database.**

- **VERDICT R1 `WorkItem_state_createdAt_id_idx` (WorkItem state+createdAt+id compound): MISSING** on the verified database — `WorkItem` carries only `state`, `(assigneeId,state)`, `(orderId,state)` single/compound indexes; EXPLAIN shows sort not eliminated. *(test/dev DB)*
- **VERDICT R2 `Notification_userId_archivedAt_createdAt_idx` (userId+archivedAt+createdAt): MISSING** on the verified database — no `notification` index references `archivedAt`; EXPLAIN shows filter+sort. *(test/dev DB)*
- **VERDICT R3 `audit_event_entityId_action_createdAt_idx` (entityId+action+createdAt): MISSING** on the verified database — no `audit_event` index leads with `entityId`; EXPLAIN shows action-index scan + entityId filter + sort. *(test/dev DB)*
- **VERDICT `FileObject_sha256_idx`: PRESENT as an exact duplicate** of the unique `FileObject_sha256_key` (both on `sha256`) on the verified database — drop candidate per investigation §9 "free win". *(test/dev DB)*
- Supporting: `WorkItem_state_idx` **present**; change-control tables present; `migrate status` **succeeded, exit 0, "Database schema is up to date!"**; **no access errors** on any of the three `.env` URLs.

**Consequences for T037/T038:** on this verified (test/dev) database R1–R3 are missing and the duplicate `FileObject_sha256_idx` exists, which would make T037's conditional DDL *candidate* — but T037 remains **gated**: (1) confirm the production target's reachability and re-run Part 2 there if the production env differs from `.env`; (2) apply any index migration **only in `prisma/schema/migrations`** (the tree Part 1 proved authoritative) with DB-005 write-cost notes; (3) the migration-tree/baseline drift observation in Part 1(d) is a **091 dependency** (DB-004/FR-027) — no tree rewrite in 092.

---

## Part 3 — T037 applied index migration · 2026-09-30

Conditional gate open per VERDICT above (R1/R2/R3 MISSING, `FileObject_sha256_idx` duplicate PRESENT on verified test/dev DB). One migration authored in the authoritative tree (Part 1(c)):

- **Migration dir**: `prisma/schema/migrations/20260930090000_nav_perf_indexes/` (`migration.sql`)
- Contents: `CREATE INDEX IF NOT EXISTS "WorkItem_state_createdAt_id_idx" ON "WorkItem" ("state", "createdAt", "id")`; `CREATE INDEX IF NOT EXISTS "Notification_userId_archivedAt_createdAt_idx" ON "notification" ("userId", "archivedAt", "createdAt" DESC)`; `CREATE INDEX IF NOT EXISTS "audit_event_entityId_action_createdAt_idx" ON "audit_event" ("entityId", "action", "createdAt")`; `DROP INDEX IF EXISTS "FileObject_sha256_idx"` — header comment cites 092 T037 + this file (2026-09-30) + DB-005 write-cost notes; replay-safe guards.
- **Deploy**: `prisma migrate deploy` via CLI with `DATABASE_URL`/`DIRECT_URL` overridden to `DATABASE_URL_TEST` (same instance/database as proven in Part 2 header) — `_prisma_migrations` row: `20260930090000_nav_perf_indexes` finished `2026-09-30T06:25:04.604Z`; post-deploy `migrate status` → `5 migrations found` / `Database schema is up to date!` (exit 0).
- **Post-DDL `pg_indexes` confirmation**:
  - `WorkItem | WorkItem_state_createdAt_id_idx | CREATE INDEX "WorkItem_state_createdAt_id_idx" ON public."WorkItem" USING btree (state, "createdAt", id)`
  - `notification | Notification_userId_archivedAt_createdAt_idx | CREATE INDEX "Notification_userId_archivedAt_createdAt_idx" ON public.notification USING btree ("userId", "archivedAt", "createdAt" DESC)`
  - `audit_event | audit_event_entityId_action_createdAt_idx | CREATE INDEX "audit_event_entityId_action_createdAt_idx" ON public.audit_event USING btree ("entityId", action, "createdAt")`
  - `FileObject_sha256_key` retained (unique); `FileObject_sha256_idx` absent (0 rows).
- **Checks**: `pnpm exec vitest run tests/integration/shell-layout-queries.test.ts` → 1 file / 3 tests passed (exit 0). `pnpm exec tsc --noEmit` → exit 2 with 6 errors all in `tests/integration/phaseDurationsBatch.test.ts` (pre-existing, untracked file from another workstream; no TS touched by T037 — only the migration dir + this file).
- **Notes**: identifiers verified against `prisma/schema/*.prisma` (`WorkItem`/`FileObject` unmapped, `Notification` → `@@map("notification")`, `AuditEvent` → `@@map("audit_event")`); R2 index name keeps spec-mandated `Notification_…` casing per tasks.md/db-verification VERDICT while the table is `"notification"`. `files.prisma:61 @@index([sha256])` still declares the dropped index — future `db push` would recreate it; removing the schema declaration is a schema-model change out of T037 scope (flagged for 091 baseline fold / follow-up).

## Part 4 — T055 `pg_trgm` customer-name index applied · 2026-09-30

- **Migration dir**: `prisma/schema/migrations/20260930084032_customer_name_trgm/` (`migration.sql`), authored in the authoritative tree (Part 1(c)). Contents (verbatim):
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "Customer_normalizedName_trgm_idx" ON "Customer" USING gin ("normalizedName" gin_trgm_ops);
  ```
  Header comment cites 092 T055 + investigation §7.2 + DB-005 write-cost notes; replay-safe `IF NOT EXISTS` guards (same convention as `20260930090000_nav_perf_indexes`). Identifiers verified against `prisma/schema/core.prisma`: `model Customer` has **no `@@map`** → table `"Customer"`; column `normalizedName String @default("")` → `"normalizedName"`; existing btree sibling index `Customer_normalizedName_idx` (from `20260924084346_add_files_schema`) confirms casing. **No `*.prisma` edit** (tasks.md T055: Prisma schema does not model trgm indexes — raw-SQL only).
- **Deploy**: `pnpm exec prisma migrate deploy` via CLI with `DATABASE_URL`/`DIRECT_URL` exported to the `.env` `DATABASE_URL_TEST` value (T037 env-override pattern; same instance/database as proven in Part 2 header; credentials never printed). Output (verbatim essentials):
  ```
  Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-eu-west-1.pooler.supabase.com:5432"
  6 migrations found in prisma/migrations
  Applying migration `20260930084032_customer_name_trgm`
  migrations applied:
    └─ 20260930084032_customer_name_trgm/
        └─ migration.sql
  All migrations have been successfully applied.
  ```
  Exit code **0** — `CREATE EXTENSION pg_trgm` was **not** permission-denied on the verified (test/dev) database; no improvising, no `db push` needed.
- **Post-DDL `pg_indexes` confirmation** (`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='Customer' AND indexname LIKE '%trgm%'` — via `pg` client against `DATABASE_URL_TEST`, read-only):
  ```
  Customer | Customer_normalizedName_trgm_idx | CREATE INDEX "Customer_normalizedName_trgm_idx" ON public."Customer" USING gin ("normalizedName" gin_trgm_ops)
  ROWS=1
  extension: pg_trgm 1.6
  ```
- **`prisma migrate status`**: `6 migrations found in prisma/migrations` / `Database schema is up to date!` — exit **0**. `_prisma_migrations` now includes `20260930084032_customer_name_trgm`.
- **Notes / fidelity gap (091 follow-up)**: `pg_indexes`/schema drift in the OTHER direction of T037's case — the GIN index exists in the database but is **not declared in `prisma/schema/*.prisma`** (no Prisma syntax for `gin_trgm_ops` raw operator class without an `unsupported()` column hack, which T055 forbids editing models for). A future `prisma db push` compares schema↔database and would **drop** `Customer_normalizedName_trgm_idx` (unknown to the schema) unless it is baselined into 091's migration-tree fold or recorded as an accepted out-of-schema index. Phone `startsWith` on `CustomerPhone.phoneE164` left btree-served per scope. No code touched by this part beyond the migration dir + this file.
