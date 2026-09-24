# Contract: Backup Health (`src/server/ops/**`, `POST /api/ops/backup-reports`, `/admin/backups`)

Owner: 091. Cross-team: **053** (delivery of the notifications, §5) and **001** (permission key and
service user, §2).

All commands and queries use the **shared aspect layer** exactly as defined in
[016 contracts/aspects.md](../../016-change-control/contracts/aspects.md). The module binding is:

```ts
// src/server/ops/aspect.ts
import { aspects } from "~/server/aspects";
import type { OpsError } from "./errors";
export const { defineCommand, defineQuery } = aspects.forModule<OpsError>({
  module: "ops",
  mapUniqueViolation: (target) =>
    target.includes("runId") ? { code: "DUPLICATE_REPORT" } : undefined,
});
export type OpsResult<T> = import("~/server/core").AspectResult<T, OpsError>;
```

## 1. Errors (`src/server/ops/errors.ts`)

```ts
export type OpsError =
  | { readonly code: "DUPLICATE_REPORT" }          // same (runId, kind, destination, check) already recorded
  | { readonly code: "CLOCK_SKEW"; readonly occurredAt: string };   // occurredAt > now + 10 min
```

The base errors (`VALIDATION`, `FORBIDDEN`, …) are inherited from `AspectBaseError`.

## 2. Actor for machine reports (`src/server/ops/systemActor.ts`)

```ts
export async function getSystemOpsActor(): Promise<Actor>;  // Actor from ~/server/auth
```

- It loads the `User` with id `system_ops`. The user must exist, be `isActive`, and have **no**
  credential `Account`. Otherwise it throws `UnauthenticatedError`.
- It builds `permissions` from `RolePermission` ∪ `UserPermission`, the same derivation as
  `getActorForSession`. The seeded result is `{ "ops.backup.report" }`.
- It is never exported from the barrel for use by UI code. Only the report route imports it.

## 3. `recordBackupReport` (command)

```ts
export const recordBackupReport = defineCommand({
  action: "backup_report.record",
  input: backupReportInputSchema,           // data-model.md "Validation rules"
  permission: "ops.backup.report",
  allowNoChange: true,
  run: async (ctx) => { … },
});
// public: (actor: Actor, raw: unknown) => Promise<OpsResult<{ reportId: string; duplicate: boolean; notified: boolean }>>
```

The `run` step, inside one transaction:

1. If `occurredAt > now + 10 min`, `fail({ code: "CLOCK_SKEW" })`.
2. Look up an existing row by `(runId, kind, destination, check)`. If one is found, return
   `{ value: { reportId, duplicate: true, notified: false }, noChange: true }`.
3. Insert `BackupReport`. `check` is normalised to `""` for BACKUP/VERIFY.
4. `alerts.classify(report)` → `AlertSpec | null` (data-model.md §3 table: type, entityType,
   entityId, messageKey).
5. If there is an alert spec, and no `NotificationEvent` with the same `type` and `entityId` exists
   with `createdAt > now − 20h`, then `notify(ctx.tx, { type, entity, recipients: { userIds:
   await adminConfigHolders(ctx.tx) }, payload })`. An empty recipient list still writes the event
   (053 can alert on "no recipients"), and the Admin page shows it.
6. Return `{ value: { reportId, duplicate: false, notified }, audit: [{ action:
   "backup_report.recorded", entityType: "BackupReport", entityId: reportId, after: { kind,
   destination, outcome, reasonCode, check } }] }`.

A concurrent duplicate insert is a P2002, which maps to `DUPLICATE_REPORT`. The route treats
`DUPLICATE_REPORT` as 200.

`adminConfigHolders(tx)` returns the ids of **active** users with `admin.config` through
`UserRole → RolePermission` or `UserPermission`, sorted and deduplicated. It uses one query, with
no per-user queries.

## 4. `getBackupStatus` (query)

```ts
export const getBackupStatus = defineQuery({
  input: z.object({}).strict(),
  permission: "admin.config",
  run: async ({ client }) => BackupStatus,
});

type DestinationStatus = {
  destination: "USB" | "LAN_PC" | "OFFSITE";
  lastSuccessAt: string | null;
  overdue: boolean;                         // lastSuccessAt == null || < now − BACKUP_STALE_HOURS
  lastResult: { outcome: BackupOutcome; reasonCode: string | null; occurredAt: string } | null;
  lastVerify: { outcome: BackupOutcome; reasonCode: string | null; occurredAt: string } | null;
};
type BackupStatus = {
  destinations: readonly DestinationStatus[];      // always exactly the 3, in fixed order
  disks: readonly { check: "disk.data" | "disk.os"; lastOutcome: BackupOutcome; diskFreePct: string | null; occurredAt: string }[];
  openAlerts: readonly { type: string; entityId: string; createdAt: string }[];  // ops.* NotificationEvents in the last 7 days
  staleAfterHours: number;
};
```

It makes at most 4 queries, whatever the row count: a `groupBy`/`DISTINCT ON` per destination,
and indexed by `[destination, kind, outcome, occurredAt]`.

The page `src/app/(shell)/admin/backups/page.tsx` is a server component:

- It calls `getActor()` then `getBackupStatus(actor, {})`. On `FORBIDDEN` it shows the standard
  not-authorised page.
- It is read-only: no buttons that act on backups (out of scope: backup management UI).
- It is Arabic RTL, with `ops.*` keys in `src/messages/ar.json`. Overdue destinations show a red
  badge.

## 5. Notification port for 053 (cross-team, Fady)

| `type` | Meaning | Payload keys |
|---|---|---|
| `ops.backup.failed` | a destination's backup failed or overran | `reportId, destination, reasonCode, messageKey` |
| `ops.backup.missed` | no success today, or older than the stale window | `reportId, destination, lastSuccessAt, messageKey` |
| `ops.backup.verify_failed` | the weekly restore verification failed | `reportId, destination, reasonCode, messageKey` |
| `ops.disk.low` / `ops.disk.critical` | disk below 15 % / 5 % free | `reportId, disk ("data"\|"os"), diskFreePct, messageKey` |
| `ops.ups.shutdown` | the server was shut down by the UPS | `reportId, occurredAt, messageKey` |

Rules for 053:

- These are **internal, in-app** notifications for the listed `userIds`. They MUST NOT go to
  WhatsApp or any internet channel by default, because they must work offline.
- 053 renders `messageKey` from `ar.json` (`ops.alert.<type>`).
- 053 owns `deliveredAt` and `deliveryStatus`. 091 never writes them.
- If 053 later adopts permission-based recipients, 091 switches `recipients` to `{ permissions:
  ["admin.config"] }` in `alerts.ts` only. The event types stay stable.

**Fallback until 053 exists**: the rows exist in `NotificationEvent`, and `getBackupStatus`
shows them as `openAlerts`. This satisfies the acceptance criterion by itself (spec Assumptions).

## 6. `POST /api/ops/backup-reports` (route handler)

`src/app/api/ops/backup-reports/route.ts`, runtime `nodejs`:

| Step | Behaviour |
|---|---|
| 1 | `Authorization: Bearer <token>` is required. Compare with `env.OPS_REPORT_TOKEN` using `crypto.timingSafeEqual` on equal-length buffers. A mismatch or missing header → **401** `{ error: "UNAUTHENTICATED" }`, with nothing read from the body |
| 2 | Body size ≤ 16 KB, JSON. Otherwise **400** |
| 3 | `actor = await getSystemOpsActor()` |
| 4 | `result = await recordBackupReport(actor, body)` |
| 5 | `ok && !duplicate` → **201** `{ reportId, notified }`. `ok && duplicate`, or `DUPLICATE_REPORT` → **200** `{ reportId?, duplicate: true }`. `VALIDATION` / `CLOCK_SKEW` → **422** with the issues. `FORBIDDEN` → **403** |

The Caddyfile returns 404 for `/api/ops/*` unless `remote_ip` is the server's LAN IP or the docker
`edge` gateway (defense in depth). The route never logs the token or the body.

## 7. Authorization table

| Entry point | Authentication | Permission | Scope |
|---|---|---|---|
| `POST /api/ops/backup-reports` | bearer token → `system_ops` actor | `ops.backup.report` | none (global) |
| `/admin/backups` page → `getBackupStatus` | Better Auth session → `getActor()` | `admin.config` | none |
| `GET /api/health` | none (contracts/health.md, Complexity Tracking) | none | none |

## 8. Tests (required)

- Unit `tests/unit/ops/alerts.test.ts`: classification table (every kind × outcome × check), and
  the dedupe window boundary (19h59 → skip, 20h01 → notify).
- Unit `tests/unit/ops/reportSchema.test.ts`: every validation rule, BigInt strings, and
  destination/kind combinations.
- Integration `tests/integration/ops/recordBackupReport.test.ts`: insert + audit in the same tx;
  duplicate → noChange with no second audit; concurrent duplicate → `DUPLICATE_REPORT`; failure →
  exactly one `NotificationEvent` to every active `admin.config` holder (a deactivated Admin is
  excluded); a second failure within 20h → no new event; `CLOCK_SKEW`; an actor without the
  permission → `FORBIDDEN`.
- Integration `tests/integration/ops/reportRoute.test.ts`: 401 on a missing or wrong token (and a
  timing-safe path), 201/200/422, body over 16 KB → 400.
- Integration `tests/integration/ops/backupStatus.test.ts`: overdue derivation at read time (no
  reports → overdue), `FORBIDDEN` without `admin.config`, and a fixed query count.
- Contract `tests/contract/ops/append-only.test.ts`: `UPDATE`/`DELETE` on `"BackupReport"` as
  `printex_app` → permission denied.
- Contract `tests/contract/ops/notify-shape.test.ts`: event types and payload keys equal §5.
