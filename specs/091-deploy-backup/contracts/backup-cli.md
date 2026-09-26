# Contract: Host Backup & Restore Scripts (`deploy/scripts/`)

Owner: 091. Consumers: systemd units, runbooks, `upgrade.sh`, and 050 (FR-024: `restoreObject`,
`verifyChecksum`).

## 1. Common rules (all scripts)

- `#!/usr/bin/env bash`, `set -Eeuo pipefail`, `IFS=$'\n\t'`. They are shellcheck-clean (CI
  `shellcheck -S style deploy/**/*.sh`).
- They source `lib/common.sh`, which provides `log` (JSON lines to the journal), `die`,
  `with_lock`, `load_conf` (reads `/etc/printex/backup/backup.conf`), `new_run_id` (UUID v4),
  `emit_report` (writes the spool file, §3), and `redact`, which strips anything matching the
  password files or `://user:pass@` from messages.
- **Idempotent**: re-running with the same arguments on a state that is already correct changes
  nothing and exits 0.
- **Never print secrets**: repository passwords come via `RESTIC_PASSWORD_FILE`, S3 keys via an env
  file, and the DB password via `~/.pgpass`.
- Configuration lives in `/etc/printex/backup/backup.conf` (shell `KEY=value`):
  - `SCHEDULE_TZ=Africa/Cairo`
  - `KEEP_DAILY=7`, `KEEP_WEEKLY=4`, `KEEP_MONTHLY=12`
  - `STALE_HOURS=26`, `NO_SUCCESS_BY=06:00`, `OVERRUN_HOURS=20`
  - `DISK_WARN_PCT=15`, `DISK_CRIT_PCT=5`
  - `USB_REPO=/media/printex-backup/restic`, `LAN_REPO=rest:https://…`, `OFFSITE_REPO=s3:…`
  - `REPORT_URL=https://printex.local/api/ops/backup-reports`
  - `CA_CERT=/srv/printex/caddy/pki/authorities/local/root.crt`

## 2. Commands and exit codes

| Script | Arguments | Runs as | Exit codes |
|---|---|---|---|
| `backup.sh` | `[--dest usb\|lan\|offsite\|all] [--tag nightly\|pre-upgrade] [--no-prune]` | `printex-backup` | `0` all requested destinations succeeded; `1` at least one failed (the others were still attempted); `75` another run holds the lock; `2` usage |
| `watchdog.sh` | none | `printex-backup` | `0` always (findings are reported, not exit-coded), `2` usage |
| `report.sh` | `[--flush]` | `printex-backup` | `0` spool empty after the run; `1` some reports were not delivered (they stay spooled) |
| `verify-restore.sh` | `[--repo usb\|lan\|offsite] [--snapshot latest\|<id>] [--sample 100] [--keep]` | root (unit hardened) | `0` PASS; `1` FAIL (counts differ, a checksum mismatched, or restic check failed); `3` WARNING (the checksum step was skipped because `FileObject` does not exist) |
| `restore.sh` | `--from usb\|lan\|offsite [--snapshot latest\|<id>] [--yes]` | root | `0` restored and smoke-passed; `1` failed (the log names the phase) |
| `restore-object.sh` | `<storageKey> [--repo …] [--snapshot latest\|<id>]` | root | `0` restored and verified, or already healthy (no-op); `4` not found in any snapshot; `5` the restored bytes do not match `FileObject.sha256` (nothing is placed); `1` other |
| `verify-objects.sh` | `[--all\|--sample N\|--key <storageKey>] [--out <file.csv>]` | `printex-backup` | `0` all checked objects match; `6` mismatches or missing objects found (listed in CSV: `storageKey,expectedSha256,actualSha256\|MISSING`) |
| `upgrade.sh` / `rollback.sh` / `smoke.sh` | see contracts/upgrade.md | root | see contracts/upgrade.md |
| `bootstrap-admin.sh` | `<username>` (password prompted, no echo) | root | `0` created; `10` an active Admin/Owner already exists (nothing changed); `11` password policy failed; `1` other |

### 2.1 `restoreObject` and `verifyChecksum` (050 FR-024)

050 FR-024 asks 091 to "expose `backup.restoreObject(storageKey, targetPath)` and
`backup.verifyChecksum(storageKey)`". 091 fulfils this as **host CLI operations**. They are not
in-app functions, because the application has no credentials for or network path to the backup
repositories (least privilege, research §5):

- `verifyChecksum(storageKey)` ≡ `verify-objects.sh --key <storageKey>`. It streams
  `/srv/printex/files/<050 path for storageKey>`, computes sha256, and compares it with
  `FileObject.sha256` (read as `printex_backup`).
- `restoreObject(storageKey, targetPath)` ≡ `restore-object.sh <storageKey>`. `targetPath` is
  always 050's canonical path for that key under `STORAGE_ROOT`, and no arbitrary target is
  allowed. If a file exists there and matches, it is a no-op. If it exists and does not match, it
  is moved to `/srv/printex/quarantine/<storageKey>.<ts>` (never deleted). The script then runs
  `restic restore --include <path>` into `verify-tmp/`, checks sha256, and places the file with an
  atomic `mv` and the original owner and mode.
- Marking a `FileObject` `CORRUPTED` and the re-upload flow remain 050's in-app Admin actions,
  fed by `verify-objects.sh --out`.
- 050 must expose its key → path function as a documented rule: `${root}/${key[0..1]}/${key[2..3]}/${key}`,
  per 050 contracts/storage.md. If 050 changes it, both scripts change.

## 3. Report JSON (spool file → `POST /api/ops/backup-reports`)

File: `/srv/printex/backup-state/spool/<runId>-<kind>-<destination>-<check or "none">.json`, mode 0640.
`check` is omitted for BACKUP/VERIFY (stored as `""`) and is required for HEALTH.

```json
{
  "runId": "5b1e…-uuid-v4",
  "kind": "BACKUP",
  "destination": "USB",
  "outcome": "FAILED",
  "reasonCode": "DESTINATION_UNAVAILABLE",
  "message": "USB repository path not mounted",
  "startedAt": "2026-09-25T00:00:03Z",
  "finishedAt": "2026-09-25T00:00:04Z",
  "snapshotId": null,
  "bytesAdded": null,
  "diskFreeBytes": null,
  "diskFreePct": null,
  "counts": null,
  "occurredAt": "2026-09-25T00:00:04Z"
}
```

The fields and rules are exactly data-model.md "Validation rules". BigInt fields are decimal
strings.

## 4. Reason codes

`DESTINATION_UNAVAILABLE`, `DESTINATION_FULL`, `INSUFFICIENT_SPACE`, `DUMP_FAILED`,
`RESTIC_FAILED`, `PRUNE_FAILED`, `LOCK_HELD`, `RUN_OVERRUN`, `NO_SUCCESS_TODAY`, `STALE`,
`COUNTS_MISMATCH`, `CHECKSUM_MISMATCH`, `CHECKSUM_SKIPPED`, `REPO_CHECK_FAILED`, `DISK_LOW`,
`DISK_CRITICAL`, `UPS_ON_BATTERY_SHUTDOWN`, `POWER_RESTORED`.

## 5. Delivery guarantees

- A report is written to the spool **before** any delivery attempt. `report.sh` POSTs it, and
  deletes it only on 201 (recorded) or 200 (duplicate).
- On any other response or a network error the report stays spooled and is retried by the
  hourly watchdog. Spool files older than 30 days are kept but logged, never silently dropped.
- The app side is idempotent on `(runId, kind, destination, check)` (contracts/backup-health.md).

## 6. Timers

| Unit | Schedule | Notes |
|---|---|---|
| `printex-backup.timer` | `OnCalendar=*-*-* 02:00:00 Africa/Cairo`, `Persistent=true`, `RandomizedDelaySec=0` | `Persistent=true` runs a missed run at boot. The watchdog still reports MISSED if it did not succeed |
| `printex-backup-watchdog.timer` | `OnCalendar=hourly`, `Persistent=true` | also flushes the spool |
| `printex-verify-restore.timer` | `OnCalendar=Sun 04:00 Africa/Cairo` | reports kind `VERIFY` |
| LAN PC prune task | Sun 05:00 local | on the second PC, not the server |

## 7. UPS hooks

`upssched-cmd` runs on `ONBATT` for more than `UPS_ONBATT_SECONDS` (300) or on `LOWBATT`. It calls
`emit_report HEALTH NONE WARNING UPS_ON_BATTERY_SHUTDOWN check=ups.shutdown`, then `upsmon -c
fsd`. The report stays spooled and is delivered after the next boot.
