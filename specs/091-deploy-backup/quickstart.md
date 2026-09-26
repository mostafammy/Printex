# Quickstart & Validation: Deployment, Backup & Hardening (091)

These scenarios validate the feature end to end. **CI** scenarios run automatically in
`.github/workflows/deploy.yml`. **Host** scenarios run on the real server or on a staging VM or
spare PC. **Drill** scenarios are timed and recorded in `deploy/drills/DRILL-LOG.md` (date,
operator, duration, outcome, deviations).

Prerequisites for host scenarios:

- An Ubuntu 24.04 LTS machine that meets the minimum spec (research §1), with a separate data disk
  mounted at `/srv/printex`.
- The repo checked out at a release tag.
- `deploy/env/printex.env.example` copied to `/etc/printex/printex.env` (mode 0600) and filled in.
- The backup destinations prepared: the USB drive labelled `PRINTEX-BKP`, the LAN PC running
  rest-server (`deploy/lan-pc/`), and the S3 bucket and keys.

---

## Scenario 0: CI gates (CI, every PR touching `deploy/**`, `prisma/**`, `src/env.js`, `next.config.js`)

1. `shellcheck -S style` on every `deploy/**/*.sh` → 0 findings.
2. `bats deploy/tests` → all pass.
3. `hadolint deploy/docker/Dockerfile` → 0 errors.
4. `docker compose -f deploy/compose/compose.yaml config` → valid. The `exposure` job asserts that
   only `proxy` publishes ports, each prefixed with `${LAN_IP}`, and that `backend.internal ==
   true`.
5. The image builds for `runner` and `tools`. Every `FROM` line and every compose `image:` uses
   `@sha256:` (the `pin-check` job greps for `:latest` or tags without a digest).
6. `migrations` job: `migrate deploy` on an empty DB, then the drift check exits 0.

**Expected**: all green. Any failure blocks the merge.

## Scenario 1: Fresh install and first Admin (Host, US1)

```bash
sudo deploy/host/install.sh                 # reads /etc/printex/printex.env
sudo deploy/scripts/bootstrap-admin.sh owner
```

1. `install.sh` completes. `systemctl is-active printex` → active, and `docker compose ps` → proxy,
   app and db all healthy.
2. The bootstrap prompts for a password. `short` → exit 11 (policy). A 14-character password →
   exit 0.
3. Run the bootstrap again → exit 10 ("an active Admin/Owner already exists"), and nothing
   changes.
4. From a staff PC with the root certificate installed (onboarding runbook), open
   `https://printex.local`. The sign-in page shows with no certificate warning. Sign in as `owner`.
5. Check the DB: `Department` has 5 rows, the Cash Customer exists, the `system_ops` user exists
   with no `Account` row, and there are **no** sample orders or dev users. The audit log has
   `system.bootstrap_admin` with a null actor.

**Timing**: record the total time for SC-001 context (the target is to be usable the same day).

## Scenario 2: Idempotent re-run (Host, US1, FR-004)

1. Run `sudo deploy/host/install.sh` again. It exits 0, and the log shows every step as "already
   configured".
2. `ufw status numbered`, `/etc/ssh/sshd_config.d/99-printex.conf`, the unit files and
   `images.lock` are byte-identical to before (compare a `sha256sum` snapshot taken before the
   run).
3. No container was recreated (`docker inspect -f '{{.State.StartedAt}}'` is unchanged).

## Scenario 3: Configuration failures refuse to start (Host + CI, FR-008)

For each of these, edit `/etc/printex/printex.env`, run `systemctl restart printex`, and check that
the `app` container exits and the logs name the key without printing its value:

- `BETTER_AUTH_SECRET` shorter than 32 characters
- `BETTER_AUTH_URL=http://…`
- `DATABASE_URL` using the `printex_owner` user
- `OPS_REPORT_TOKEN` missing
- `STORAGE_ROOT=./.storage`

Restore the file and the app becomes healthy. The same cases are covered by
`tests/unit/ops/env.test.ts`.

## Scenario 4: Nightly backup and a destination failure (Host, US2)

1. Trigger a run: `sudo systemctl start printex-backup.service`. Then run `journalctl -u
   printex-backup -o cat` and check there are 3 `SUCCEEDED` lines with snapshot ids.
2. For each repository, `restic -r <repo> snapshots --latest 1` shows the snapshot, tagged
   `nightly`, containing `db/printex.dump`, `db/counts.json`, `files/` and `config/`. It contains
   no `files/.tmp`.
3. `/admin/backups` (signed in as Admin) shows all 3 destinations with a "last success" within
   minutes, and none overdue.
4. Unplug the USB drive and run the backup again. Exit 1. LAN and off-site are `SUCCEEDED`, and USB
   is `FAILED DESTINATION_UNAVAILABLE`. Within 1 minute every Admin has an `ops.backup.failed`
   notification and the USB row is red.
5. Run it again while still unplugged. No second notification (20h dedupe), but a second
   `BackupReport` row exists.
6. Start two runs at once. The second exits 75 (`LOCK_HELD`).
7. As `printex-backup`, `docker ps` → permission denied (it is not in the docker group), and
   `psql` as `printex_backup` with an `INSERT` → permission denied.

## Scenario 5: Retention (CI via bats + Host spot check, FR-019)

The bats `backup-args.bats` test asserts that `forget` is called with `--keep-daily 7
--keep-weekly 4 --keep-monthly 12`. On the LAN PC, the prune task log shows the same policy, and
the server's append-only credentials fail `restic forget` (expected: permission denied).

## Scenario 6: Weekly automated restore verification (Host + CI, US3, FR-026)

1. Run `sudo systemctl start printex-verify-restore.service`. Exit 0 → PASS, which shows counts
   equal, 100 sampled objects matching, and the restic check passing. A `VERIFY SUCCEEDED` report
   appears on `/admin/backups`.
2. **Negative** (on staging only): corrupt one pack file in a copy of the USB repository, then
   run `verify-restore.sh --repo usb`. Exit 1 `REPO_CHECK_FAILED` or `CHECKSUM_MISMATCH`, and
   Admins get `ops.backup.verify_failed`.
3. CI `restore-roundtrip` job: bring up the stack, seed the reference profile plus fixtures,
   create file objects, run `backup.sh --dest usb` against a local directory repository, run
   `verify-restore.sh`, and assert exit 0. Then tamper with one object in the restored copy
   (test hook `VERIFY_TAMPER=1`) and assert exit 1.

## Scenario 7: Restore drill on a clean machine, timed (Drill, US3, SC-001, brief acceptance criterion)

Start the clock when the engineer has a clean machine with Ubuntu installed and the recovery kit
(research §7 RTO definition).

1. Follow `deploy/runbooks/restore.md`:
   - clone the release
   - `install.sh --restore`
   - `restore.sh --from usb --snapshot latest`
2. `restore.sh` prints `COUNTS OK` (every table equals `counts.json`), `SAMPLE OK`, and `SMOKE
   OK`.
3. Staff PCs connect again (the same name, and the internal CA is restored from
   `config/caddy/pki`, so no new certificate is needed). Sign in, open yesterday's last order, and
   download one of its files.
4. Stop the clock. **Pass if ≤ 4 h** and nothing from before the backup time is missing.
5. Repeat quarterly, rotating the source (USB → LAN → off-site). Record each run in
   `DRILL-LOG.md`.

## Scenario 8: Single-object restore (Host, 050 FR-024)

1. Pick a `storageKey` of an existing object and overwrite its file with garbage.
2. `verify-objects.sh --key <k>` → exit 6, and the CSV shows the mismatch.
3. `restore-object.sh <k>` → exit 0. The damaged file is in `/srv/printex/quarantine/`, the
   canonical path has the original bytes, and `verify-objects.sh --key <k>` → exit 0.
4. `restore-object.sh <k>` again → exit 0 (no-op).
5. `restore-object.sh <unknown>` → exit 4.

## Scenario 9: Exposure and port scans (Host + Drill, US4, SC-004, brief acceptance criterion)

1. **External**: from outside the shop network (a phone hotspot or cloud VM), run `nmap -Pn -p-
   --open <shop-public-ip>`. Expected: no open ports leading to the server. Record the output in
   `deploy/runbooks/port-scan.md` with the date. Repeat after any router change.
2. **LAN**: `nmap -p- printex.local` from a staff PC → only `80/tcp` and `443/tcp`. From
   `ADMIN_IP` → `22`, `80` and `443`.
3. `pg_isready -h <server-lan-ip> -p 5432` from a staff PC → no response.
4. `curl -k https://printex.local/api/health` from a staff PC → 404. The same from the server → 200.
5. `curl -k -X POST https://printex.local/api/ops/backup-reports` from a staff PC → 404.
6. SSH with a password from `ADMIN_IP` → refused (publickey only). SSH from a staff PC → timeout.
7. Temporarily add `ports: ["5432:5432"]` to `db` on staging and bring it up. From the LAN the port
   is still unreachable (DOCKER-USER), and the CI `exposure` job fails on that compose file.

## Scenario 10: Cookies and headers (Host, FR-014/FR-015)

In the browser dev tools after signing in:

- The session cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, with the `__Secure-` prefix.
- The response headers include `Content-Security-Policy` with `default-src 'self'`,
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and
  `frame-ancestors 'none'`.
- `http://printex.local` redirects to https.

## Scenario 11: Missed backup alert (Host + CI, US5, SC-003, brief acceptance criterion)

1. On staging: `systemctl disable --now printex-backup.timer`, and let the clock pass 06:00 (or
   set the time on the VM).
2. The next watchdog run (≤ 1 h) posts `HEALTH MISSED NO_SUCCESS_TODAY` per destination. Every
   active Admin has one `ops.backup.missed` notification, and `/admin/backups` shows all three
   overdue.
3. Stop the app for the watchdog run, then start it. The report stays spooled and is delivered by
   the next watchdog run (at-least-once), with no duplicate row.
4. Integration test coverage: `tests/integration/ops/recordBackupReport.test.ts` (missed →
   notified, dedupe) and `backupStatus.test.ts` (no reports → overdue). The bats `watchdog.bats`
   test covers the 26h/06:00 rules with a fake clock.

**Pass**: the alert arrives within 2 hours of 06:00 (SC-003).

## Scenario 12: Disk alerts (Host, US5)

On staging, fill the data disk to below 15 % free with `fallocate`. The next watchdog run →
`ops.disk.low`. Below 5 % → `ops.disk.critical`. Free the space, and the next status shows
`SUCCEEDED` for `disk.data`.

## Scenario 13: Offline order → delivery (CI + Drill, US6, SC-005, brief acceptance criterion)

1. **CI `offline-boot`**: `docker compose -f compose.yaml -f compose.offline.yaml up` (every network
   `internal: true`). The sign-in page returns 200. `tests/e2e-offline` (a Playwright-less
   curl script) signs in with a seeded user via the credential endpoint and gets a session.
   The build contains no references to `fonts.googleapis.com`/`fonts.gstatic.com` (a grep over
   `.next`).
2. **Drill**: unplug the router's WAN cable (the LAN stays up). Walk the full lifecycle with real
   staff roles:
   - reception creates a customer and an order with a file
   - design review
   - pricing
   - production start and finish
   - collection and delivery

   Every step succeeds, with no spinner waiting on the internet. Record it in `DRILL-LOG.md`.
3. While still unplugged, the nightly backup's off-site destination fails (an alert, as expected),
   and USB and LAN succeed.

## Scenario 14: Upgrade and forced rollback (CI + Host, US7, SC-008)

1. CI `upgrade-rehearsal` (contracts/upgrade.md §4): upgrade to the current build → DONE. Upgrade
   to the broken image → ROLLED_BACK, and the fixture order is intact.
2. Host: `sudo deploy/scripts/upgrade.sh <new-digest> <new-tools-digest>`. The maintenance page
   shows during the run. The pre-upgrade USB snapshot is tagged `pre-upgrade`, the smoke test
   passes, and the prompt asks for a manual Admin sign-in. Answer OK → DONE. `upgrade.log` has
   the entry.
3. Unplug the USB before an upgrade → it stops at BACKUP with exit 1, and the app is back on the
   old release (US7-2).
4. Answer NO at the prompt → ROLLED_BACK. Data created before the upgrade is present, and the
   version shown is the previous one.

## Scenario 15: UPS graceful shutdown (Host, FR-006)

1. With the NUT driver connected, run `upsc printex-ups` to show the status.
2. Pull the UPS mains plug. After 300 s on battery, `upssched-cmd` fires. The spool gets an
   `ups.shutdown` report, then `docker compose down` and `poweroff` run. Postgres logs "database
   system is shut down" (a clean shutdown).
3. Restore power and boot. The stack comes up, the spooled report is delivered, and Admins see
   `ops.ups.shutdown`. Postgres does not need crash recovery.
4. Record it in `DRILL-LOG.md`.

## Scenario 16: Staff onboarding (Drill, SC-009)

Follow `deploy/runbooks/onboarding.md` on a new Windows PC and an Android phone:

- install the root CA
- bookmark `https://printex.local`, or `https://printex.lan` on Android if mDNS fails
- sign in for the first time

Pass if it takes under 10 minutes per device (SC-009).
