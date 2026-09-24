# Implementation Plan: Deployment, Backup & Hardening

**Branch**: `091-deploy-backup` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/091-deploy-backup/spec.md`

## Summary

091 turns the repository into something that runs on one Ubuntu LTS server on the shop LAN, backs
itself up to three places every night, can be restored onto a clean machine in under 4 hours, and
alerts the Admin when any of that goes wrong. Almost all of it is **infrastructure as code** under
a new top-level `deploy/` directory. A small, deliberate app-side slice follows the existing
codebase patterns.

- **Stack** (research §2, [contracts/compose.md](./contracts/compose.md)): Docker Compose with
  four long-running services:
  - `proxy`: Caddy with `tls internal`, the only service with published ports, bound to the LAN IP
    only.
  - `app`: a Next.js `output: "standalone"` image, non-root, read-only root filesystem.
  - `db`: PostgreSQL 16 on an `internal: true` network, with no published port.
  - `worker`: reserved for 053, disabled behind a profile.

  There are also one-shot `migrate` and `tools` jobs built from a `tools` image target. Every
  image is pinned `name:version@sha256:digest`.
- **Disk layout** (research §1): the OS disk holds `/` and `/var/lib/docker`. The data disk is
  mounted at `/srv/printex` and holds `postgres/`, `files/` (STORAGE_ROOT), `caddy/` (the
  internal CA), `backup-staging/`, `backup-state/` and `verify-tmp/`. systemd
  `RequiresMountsFor=/srv/printex` keeps the stack down when the disk is missing.
- **Backups** (research §4–§6, [contracts/backup-cli.md](./contracts/backup-cli.md)):
  - restic, with one repository per destination: a USB path, a `rest-server --append-only` on the
    second PC, and an S3-compatible bucket off-site. Every repository is encrypted client-side.
  - The nightly systemd timer runs as the unprivileged `printex-backup` user. It dumps the DB
    first (`pg_dump -Fc` over a host-only unix socket, as a read-only `printex_backup` role), with
    record counts, then snapshots files and config.
  - Retention is 7/4/12 per repository. On the LAN PC the PC applies retention itself.
- **Restore** (research §7): `restore.sh` goes from bare Ubuntu plus the recovery kit to a running
  system. `verify-restore.sh` runs weekly into an isolated throwaway Postgres (`--network none`),
  checks counts and a 100-object checksum sample, then deletes the copy. Before go-live and every
  quarter a timed drill is run and recorded in `deploy/drills/DRILL-LOG.md`.
- **Backup health** (research §8, [contracts/backup-health.md](./contracts/backup-health.md)):
  - Host scripts spool a JSON report per run, destination and finding, and POST it to
    `POST /api/ops/backup-reports` with a bearer token.
  - The route resolves a seeded, non-login `system_ops` service user and calls
    `recordBackupReport`. That command is a **shared aspect-layer command**
    ([016 contracts/aspects.md](../016-change-control/contracts/aspects.md)). It inserts an
    append-only `BackupReport` row, audits it, and raises a deduplicated `notify()` to every
    `admin.config` holder through 002's outbox, which 053 delivers.
  - An hourly watchdog timer reports missed backups (older than 26h) and low disk (below 15% or 5%
    free).
  - The Admin page `/admin/backups` (a `defineQuery` gated on `admin.config`) derives "overdue" at
    read time, so a dead scheduler is still visible.
- **Hardening** (research §3, §9): UFW deny-by-default plus `DOCKER-USER` rules so that published
  ports cannot bypass the firewall, SSH key-only from the admin IP, `unattended-upgrades`,
  Secure/HttpOnly cookies with `baseURL`/`trustedOrigins` (Better Auth), a CSP of `'self'` origins
  only at the proxy, and a `/security-review` pass as a go-live gate.
- **UPS**: NUT (`upsmon`) triggers a clean `poweroff` (the Postgres stop grace is 120 s). BIOS "power
  on after AC loss" plus `printex.service` bring the stack back.
- **Upgrade** (research §10, [contracts/upgrade.md](./contracts/upgrade.md)): `upgrade.sh
  <digest>` shows the maintenance page, stops the app, runs a mandatory backup, runs `prisma
  migrate deploy` as the owner role, starts the new image, runs the smoke test, then reopens. On
  failure it rolls back automatically (previous digest plus a `pg_restore` of the pre-upgrade
  dump).
- **Migrations baseline** (research §11, **decision for owner + Fady**): squash to `0_baseline`
  plus `1_baseline_constraints`, `migrate resolve --applied` on existing dev DBs after a
  zero-drift check, a CI drift job, and no more `db push` against shared DBs.
  `2_ops_backup_report` becomes 091's own first post-baseline migration.
- **Offline** (research §12): remove or disable the GitHub OAuth provider (001), confirm
  `next/font/google` is self-hosted at build time, add a CI job that boots the stack on
  `internal: true` networks and checks readiness and the sign-in page, and run a manual
  unplugged-router lifecycle drill.

## Technical Context

**Language/Version**:

- Bash 5 (scripts, `set -Eeuo pipefail`, shellcheck-clean).
- TypeScript (strict), Node 22 (matches CI) for the app slice.
- SQL (PostgreSQL 16).

**Primary Dependencies**:

- Deployment: Docker Engine plus the Compose v2 plugin (apt, pinned), Caddy 2.8, PostgreSQL 16,
  restic 0.17 (pinned binary plus sha256), restic rest-server 0.13 (second PC), NUT, UFW,
  unattended-upgrades, avahi-daemon (mDNS `printex.local`), and chrony.
- App: the existing Next.js 15, Prisma 6, Better Auth 1.3, Zod, and `@t3-oss/env-nextjs`. No new
  npm dependency.

**Storage**:

- PostgreSQL on the data disk. One new model, `BackupReport` (data-model.md), in a new
  `prisma/schema/ops.prisma`, delivered as a real migration after the baseline.
- The file store is 050's local-disk objects under `STORAGE_ROOT=/data/files` in the container,
  which is `/srv/printex/files` on the host.
- Backups are restic repositories on three destinations. `BackupReport` rows are in the DB, so
  they are in backup scope by construction (constitution "Backups").

**Testing**:

- `shellcheck` on `deploy/**/*.sh`, plus `bats` unit tests for script helpers (retention args,
  report JSON, lock, threshold math).
- `docker compose config` validation and `hadolint` on the Dockerfile.
- A CI job that builds the image and runs a scripted **backup → restore-verify round-trip** inside
  CI (seeded DB plus files → restic local repo → `verify-restore.sh` against it).
- A CI **offline boot** check.
- Vitest integration tests (real Postgres, `tests/helpers/testDb.ts`) for `recordBackupReport`,
  `getBackupStatus`, the report route, the health route, and env validation.
- Go-live drills (restore, offline, port scan) are manual and recorded.

**Target Platform**: Ubuntu Server 24.04 LTS, x86-64, single host on the shop LAN (constitution
VII). The second PC runs Windows 10/11 or Linux.

**Project Type**: Web application (single Next.js project, as in 001–016) plus a `deploy/`
infrastructure tree.

**Performance Goals**:

- RTO under 4 h and RPO 24 h (SC-001/SC-002).
- The nightly incremental backup finishes before 06:00. restic deduplicates immutable file
  objects, so nightly deltas are only the new uploads.
- The alert arrives before 08:00 (SC-003).
- The app runs about 10–25 concurrent LAN users, each within its existing per-page budgets.

**Constraints**:

- There is no inbound internet port, and the core runtime makes no outbound call.
- Secrets live only in `/etc/printex/printex.env` (0640 root:printex) and `/etc/printex/backup/*`
  (0640 root:printex-backup).
- Least privilege:
  - `printex_app` has DML only.
  - `printex_owner` has DDL and is used by `migrate` only.
  - `printex_backup` holds `pg_read_all_data` and connects over the host socket only.
  - The `printex-backup` OS user is not in the `docker` group.
- The container runs as uid 10001 with `read_only`, `cap_drop: [ALL]` and `no-new-privileges`.
- Every script is idempotent.

**Scale/Scope**: One shop. Files are up to 5 GB each (050) and the design assumes 0.5–1 TB within 3
years. There are three backup destinations and about 10 scripts.

**Current repo facts this plan acts on** (verified 2026-09-24):

- `next.config.js` is `const config = {}`, so there is **no `output: "standalone"`** yet.
- `src/env.js` requires `BETTER_AUTH_GITHUB_CLIENT_ID/SECRET` in every environment. It has no
  `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET` has no minimum length.
- `src/server/better-auth/config.ts` has the GitHub provider with a hard-coded
  `http://localhost:3000` redirect, and no `baseURL`, `trustedOrigins` or `useSecureCookies`.
- `src/app/page.tsx` has a "Sign in with Github" server action.
- `prisma/migrations` holds 3 migrations, the last being `20260923160000_orders_reception`. After
  that, 012–016 used `db push` plus `prisma/manual-sql/*.sql`. The CI workflow runs `db push`. The
  datasource declares `directUrl = env("DIRECT_URL")` (a Supabase-era comment).
- `prisma/seed.ts` loads the dev Admin (`Admin123!DevOnly`) and sample orders unconditionally.
- `src/server/core/storage/local-disk.ts` is the 002 dev stub. 050 owns the production adapter,
  and 050 FR-024 asks 091 for `restoreObject`/`verifyChecksum`.
- `NotificationEvent` exists, and `deliveredAt`/`deliveryStatus` are reserved for 053. 053 is
  not specified yet.
- There is no `src/instrumentation.ts` and no health route. `src/server/core/aspects/**` is
  specified (015/016) but not yet on `main`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Check | Result |
|---|---|---|
| I. Order → Work Item canonical model | No domain objects are added. `BackupReport` is operational data, not a parallel workflow | PASS (N/A) |
| II. Business gates inviolable | Bootstrap creates only the first Admin plus reference data, with no gate bypass. Production refuses the dev seed. Restore reproduces the data exactly and never edits records | PASS |
| III. History append-only | `BackupReport` is append-only (REVOKE UPDATE/DELETE in its migration). Restore never rewrites audit rows. A single-object restore moves damaged bytes aside and never deletes them. The baseline migration keeps the `audit_event` REVOKE | PASS |
| IV. Files immutable, private | File objects are backed up byte-for-byte and restored only after checksum verification. The file store stays private: it is not served by the proxy, only through 050's authorized routes | PASS |
| V. Server is the only authority | The report route authenticates with a token, resolves the system actor, then runs `recordBackupReport` through the shared aspect pipeline (Zod → permission `ops.backup.report` → tx → audit). The Admin view uses `defineQuery` with `admin.config`. **Exception**: `/api/health` is unauthenticated (see Complexity Tracking) | PASS with justified exception |
| VI. Configuration over hard-coding | Recipients are the holders of the `admin.config` permission. Thresholds (26 h stale, 15%/5% disk, 20 h dedupe, 02:00 schedule, retention) live in `/etc/printex/backup/backup.conf` and in the env var `BACKUP_STALE_HOURS`, not in code branches | PASS |
| VII. Local-first, isolated integrations | No inbound internet port. The core has no outbound dependency (GitHub OAuth is removed from production, and fonts are self-hosted). The off-site backup failing never blocks anything. The 054 boundary is outbound-only (contracts/network-boundary.md) | PASS |
| VIII. AI optional | No AI surface | PASS (N/A) |
| IX. Arabic-first UX | `/admin/backups` is Arabic RTL with `ar.json` keys. Alerts carry Arabic message keys | PASS |
| Tech constraint: Secrets | Server-only env file, validated at startup via `instrumentation.ts` `register()`. It is never in git or images, since the image is built with `SKIP_ENV_VALIDATION=1` and no `.env` is copied | PASS |
| Tech constraint: Backups | DB, file objects, file metadata, audit log and configuration go to three off-server destinations | PASS |
| Quality gate: schema via Prisma migrations | 091 **introduces** the migration baseline (FR-032) and ships `BackupReport` as a real migration. This removes the project-wide `db push` deviation recorded in 012–016's Complexity Tracking | PASS (fixes an existing deviation) |
| Quality gate: server-path tests | Report route, command, query, health and env validation have integration tests on the server path | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/091-deploy-backup/
├── plan.md                 # This file
├── research.md             # Phase 0: every decision + rejected alternatives
├── data-model.md           # BackupReport + DB roles + migration baseline steps
├── quickstart.md           # validation scenarios (install, backup, restore drill, scan, offline, upgrade)
├── contracts/
│   ├── compose.md          # services, networks, volumes, pins, env file keys
│   ├── backup-cli.md       # host scripts: args, exit codes, report JSON, restoreObject/verifyChecksum (050 FR-024)
│   ├── backup-health.md    # POST /api/ops/backup-reports, recordBackupReport, getBackupStatus, notify types (053 port)
│   ├── health.md           # GET /api/health liveness/readiness
│   ├── upgrade.md          # upgrade/rollback/smoke state machine + migrations rules
│   └── network-boundary.md # LAN exposure matrix + 054 gateway boundary
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
deploy/                                   # NEW — infrastructure as code
├── compose/
│   ├── compose.yaml                      # proxy, app, db (+ profiles: tools, migrate, worker[053])
│   ├── compose.offline.yaml              # CI offline-boot overlay (all networks internal)
│   ├── pg_hba.conf                       # local socket for printex_backup; backend net for app/tools; reject rest
│   └── images.lock                       # pinned name:version@sha256 per image (single source)
├── docker/
│   └── Dockerfile                        # targets: deps → build → runner (standalone) / tools (prisma CLI, seed, bootstrap)
├── caddy/
│   ├── Caddyfile                         # tls internal; printex.local + printex.lan; CSP/HSTS headers; /api/ops/* + /api/health remote_ip guard; maintenance
│   └── maintenance.html
├── env/
│   └── printex.env.example               # every key, no values (FR-007)
├── host/
│   ├── install.sh                        # idempotent host provisioning (users, disks, packages, ufw, docker-user, sshd, avahi, chrony, nut, units)
│   ├── ufw/after.rules.docker-user       # DOCKER-USER chain: published ports only from LAN CIDR
│   ├── sshd/99-printex.conf              # key-only, AllowUsers, no root
│   ├── unattended-upgrades/52printex     # security only, reboot 03:30 if required
│   ├── nut/{ups.conf,upsmon.conf,upssched.conf,upssched-cmd}
│   └── systemd/
│       ├── printex.service               # compose up/down, RequiresMountsFor=/srv/printex
│       ├── printex-backup.{service,timer}            # 02:00 Africa/Cairo, user printex-backup
│       ├── printex-backup-watchdog.{service,timer}   # hourly: missed/disk/spool flush
│       └── printex-verify-restore.{service,timer}    # weekly Sun 04:00, root (docker), hardened
├── scripts/
│   ├── lib/common.sh                     # logging, lock (flock), config load, json report writer, spool
│   ├── backup.sh                         # dump → counts → restic backup ×3 → forget/prune (USB, off-site) → reports
│   ├── watchdog.sh                       # stale per destination, disk %, spool flush
│   ├── report.sh                         # POST spooled reports (idempotent, retry)
│   ├── verify-restore.sh                 # isolated restore + counts + checksum sample
│   ├── restore.sh                        # full disaster restore on a fresh host
│   ├── restore-object.sh                 # 050 FR-024 restoreObject
│   ├── verify-objects.sh                 # 050 FR-024 verifyChecksum
│   ├── upgrade.sh / rollback.sh / smoke.sh
│   ├── bootstrap-admin.sh                # wraps `compose run tools bootstrap-admin`
│   ├── db-roles.sql                      # printex_owner / printex_app / printex_backup + default privileges (idempotent)
│   ├── record-counts.sql                 # counts captured into every dump (FR-021)
│   ├── init-repos.sh                     # create the 3 restic repos + recovery keys (idempotent)
│   └── pin-check.sh / secret-scan.sh     # CI: digest pinning, gitleaks
├── lan-pc/
│   ├── linux/rest-server.service + prune.{service,timer}
│   └── windows/install-rest-server.ps1 + prune-task.xml
├── runbooks/
│   ├── install.md  restore.md  upgrade.md  onboarding.md  offline-drill.md  port-scan.md  recovery-kit.md  migrations-baseline.md
└── drills/DRILL-LOG.md, SECURITY-REVIEW.md # drill records; FR-016 review record

.github/workflows/
├── ci.yml                                # + migrate deploy instead of db push (post-baseline), + drift check
└── deploy.yml                            # NEW: shellcheck, bats, hadolint, compose config, image build (+ push GHCR on main), backup/restore round-trip, offline boot

next.config.js                            # + output: "standalone"
src/app/layout.tsx + src/app/fonts/       # next/font/google → next/font/local (offline, research §12)
src/env.js                                # + BETTER_AUTH_URL, OPS_REPORT_TOKEN, BACKUP_STALE_HOURS; prod: secret ≥32, STORAGE_ROOT absolute, GitHub optional
src/instrumentation.ts                    # SHARED (015/016) — create if absent; + env fail-fast block
src/server/better-auth/config.ts          # 001 (Fady): baseURL, trustedOrigins, useSecureCookies; GitHub only when configured
src/app/page.tsx                          # remove GitHub sign-in button (001/002 shell)
src/server/ops/                           # NEW module
│   ├── index.ts                          # barrel
│   ├── errors.ts                         # OpsError union
│   ├── aspect.ts                         # aspects.forModule<OpsError>({ module: "ops", mapUniqueViolation })
│   ├── reportSchema.ts                   # Zod BackupReportInput
│   ├── systemActor.ts                    # resolve seeded system_ops user → Actor
│   ├── recordBackupReport.ts             # defineCommand (ops.backup.report)
│   ├── alerts.ts                         # classify + dedupe (20 h) + notify(admin.config holders)
│   ├── backupStatus.ts                   # defineQuery (admin.config), overdue derived at read time
│   └── health.ts                         # liveness/readiness probes (no aspects: no actor)
src/app/api/ops/backup-reports/route.ts   # POST, bearer token (timingSafeEqual)
src/app/api/health/route.ts               # GET ?probe=live|ready
src/app/(shell)/admin/backups/page.tsx    # read-only status
src/messages/ar.json                      # + ops.* keys
src/server/auth/permissions.ts            # 001 (Fady): + "ops.backup.report"
prisma/schema/ops.prisma                  # NEW: BackupReport + 3 enums
prisma/migrations/0_baseline/             # NEW (baseline, research §11)
prisma/migrations/1_baseline_constraints/ # NEW (manual SQL folded in)
prisma/migrations/2_ops_backup_report/    # NEW (091)
prisma/seed.ts                            # SEED_PROFILE=reference|dev; dev refused when NODE_ENV=production; + system_ops user
prisma/bootstrap-admin.ts                 # NEW one-time first-Admin CLI
eslint.config.js                          # + barrel rule for ~/server/ops/**
tests/
├── unit/ops/{alerts,reportSchema,env,authConfig}.test.ts
├── integration/ops/{recordBackupReport,backupStatus,reportRoute,healthRoute,bootstrapAdmin,seedProfile}.test.ts
└── contract/ops/{append-only,notify-shape}.test.ts
deploy/tests/                             # bats: common, install, backup-args, report, verify, restore-object, firewall, watchdog, upgrade
```

**Structure Decision**: This is the single Next.js project plus a self-contained `deploy/` tree.
Host scripts never import app code. They talk to the app only through the documented report route
and health route, and to the DB only through `pg_dump`/`psql`. `src/server/ops/**` follows the
016 module pattern:

- It has a barrel that is the only import surface, enforced by ESLint.
- Commands and queries go through the **shared aspect layer**. If 015/016 have not landed it, 091
  creates it per 016's contracts/aspects.md, and otherwise reuses it unchanged.
- `ops` imports only the `core`, `auth` and `db` barrels and `~/server/aspects`.

## Post-Design Constitution Check

| Principle | Design evidence | Result |
|---|---|---|
| III | `2_ops_backup_report` ends with `REVOKE UPDATE, DELETE ON "BackupReport" FROM printex_app`. The contract test `tests/contract/ops/append-only.test.ts` proves it. `restore-object.sh` moves the damaged object to `quarantine/` and never runs `rm` | PASS |
| IV | The Caddyfile has no `file_server` for `/srv/printex/files`. Restore verification recomputes sha256 against `FileObject.sha256` | PASS |
| V | contracts/backup-health.md auth table: token → system actor → `ops.backup.report` inside the aspect pipeline. Query `admin.config`. Caddy `remote_ip` limits `/api/ops/*` to the server itself (defense in depth). The health route returns booleans only | PASS with the exception below |
| VI | `alerts.ts` resolves recipients via `RolePermission`/`UserPermission` holders of `admin.config`. No role key or user id is in code. Thresholds are config | PASS |
| VII | contracts/network-boundary.md exposure matrix. The offline CI job boots with `internal: true` networks. The 054 gateway is outbound-only, pull-based | PASS |
| Schema gate | Real migrations only after the baseline. A CI drift check fails any `db push`-only change | PASS |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `GET /api/health` is not authenticated (constitution V: "every server entry point MUST authenticate") | The container healthcheck (`app` healthcheck, `depends_on: service_healthy`), `upgrade.sh`/`smoke.sh` and `verify-restore.sh` must probe readiness without a user session. A session would need a stored credential on the host and would couple health to auth | It returns only `{status, checks:{db,storage,env}}` booleans with no data, versions or config. Caddy returns 404 for `/api/health` to every client except the server's own address, so it is not a LAN-reachable entry point. The alternative (a token-guarded health check) adds a secret to every probe and breaks the Docker healthcheck, which cannot read secrets without baking them into the compose file |
| New top-level `deploy/` tree with Bash, systemd and Caddy config (a "new framework" under the Technology constraint) | The brief requires infrastructure as code: compose, scripts and timers. None of it runs inside the Next.js app | Doing it in Node scripts would need Node on the host plus the repo on the host, and a larger attack surface. Ansible is one more tool to learn for a single host. Bash plus systemd is the Ubuntu-native minimum, and shellcheck and bats keep it testable |
| restic, Caddy, NUT and rest-server introduced | They are the backup, TLS, UPS and append-only receiver requirements from the brief (research §2–§6) | Each is rejected against its alternative in research.md |

## Cross-team contracts (Fady / Track B must agree)

1. **053 notifications (port)**: 091 writes `NotificationEvent` rows through 002's `notify(tx, …)`
   with the types `ops.backup.failed`, `ops.backup.missed`, `ops.backup.verify_failed`,
   `ops.disk.low`, `ops.disk.critical`, `ops.ups.shutdown`, and `recipients.userIds` = the active
   `admin.config` holders resolved at write time. 053 must deliver these as **in-app internal
   notifications** (not WhatsApp, which needs the internet). 091 never writes
   `deliveredAt`/`deliveryStatus`. If 053's recipient model changes (for example to
   permission-based recipients), only `alerts.ts` changes. Until 053 exists, the rows are
   visible on `/admin/backups`. See [contracts/backup-health.md](./contracts/backup-health.md) §5.
2. **054 WhatsApp gateway (network boundary)**: the gateway is hosted off-site. The local app
   opens **outbound** HTTPS/WSS to it (pull and acknowledge, mutual token or mTLS), and it never
   receives inbound connections. The router forwards no port. A gateway outage only queues. See
   [contracts/network-boundary.md](./contracts/network-boundary.md). If 054 needs an egress
   worker, it uses the reserved `worker` compose slot.
3. **Migrations baseline (001 schema owner)**: this is the proposal in research §11 and
   data-model.md "Migration baseline". It needs Fady's and the owner's agreement on (a) the
   freeze date, (b) squashing the 3 existing migrations into `0_baseline`, (c) folding
   `manual-sql/*` REVOKEs and indexes into `1_baseline_constraints`, (d) running `migrate resolve
   --applied` on the shared dev DB after a zero-drift check, and (e) switching CI from `db push`
   to `migrate deploy` plus a drift check, with no `db push` against shared DBs afterwards.
4. **001 auth changes**:
   - Remove the GitHub provider from production, or register it only when both env vars are set.
   - Add `baseURL`, `trustedOrigins` and `advanced.useSecureCookies`.
   - Add the `ops.backup.report` permission key, which is granted **only** by `UserPermission` to
     the seeded `system_ops` service user (no role gets it).
   - Split the seed into profiles (`reference` / `dev`), plus the `system_ops` user, which has no
     credential `Account` and so cannot sign in.
5. **050 files**:
   - 091 provides FR-024's `restoreObject`/`verifyChecksum` as **host CLI tools**
     (`restore-object.sh`, `verify-objects.sh`), not in-app APIs. The app has no access to backup
     repositories, by least privilege. The Admin initiates them through the runbook.
   - 050 must keep its temporary upload area under `STORAGE_ROOT/.tmp/` (excluded from backups)
     and store `FileObject.storageKey` and `sha256` as specified. Marking `CORRUPTED` stays 050's
     job: `verify-objects.sh` outputs the list, and an Admin action in 050 marks the objects.
6. **Shared aspect layer (015/016)**: 091 is a consumer. It creates the layer only if neither
   015 nor 016 has landed it, and then exactly per 016's contracts/aspects.md. It adds one block
   to the shared `src/instrumentation.ts`.
