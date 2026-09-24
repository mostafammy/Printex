# Research: Deployment, Backup & Hardening

Each section follows the format: Decision / Rationale / Alternatives considered. Section numbers
are referenced from plan.md, the contracts, and tasks.md.

## §1 Server target and disk layout

**Decision**: Ubuntu Server 24.04 LTS, x86-64. Hardware is **not decided** (owner, 2026-09-24). This
feature fixes only the floor and the target:

| | Minimum | Recommended |
|---|---|---|
| CPU | 4 cores / 8 threads, x86-64, 2018 or newer (e.g. Intel i5-8xxx, Ryzen 5 2xxx) | 6–8 cores |
| RAM | 16 GB | 32 GB (ECC if the platform allows) |
| OS disk | 256 GB SSD | 512 GB NVMe |
| Data disk | 1 TB SSD, separate physical disk | 2 × 2 TB SSD mirrored (mdadm RAID1) |
| Network | 1 GbE wired, static DHCP reservation | same, plus a spare NIC |
| USB | one USB 3 port for the backup drive, one for the UPS | same |
| UPS | line-interactive, ≥ 1000 VA, USB HID supported by NUT (runtime ≥ 10 min at server load) | ≥ 1500 VA, pure sine |
| Backup USB drive | ≥ 2 × the data disk's used space at 3 years | 4 TB |

**Sizing rule** (FR-001): data disk ≥ 1.5 × (DB + files projected at 3 years) + the largest single
DB dump (staging) + 10 % headroom. The 050 file limit (5 GB each) and an expected 0.5–1 TB at 3
years give the 1 TB minimum and the 2 TB recommendation.

**Layout**: The OS disk holds `/`, `/var/lib/docker` and `/var/log`. The data disk (ext4, mounted
by UUID at `/srv/printex`, `noatime`) holds:

```text
/srv/printex/
├── postgres/        # PGDATA (owned by container uid 999)
├── pg-socket/       # host-visible unix socket dir (0750 root:printex-backup)
├── files/           # STORAGE_ROOT (050 objects; .tmp/ excluded from backup)
├── caddy/           # Caddy /data: internal CA root + intermediate, certs
├── backup-staging/  # tonight's dump + counts (overwritten nightly)
├── backup-state/    # last-success-<dest>, spool/, lock, upgrade log, releases
├── quarantine/      # objects moved aside by restore-object.sh
└── verify-tmp/      # weekly verification scratch (emptied after each run)
```

`printex.service` has `RequiresMountsFor=/srv/printex`, so a missing disk keeps Postgres from
initialising an empty cluster on the OS disk (spec US1-6).

**Alternatives considered**:

- Debian 12, which is equally good. It was rejected only because the brief names Ubuntu LTS and
  Ubuntu has a longer standard support window (to 2029).
- One disk with partitions (a disk failure loses both the OS and the data, and there is no I/O
  isolation).
- ZFS (snapshots are attractive, but it adds operational skill the team does not have, and restic
  already provides point-in-time copies).

## §2 Container stack and pinning

**Decision**:

- **Docker Engine + Compose v2** from Docker's apt repo, with the package version pinned in
  `install.sh`.
- The services are `proxy` (Caddy 2.8), `app` (the Printex runner image), `db` (postgres:16,
  matching CI's `postgres:16`), one-shot `migrate` and `tools` (the Printex tools image), and a
  `worker` slot under `profiles: ["worker"]` reserved for 053.
- Every image reference is `repo:version@sha256:<digest>`, kept in one `deploy/compose/images.lock`
  that compose reads through env interpolation. A CI job fails if any reference lacks a digest.
- The Printex image is built by CI with a multi-stage `deploy/docker/Dockerfile`:
  1. `deps`: `node:22-bookworm-slim`, then `pnpm install --frozen-lockfile`.
  2. `build`: `SKIP_ENV_VALIDATION=1 pnpm build` with `output: "standalone"`.
  3. `runner`: `node:22-bookworm-slim`, uid 10001. It copies `.next/standalone`, `.next/static`,
     `public`, and `generated/prisma`, including the query engine for `debian-openssl-3.0.x`. It
     runs `node server.js`.
  4. `tools`: the `deps` stage plus the source, providing the `prisma` CLI, `prisma/seed.ts` and
     `prisma/bootstrap-admin.ts`.
- `generator client` gains `binaryTargets = ["native", "debian-openssl-3.0.x"]`.
- If the standalone trace misses the engine, use `outputFileTracingIncludes: { "/**":
  ["./generated/prisma/**"] }`, which is verified by the CI image smoke test.

**Rationale**:

- Standalone gives a small runtime image with no dev dependencies, and there is no toolchain in
  production.
- Separating out the `tools` image keeps the Prisma CLI and the owner role out of the running app
  (least privilege, FR-012).
- Pinning by digest makes an upgrade an explicit, reversible choice (FR-003).

**Alternatives considered**:

- Podman plus quadlets (fine, but the team and CI already use Docker, and `start-database.sh` is
  Docker-first).
- Running `next start` with full `node_modules` (a 1 GB+ image carrying dev dependencies).
- Tags without digests (a tag can be moved under us).
- Kubernetes or k3s (out of scope).

## §3 LAN-only networking, TLS and hostname

**Decision**:

- **Caddy** is the only container with published ports: `${LAN_IP}:443:443` and `${LAN_IP}:80:80`.
  It never binds to `0.0.0.0`.
- The site block is `printex.local, printex.lan { tls internal … }`. Caddy's local CA (root valid
  10 years, auto-renewed intermediate and leaf) works fully offline. Its data dir is on the data
  disk and in backup scope.
- The root certificate `root.crt` is exported once to `deploy/runbooks/onboarding.md` steps for
  Windows, macOS, iOS and Android.
- **mDNS**: `avahi-daemon` publishes `printex.local`. The router's DNS has an entry for
  `printex.lan` (fallback). The server keeps a DHCP reservation.
- **Networks**:
  - `edge` (proxy ↔ app) is a normal bridge network.
  - `backend` (app ↔ db, tools ↔ db) is `internal: true`, so the db has no egress and no published
    port.
- **Firewall**:
  - UFW defaults are deny incoming and allow outgoing. There are allow rules for 443/80 from
    `LAN_CIDR` and for 22 from `ADMIN_IP` only.
  - Docker's published ports bypass UFW's INPUT chain. `install.sh` therefore adds rules to the
    `DOCKER-USER` chain (in `/etc/ufw/after.rules`): conntrack ESTABLISHED/RELATED → RETURN,
    `-s LAN_CIDR -p tcp -m multiport --dports 80,443` → RETURN, everything else to the published
    ports → DROP.
- The Caddyfile blocks `/api/ops/*` and `/api/health` for any `remote_ip` other than the server's
  LAN IP and the docker bridge gateway. The response is 404.

**Rationale**: This covers spec US4 and FR-009–FR-011. Binding to the LAN IP plus `DOCKER-USER`
gives two independent layers, so a UFW mistake alone does not expose anything.

**Alternatives considered**:

- nginx plus mkcert (mkcert is a developer tool, and renewal is manual).
- step-ca (a full CA, more than one server needs).
- Traefik (label-driven configuration is overkill for one site).
- Plain HTTP on the LAN, a public domain with ACME certificates, or an IP-only URL (all rejected
  in spec Clarifications).

## §4 Backup tool and destinations

**Decision**: restic 0.17 (a pinned static binary, sha256-verified by `install.sh`), with **three
independent repositories**:

1. **USB**: `/media/printex-backup/restic` (ext4 USB disk, mounted by UUID with `nofail`, owned by
   `printex-backup`).
2. **LAN PC**: `rest:https://printex-backup:<pw>@<lan-pc>:8000/printex/`. restic `rest-server`
   runs on the second PC with `--append-only --private-repos` and TLS from the server's internal
   CA. The PC prunes locally with its own scheduled task (`restic forget --prune`, using the repo
   password), because append-only mode refuses deletes from the server.
3. **Off-site**: `s3:<endpoint>/<bucket>/printex`, using any S3-compatible provider
   (credentials in `/etc/printex/backup/offsite.env`). The provider's object versioning or object
   lock is enabled where available.

Each repository has its own password file (`/etc/printex/backup/<dest>.pass`, 0640
root:printex-backup). All three passwords are in the recovery kit.

**Rationale**:

- restic encrypts everything client-side (AES-256-CTR plus Poly1305), which satisfies "encrypt
  before upload" (confirmed decision) and keeps the USB drive unreadable if it is stolen.
- It deduplicates, so immutable 050 objects are uploaded once. Nightly deltas are only new uploads
  plus the dump.
- It supports all three backends natively and has built-in retention (`forget --keep-*`) and
  integrity checks (`check --read-data-subset`).
- `rest-server --append-only` stops a compromised server from destroying the LAN copy (spec
  Clarification).

**Alternatives considered**:

- BorgBackup (no native S3 support; it would need rclone).
- `pg_dump` plus `tar` plus `age` plus rclone (hand-rolled retention, no dedup, three tools to glue
  together).
- pgBackRest or WAL-G (DB only, adds WAL archiving; point-in-time recovery is not required by
  RPO 24h).
- Duplicati (GUI-first, harder to script and test).
- An SMB share on the second PC (not append-only, and ransomware-exposed).

## §5 Backup run: consistency, order, user, counts

**Decision**: `backup.sh` (systemd `printex-backup.service`, `User=printex-backup`, timer
`OnCalendar=*-*-* 02:00 Africa/Cairo`, `Persistent=true`) does the following:

1. It takes the `flock` lock at `/srv/printex/backup-state/lock`. If the lock is busy it exits 75
   and reports "already running".
2. **Preflight**:
   - Free space on `backup-staging` must be at least 1.2 × the last dump size, otherwise it fails
     early with `INSUFFICIENT_SPACE`.
   - Each destination is probed. If the USB is not mounted it reports `DESTINATION_UNAVAILABLE`,
     and so on.
3. **DB first**, from one exported snapshot, so the counts and the dump see identical data:
   - A `psql` session as `printex_backup` (`pg_read_all_data`, host socket, `~/.pgpass`) opens a
     `REPEATABLE READ` transaction, calls `pg_export_snapshot()`, and writes `counts.json` using
     `record-counts.sql` (`Order`, `WorkItem`, `audit_event`, `user`, and `FileObject` if the
     table exists).
   - While that session stays open, `pg_dump --snapshot=<id> --format=custom --compress=zstd:6
     --no-owner` writes the dump.
   - `pg_dumpall --globals-only --no-role-passwords` writes the roles (for reference only;
     restore recreates roles from `db-roles.sql`).
4. **Then files and config**: `restic backup` of `backup-staging/`, `files/` (with `--exclude
   files/.tmp`), `/etc/printex/`, `deploy/` (the release checkout), `caddy/`, `/etc/nut/`,
   `/etc/ufw/`, and the systemd units. Tags are `nightly` and `run:<runId>`. This runs once per
   destination, **sequentially and independently**: each destination's exit code is recorded, and
   one failing never short-circuits the others.
5. Retention: `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune` runs on the
   USB and off-site repositories (a `--group-by host,tags` policy with the `nightly` tag).
6. One report per destination goes through `report.sh` (spool first). `last-success-<dest>` is
   updated only on success.

The DB dump is taken before the file snapshot. Objects are immutable and content-addressed, so
every object the dump references already exists when the file snapshot starts. Objects uploaded
after the dump are harmless extras (spec US2-3).

`printex-backup` is not in the `docker` group, so it cannot control containers. It reads `files/`
and `caddy/` through POSIX default ACLs (`setfacl -d -m g:printex-backup:rX`) and
`/etc/printex/printex.env` through group read.

**Alternatives considered**:

- `docker compose exec db pg_dump` (needs the docker group, which is root-equivalent).
- A filesystem snapshot of PGDATA (not consistent without LVM or ZFS snapshots).
- One `restic copy` chain from USB to the others (if the USB fails, every copy is lost that night).
- Counting in a separate transaction after the dump (rows committed in between would make the
  exact-match check in §7 fail spuriously).

## §6 Retention, keys, recovery kit

**Decision**:

- Retention is 7/4/12 (ASSUMPTION, spec). On the LAN PC, a scheduled `restic forget --prune` runs
  Sundays at 05:00 local time.
- Keys:
  - Each repository has its own password, generated with `openssl rand -base64 48` by
    `install.sh --init-backup`.
  - A second restic key (`restic key add`) is created for the recovery kit, so rotation never
    locks out old restore points.
- **Recovery kit** (`deploy/runbooks/recovery-kit.md`, a template only with no secrets in git):
  - the three repository URLs and passwords
  - off-site credentials
  - LAN-PC rest-server credentials
  - the `printex.env` secrets needed to keep existing sessions and password hashes valid
    (`BETTER_AUTH_SECRET`; DB passwords are regenerated on restore)
  - the admin SSH public key fingerprint
  - the restore runbook version

  It is printed and sealed in two locations (owner), and re-issued on any change.

**Alternatives considered**: a password manager only (it may itself be on a lost machine, though
it is allowed as a third copy); a single password for all repositories (one leak exposes every
copy).

## §7 Restore and verification

**Decision**:

- `restore.sh --from usb|lan|offsite [--snapshot latest|<id>]` runs on a fresh Ubuntu host:
  1. `install.sh` (idempotent).
  2. `restic restore` of the config and staging to a temp dir, then put `/etc/printex` back.
  3. Recreate the DB roles (`db-roles.sql`, with new passwords written to `printex.env`).
  4. Start `db` only.
  5. `pg_restore --exit-on-error --no-owner --role=printex_owner -d printex`.
  6. Re-apply grants (`db-roles.sql` is idempotent) and REVOKEs, which come from the baseline
     migration and are replayed by `migrate deploy`. That is a no-op if the schema is current, and
     it records nothing new.
  7. `restic restore` of `files/`.
  8. Restore `caddy/`, so staff devices keep trusting the same CA.
  9. `compose up`, the smoke test, then verification.
- Timing: the script prints a timestamp per phase to `/srv/printex/backup-state/restore-<ts>.log`,
  which feeds the drill log.
- **Verification** (`verify-restore.sh`, shared by the weekly job and the drill):
  - It restores the dump into a throwaway `postgres:16@digest` container started with `--network
    none` and a tmpfs or `verify-tmp` data dir.
  - It recomputes the counts and compares them to `counts.json` exactly.
  - It restores 100 randomly chosen `FileObject` rows' objects (by `storageKey`) into
    `verify-tmp/` and compares their sha256 to `FileObject.sha256`.
  - It runs `restic check --read-data-subset=2%`, then removes everything.
  - If the `FileObject` table does not exist yet (050 not built), it skips the checksum step with
    `WARNING` and never falsely passes.
  - The weekly job runs Sundays at 04:00 against the USB repository, rotating through the LAN and
    off-site repositories every 4th week.
- It runs as root, because it needs docker. The unit is hardened with `ProtectSystem=strict`,
  `ReadWritePaths=/srv/printex/verify-tmp /srv/printex/backup-state`, `PrivateTmp`, and
  `NoNewPrivileges`.
- **Drill** (FR-025): the go-live drill and then every quarter (first week of Jan/Apr/Jul/Oct),
  onto a spare PC or a VM of at least the minimum spec, with a stopwatch from bare metal. The
  entry goes in `deploy/drills/DRILL-LOG.md`.

**Alternatives considered**: restoring into the production cluster as a scratch database (it
pollutes production and needs CREATEDB for the backup role); monthly verification only (a broken
backup could then go unnoticed for 4 weeks).

## §8 Backup health reporting and alerts (the 053 port)

**Decision**: a push-plus-spool model.

- **Host → app**:
  - Every script writes a report JSON (contracts/backup-cli.md §3) to
    `backup-state/spool/<runId>-<kind>-<dest>.json`.
  - `report.sh` POSTs each one to `https://printex.local/api/ops/backup-reports` (`--cacert`
    Caddy root, `Authorization: Bearer $(cat report.token)`) and deletes it on 201 or 200
    (duplicate).
  - The hourly watchdog flushes the spool, which gives at-least-once delivery. Idempotency comes
    from a unique `(runId, kind, destination)`.
- **Watchdog** (hourly, `printex-backup` user):
  - For each destination, if `now - last-success-<dest>` is over `STALE_HOURS` (26), it reports
    `MISSED`. If a backup is currently running (lock held) and it has run for less than 20 h, it
    reports nothing. At 20 h or more it reports `FAILED` with "run exceeded 20 h".
  - For `/srv/printex` and `/`, it reports `WARNING` below 15 % free and `CRITICAL` below 5 %.
  - **"No success today" rule**: from 06:00 local time, if no success has been recorded since
    today's 02:00 for a destination and no run is in progress, it reports `MISSED` at once. With
    the 26 h rule as a backstop, a night that never ran is reported at 06:00, which meets SC-003
    (within 2 h of the 04:00–06:00 window end and before 08:00).
  - A backup that ran and failed is reported by `backup.sh` itself as soon as that destination
    finishes (usually before 04:00).
- **App**:
  - `recordBackupReport` is a `defineCommand` with the permission `ops.backup.report`.
  - It inserts a `BackupReport` row plus an audit entry `backup_report.recorded`.
  - For problem outcomes, `alerts.ts` looks up a `NotificationEvent` of the same `type` and
    `entityId` (destination or disk mount) created within the last 20 h. If there is none, it calls
    `notify(tx, …)` to the active `admin.config` holders, in the same transaction (constitution
    VII: the outbox row never outlives a rollback).
- **Actor**: the route verifies the bearer token with `crypto.timingSafeEqual` against
  `env.OPS_REPORT_TOKEN`. It then loads the seeded `system_ops` user (`isActive`, no `Account`
  row, so it can never sign in) through `getActorForSession`-equivalent logic, `systemActor.ts`,
  which reads roles and permissions from the DB. The actor holds exactly `ops.backup.report`
  through `UserPermission`. Audit rows therefore have a real `actorId`.
- **Dead-scheduler visibility**: `getBackupStatus` computes `overdue = lastSuccessAt < now -
  BACKUP_STALE_HOURS` at read time (spec US5-6).

**Rationale**: it reuses 002's outbox (no second outbox table, per 002's notifications contract)
and 053 delivers it. 091 does not wait for 053: the rows exist, and the Admin page shows them
(spec Assumption).

**Alternatives considered**:

- The app polls a status file on a shared volume (the app would need a scheduler it does not
  have, plus read access to backup state).
- Email or SMS alerts (need the internet, and delivery is 053's job).
- An in-app cron (Next.js has no reliable scheduler, and the reserved worker belongs to 053).
- Letting the route write without a user actor (breaks the aspect pipeline and audit actor).

## §9 Security hardening

**Decision**:

- **OS**: `unattended-upgrades` for security updates only, with
  `Automatic-Reboot "true"` at 03:30 (after the backup window). `needrestart` runs in auto mode.
- **SSH**: keys only, `PermitRootLogin no`, `AllowUsers printex-admin`, and UFW allows 22 only from
  `ADMIN_IP`. fail2ban is used for sshd.
- **DB roles** (data-model.md): `printex_owner` (owns the schema, used only by `migrate`),
  `printex_app` (DML, non-owner, so `audit_event` and other REVOKEs bind, matching the CI split
  already in ci.yml), and `printex_backup` (`pg_read_all_data`, local socket only). `pg_hba.conf`
  allows:
  - `host printex printex_app,printex_owner <backend subnet> scram-sha-256`
  - `local printex printex_backup scram-sha-256`
  - nothing else.
- **Cookies and origin** (001 change):
  - Better Auth gets `baseURL: env.BETTER_AUTH_URL` and `trustedOrigins: [env.BETTER_AUTH_URL,
    …BETTER_AUTH_EXTRA_ORIGINS]` (for `printex.lan`).
  - `advanced.useSecureCookies: env.NODE_ENV === "production"` makes the cookies Secure with the
    `__Secure-` prefix. HttpOnly and SameSite=Lax are Better Auth defaults, and a test asserts
    them.
  - The session lifetime stays at 12 h.
  - Better Auth's built-in `rateLimit` is enabled in production (the in-memory store is fine for
    a single instance).
- **Headers** (Caddy):
  - `Strict-Transport-Security: max-age=31536000` (no preload)
  - `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self'
    'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors
    'none'; base-uri 'self'; form-action 'self'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: same-origin`

  `'unsafe-inline'` for scripts is needed by Next's inline bootstrap without a nonce middleware.
  It is accepted because the goal is "no external origins" (FR-015). A nonce-based CSP is
  recorded as a follow-up in the security review.
- **Container**: `read_only: true`, a `tmpfs` for `/tmp` and `.next/cache`, `cap_drop: [ALL]`,
  `security_opt: [no-new-privileges:true]`, a non-root uid, log rotation (`json-file`, 10 MB × 5).
- **Security review**: run `/security-review` against the 091 branch, plus a manual checklist
  (secrets, exposure, roles, cookies, file access). The findings go into
  `deploy/runbooks/security-review.md`, each with fix or accept (owner).

**Alternatives considered**: CrowdSec (overkill for LAN-only); AppArmor custom profiles (Docker's
default profile is kept, and a custom one is deferred).

## §10 Upgrade and rollback

**Decision**: `upgrade.sh <image-digest>` follows the states in contracts/upgrade.md:

`PREFLIGHT → MAINTENANCE → BACKUP → MIGRATE → START → SMOKE → OPEN`, and on failure `ROLLBACK →
SMOKE(prev) → OPEN(prev)`. State is persisted in `backup-state/upgrade.state`, so a re-run after
a power cut resumes or rolls back (spec edge case).

- The maintenance page is Caddy's `handle` serving `maintenance.html`, switched by a flag file.
- The pre-upgrade backup is `backup.sh --tag pre-upgrade --dest usb`. It must succeed (other
  destinations are best-effort). The dump path is recorded for the rollback.
- Migrations run as `docker compose run --rm migrate` → `prisma migrate deploy` as `printex_owner`.
- Rollback:
  1. Stop the app.
  2. Drop and recreate the DB from the pre-upgrade dump (`pg_restore --clean --if-exists`).
  3. Set `PRINTEX_IMAGE` to the previous digest.
  4. Start the app.
  5. Run the smoke test.

  The app is stopped for the whole window, so no writes are lost (FR-034).
- **Migration authoring rule** (after the baseline): prefer expand/contract. Destructive changes
  go in a later release than the code that stops using them. This makes "previous image on the new
  schema" usually safe, but the rollback always restores the dump anyway, for certainty.
- The smoke test (`smoke.sh`) checks readiness, that `GET /` returns 200 over the proxy with the
  internal CA, that `printex_app` can count orders (through the `tools` job), and that `prisma
  migrate status` reports "up to date". Then the engineer signs in as an Admin by hand (§13, spec
  FR-035).

**Alternatives considered**: blue/green with two databases (needs a DB copy and double disk for
one shop); Prisma down-migrations (Prisma has none, and hand-written ones are untested).

## §11 Migrations baseline (decision for owner and Fady)

**Problem**: `prisma/migrations` stops at `20260923160000_orders_reception`. After that, 012–016
applied their schema with `db push` plus `prisma/manual-sql/*.sql`, and CI runs `db push`. A
fresh production database therefore cannot be created with `migrate deploy`, and an upgrade has no
recorded history (the constitution quality gate, and FR-032).

**Proposed path** (one-time, before go-live, owned jointly by Fady as schema owner and Mostafa):

1. **Freeze**: agree a date after which the in-flight schema work (015, 016, 050, and anything
   else merged) is on `main`. No schema PR is merged during the baseline PR.
2. **Squash**:
   - Delete `prisma/migrations/{0_init,20260923150000_customers,20260923160000_orders_reception}`.
     git keeps the history.
   - Generate `prisma/migrations/0_baseline/migration.sql` with `prisma migrate diff
     --from-empty --to-schema-datamodel prisma/schema --script`.
   - Add `migration_lock.toml` (`provider = "postgresql"`).
3. **Fold the manual SQL**: create `prisma/migrations/1_baseline_constraints/migration.sql` with
   every constraint and privilege statement from `prisma/manual-sql/*`. That covers the
   `audit_event` REVOKE, 016's partial unique index and REVOKEs, and 050/015 equivalents if
   present. Each statement is rewritten to be idempotent (`CREATE UNIQUE INDEX IF NOT EXISTS`,
   `REVOKE` is naturally idempotent) and to target `printex_app` **by name** instead of
   `CURRENT_USER`, because migrations run as `printex_owner`. This matches what ci.yml already
   does by hand. **Data backfills** (for example 016's spec-version backfill) are *not* folded in:
   a fresh DB has no rows, and existing DBs already ran them.
4. **Roles outside migrations**: role creation, passwords, `GRANT` and `ALTER DEFAULT PRIVILEGES
   FOR ROLE printex_owner … GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO printex_app` live in
   `deploy/scripts/db-roles.sql`. These are per-environment and involve secrets, so they do not
   belong in migrations. Default privileges mean every table a future migration creates is usable
   by the app automatically, and an append-only table's migration REVOKEs from `printex_app` in
   the same migration.
5. **Existing non-production DBs** (the shared dev DB and any personal DBs):
   - Run `prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema
     --exit-code`. It must exit 0 (zero drift). Otherwise fix the drift first.
   - Delete the 3 obsolete rows from `_prisma_migrations` (owner-approved, one-time).
   - Run `prisma migrate resolve --applied 0_baseline` and `--applied 1_baseline_constraints`
     after running the constraints file once with `db execute` (it is idempotent).
6. **CI**:
   - Replace `prisma db push` with `prisma migrate deploy` (as postgres/owner, via
     `DIRECT_URL`).
   - Remove the hand-run REVOKE step, which now lives in the migration.
   - Add a drift job: `prisma migrate diff --from-migrations prisma/migrations
     --to-schema-datamodel prisma/schema --shadow-database-url $SHADOW --exit-code`.
7. **Rule from then on**: every schema change ships as `prisma migrate dev --create-only` output
   plus review. `db push` is allowed only against throwaway local DBs. This rule is stated in
   CONTRIBUTING-style text in the baseline PR description and in the constitution's existing
   quality gate. That gate is already a MUST, so no amendment is needed.
8. **091's own table** ships as `2_ops_backup_report`, the first post-baseline migration. It
   proves the flow.

**Rationale**: there is no production data yet, so squashing loses nothing. A single baseline is
the path Prisma documents for adopting migrations on an existing schema. It makes `migrate deploy`
the only way a production DB is created or upgraded.

**Alternatives considered**:

- Keep `db push` in production (no history, no review of destructive changes, interactive
  data-loss prompts, and it violates the constitution gate).
- A catch-up migration on top of the existing three (`migrate diff --from-migrations
  --to-schema-datamodel`). This is viable, but the three existing migrations have already drifted
  from dev DBs built by `db push`, the manual SQL still needs folding, and it preserves a history
  nobody can replay faithfully. It is the fallback if Fady prefers not to delete migration folders.
- Per-feature migrations written retroactively for 012–016 (heavy effort, and a guessed history).

**Status**: PROPOSED. It needs agreement from the owner and Fady (plan.md "Cross-team contracts"
item 3). tasks.md T010–T015 are blocked on it.

## §12 Offline operation

**Findings in the repo**:

- `src/env.js` requires the GitHub OAuth vars, `config.ts` registers the GitHub provider, and
  `src/app/page.tsx` offers "Sign in with Github". These are internet dependencies on the sign-in
  path.
- `next/font/google` (IBM Plex Sans Arabic) downloads at **build** time and self-hosts the files
  under `/_next/static/media`, so there is no runtime fetch. The build runs in CI, where the
  internet is available.
- No other outbound call was found on core paths. The storage adapter is local disk, and
  notifications are outbox-only.

**Decision**:

- Make the GitHub env vars optional, and register the provider only if both are set. Production's
  env file omits them. Remove the GitHub button from `page.tsx` (001/Fady).
- Add CI job `offline-boot`: `docker compose -f compose.yaml -f compose.offline.yaml up` where
  every network is `internal: true`. The proxy is not used, and the test runs inside the network
  with a curl container. It asserts that `/api/health?probe=ready` is 200, that `GET /` returns
  the sign-in page, and that the HTML references no absolute `http(s)://` asset outside the site.
- Manual drill (US6): unplug the WAN at the router and run the full lifecycle with two devices,
  following `deploy/runbooks/offline-drill.md`, which is generated from the features on `main` at
  go-live.
- Clock: `chrony` with `makestep 1 3` and the router or LAN as a secondary source if it offers
  NTP. Offline drift is tolerated (spec edge case).

**Alternatives considered**: blocking egress with an iptables rule in CI (less faithful than
`internal: true`, and it needs privileged CI); an automated full lifecycle through the UI (no
browser test harness exists in the repo, and adding Playwright is out of scope; the lifecycle
server-path tests already exist per feature).

## §13 Bootstrap and seed profiles

**Decision**:

- `prisma/seed.ts` reads `SEED_PROFILE` (`reference` | `dev`, default `dev` so local behavior is
  unchanged). It exits non-zero if `SEED_PROFILE=dev` and `NODE_ENV=production`.
  - `reference` seeds the roles and permission matrix, the 5 default departments, the Cash
    Customer, the classifications, and the `system_ops` service user with `UserPermission`
    `ops.backup.report`.
  - `dev` adds the dev Admin and sample orders, as today.
- `prisma/bootstrap-admin.ts` (run through `bootstrap-admin.sh` → `compose run --rm tools`):
  - It reads the username from its argument and the password from stdin (no echo). The password
    must be at least 12 characters and pass Better Auth's hash.
  - In one transaction it refuses if any active user holds the `ADMIN_OWNER` role (seed data
    lookup by `Role.key`, which is data, not a code branch on a person). Otherwise it creates the
    User, a credential Account and a UserRole, and writes an audit row
    `system.bootstrap_admin` with `actorId` null (a system-originated event, as `AuditEvent.actorId`
    allows).
  - It is a CLI on the server, not a network entry point, so the aspect layer is not involved (it
    has no actor). This matches `seed.ts` practice.
- **Smoke test without a stored staff credential**: the automated smoke test does not sign in.
  It checks readiness, the sign-in page over the proxy, a read of the order count as `printex_app`
  through the `tools` job, and `prisma migrate status`. The "signed-in read" is done by the
  engineer (an Admin sign-in and an open of the orders list) as the last step before reopening
  (spec FR-035, upgrade runbook).

**Alternatives considered**:

- A first-run web wizard (rejected in spec).
- Reusing `admin/users.ts#createUser` (it requires an actor holding `admin.users`, which does not
  exist yet at bootstrap).
- A dedicated smoke-test login account: this needs a stored password on the host, and a new
  role, which would mean changing 001's fixed `RoleKey` union. An always-active extra login is
  also one more attack surface.
