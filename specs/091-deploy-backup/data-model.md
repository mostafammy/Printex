# Data Model: Deployment, Backup & Hardening

091 adds **one** application table (`BackupReport`) and one seeded service user. It defines the
**database roles** of the production cluster and the **migration baseline** steps (research
§11). Everything else (restore points, drill log, upgrade log, recovery kit) lives outside the
application database.

## 1. `prisma/schema/ops.prisma` (new)

```prisma
/// Kind of host-side event being reported (contracts/backup-cli.md §3).
enum BackupReportKind {
  BACKUP        // one nightly/pre-upgrade backup run, per destination
  VERIFY        // weekly automated restore verification
  HEALTH        // watchdog finding: missed backup, disk space, UPS shutdown
}

/// Where the finding applies. NONE is used (not NULL) so the idempotency
/// unique key works — Postgres treats NULLs as distinct.
enum BackupDestination {
  USB
  LAN_PC
  OFFSITE
  NONE
}

enum BackupOutcome {
  SUCCEEDED
  FAILED
  MISSED
  WARNING
  CRITICAL
}

/// Append-only (REVOKE UPDATE, DELETE in migration 2_ops_backup_report).
/// Written only by src/server/ops/recordBackupReport.ts.
model BackupReport {
  id            String            @id @default(cuid())
  /// Host-generated UUIDv4 per script invocation (idempotency key part).
  runId         String
  kind          BackupReportKind
  destination   BackupDestination
  outcome       BackupOutcome
  /// Machine-readable reason code, e.g. DESTINATION_UNAVAILABLE (contracts/backup-cli.md §4).
  reasonCode    String?
  /// Human-readable detail, ≤ 2000 chars, never contains secrets (scripts redact).
  message       String?
  /// HEALTH findings: which check ("backup.stale", "backup.overrun", "disk.data", "disk.os",
  /// "ups.shutdown"). "" (empty) for BACKUP/VERIFY, never NULL, so the unique key below works.
  check         String            @default("")
  startedAt     DateTime?
  finishedAt    DateTime?
  /// BACKUP only: restic snapshot id (short, 8 hex) and bytes added.
  snapshotId    String?
  bytesAdded    BigInt?
  /// HEALTH disk findings: free bytes and percent at check time.
  diskFreeBytes BigInt?
  diskFreePct   Decimal?          @db.Decimal(5, 2)
  /// BACKUP/VERIFY: record counts at dump time / verified counts (FR-021, FR-024).
  counts        Json?
  /// Host clock when the event happened (UTC).
  occurredAt    DateTime
  /// Server clock at receipt (UTC).
  receivedAt    DateTime          @default(now())

  @@unique([runId, kind, destination, check])
  @@index([destination, kind, outcome, occurredAt])
  @@index([occurredAt])
}
```

`check` is part of the unique key because one watchdog run can emit several HEALTH findings (for
example `disk.data` and `disk.os`) with the same `runId`. For BACKUP/VERIFY it is stored as `""`.

### Validation rules (Zod, `src/server/ops/reportSchema.ts`)

| Field | Rule |
|---|---|
| `runId` | UUID v4 |
| `kind` | enum |
| `destination` | enum. `NONE` is allowed only for `HEALTH` checks `disk.*`/`ups.shutdown`. `BACKUP`/`VERIFY` require USB, LAN_PC or OFFSITE |
| `outcome` | enum. `BACKUP`: SUCCEEDED or FAILED. `VERIFY`: SUCCEEDED, FAILED or WARNING (checksum step skipped). `HEALTH`: MISSED, WARNING, CRITICAL, FAILED (run exceeded 20 h) or SUCCEEDED (UPS power restored) |
| `reasonCode` | `^[A-Z_]{3,64}$`, required when the outcome is not SUCCEEDED |
| `message` | ≤ 2000 chars |
| `check` | one of `backup.stale`, `backup.overrun`, `disk.data`, `disk.os`, `ups.shutdown`. Required for HEALTH. Absent for BACKUP/VERIFY, and stored as `""` |
| `startedAt ≤ finishedAt` | when both are present |
| `bytesAdded`, `diskFreeBytes` | integer ≥ 0, sent as a decimal string (JSON has no BigInt) |
| `diskFreePct` | 0–100, two decimals |
| `counts` | `{ orders, workItems, auditEvents, users, fileObjects? }`, all non-negative integers |
| `occurredAt` | ISO-8601 UTC. It must not be more than 10 min in the future relative to the server clock (a clock sanity check) |

### State and lifecycle

A `BackupReport` row has no state transitions: it is inserted once and never updated or deleted.
The derived per-destination **status** (contracts/backup-health.md §4) is computed at read time:

- `lastSuccessAt` = max `occurredAt` where `kind=BACKUP ∧ outcome=SUCCEEDED`
- `lastResult` = the latest BACKUP row
- `lastVerify` = the latest VERIFY row
- `overdue` = `lastSuccessAt` is null or `lastSuccessAt < now − BACKUP_STALE_HOURS` (default 26)

Retention: rows are kept forever. At about 10 rows per day this is about 3,650 rows per year,
which is negligible.

## 2. Seeded service user (reference seed profile)

| Field | Value |
|---|---|
| `User.id` | `system_ops` |
| `username` | `system-ops` |
| `email` | `system-ops@local.invalid` |
| `isActive` | `true` (so `getActor`-style resolution accepts it) |
| `Account` | **none**. No credential row exists, so it can never sign in through Better Auth |
| `UserRole` | none |
| `UserPermission` | exactly one: `ops.backup.report` (granted by the seed, `grantedBy` null) |

The new permission key `ops.backup.report` is added to 001's `Permission` union (Fady). No role
is seeded with it, and the role-permission matrix test asserts that no role holds it.

## 3. Notification events written (existing `NotificationEvent`, 002)

| `type` | `entityType` | `entityId` | Trigger |
|---|---|---|---|
| `ops.backup.failed` | `BackupDestination` | `USB` / `LAN_PC` / `OFFSITE` | BACKUP FAILED, or HEALTH `backup.overrun` |
| `ops.backup.missed` | `BackupDestination` | destination | HEALTH `backup.stale` MISSED |
| `ops.backup.verify_failed` | `BackupDestination` | destination | VERIFY FAILED |
| `ops.disk.low` | `Disk` | `data` / `os` | HEALTH `disk.*` WARNING |
| `ops.disk.critical` | `Disk` | `data` / `os` | HEALTH `disk.*` CRITICAL |
| `ops.ups.shutdown` | `Ups` | `ups` | HEALTH `ups.shutdown` WARNING |

Recipients: `{ userIds: <active users holding admin.config via RolePermission or UserPermission> }`.
Payload: `{ reportId, destination, reasonCode, messageKey, lastSuccessAt?, diskFreePct? }`.

Dedupe: no new event is written if a `NotificationEvent` with the same `type` and `entityId` has
`createdAt > now − 20h`. The lookup uses the existing index `@@index([entityType, entityId])`.

## 4. Database roles (`deploy/scripts/db-roles.sql`, not a migration)

| Role | Attributes | Privileges | Used by |
|---|---|---|---|
| `printex_owner` | LOGIN, NOSUPERUSER, NOCREATEROLE, NOCREATEDB | owns database `printex` and schema `public`, and all DDL | `migrate` job only (`DIRECT_URL`) |
| `printex_app` | LOGIN, NOSUPERUSER, NOINHERIT | `CONNECT`, `USAGE ON SCHEMA public`, `SELECT, INSERT, UPDATE, DELETE` on all tables, `USAGE, SELECT` on sequences. Through `ALTER DEFAULT PRIVILEGES FOR ROLE printex_owner` it gets the same on future tables. Append-only tables are revoked per migration | `app` (`DATABASE_URL`), and `tools` read checks |
| `printex_backup` | LOGIN, NOSUPERUSER | member of `pg_read_all_data` (PG ≥ 14) | `backup.sh`, over the local socket only |
| `postgres` | superuser | used only by `db` container init and the restore of the roles | never over the network |

`pg_hba.conf` (mounted read-only into `db`):

```text
local   all       postgres                        peer
local   printex   printex_backup                  scram-sha-256
host    printex   printex_app,printex_owner  <backend-subnet>  scram-sha-256
host    all       all                        0.0.0.0/0         reject
```

The script is idempotent: it uses `DO $$ … IF NOT EXISTS … $$` for roles, then `ALTER ROLE …
PASSWORD` from psql variables passed by `install.sh`/`restore.sh` (the passwords never appear in
the file).

## 5. Migration baseline (research §11, PROPOSED, decision for owner and Fady)

| Step | Artifact | Content |
|---|---|---|
| 1 | `prisma/migrations/0_baseline/migration.sql` | `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema --script` at the freeze commit |
| 2 | `prisma/migrations/1_baseline_constraints/migration.sql` | `REVOKE UPDATE, DELETE ON audit_event FROM printex_app;`, plus 016's partial unique index and REVOKEs (and 015/050 equivalents present at freeze), rewritten to be idempotent and to target `printex_app` by name |
| 3 | `prisma/migrations/migration_lock.toml` | `provider = "postgresql"` |
| 4 | existing dev DBs | zero-drift `migrate diff --from-url … --exit-code`, delete the 3 obsolete `_prisma_migrations` rows, `db execute` step 2's file, then `migrate resolve --applied 0_baseline` and `1_baseline_constraints` |
| 5 | `prisma/migrations/2_ops_backup_report/migration.sql` (091) | the `ops.prisma` DDL plus `REVOKE UPDATE, DELETE ON "BackupReport" FROM printex_app;` |

**Data preservation**: steps 1–3 are schema-only. Step 4 changes only `_prisma_migrations`
bookkeeping on non-production DBs. Step 5 is additive. Production is created fresh from these
migrations, so nothing is lost. The rollback for step 5 is "redeploy the previous image; the
table remains unused".

**Role dependency**: the migrations reference `printex_app` by name, so every environment that
runs `migrate deploy` must have run `db-roles.sql` first. CI already creates `printex_app`
(ci.yml "Create non-superuser app role"). Local developer DBs get a documented one-liner.
