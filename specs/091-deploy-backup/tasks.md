---

description: "Task list for 091 Deployment, Backup & Hardening"
---

# Tasks: Deployment, Backup & Hardening

**Input**: Design documents from `/specs/091-deploy-backup/`

**Prerequisites**:

- [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)
- Contracts: [compose.md](./contracts/compose.md), [backup-cli.md](./contracts/backup-cli.md), [backup-health.md](./contracts/backup-health.md), [health.md](./contracts/health.md), [upgrade.md](./contracts/upgrade.md), [network-boundary.md](./contracts/network-boundary.md)
- Shared: [016 contracts/aspects.md](../016-change-control/contracts/aspects.md)

**Tests**: Included, and **required**. The brief requires every acceptance criterion to map to a
test or drill, and the constitution requires server-path tests for every permission. Host scripts
are covered by shellcheck plus bats, CI jobs in `.github/workflows/deploy.yml`, and timed drills
recorded in `deploy/drills/DRILL-LOG.md`.

**Organization**: Tasks are grouped by user story. spec.md has 7 stories: US1–US6 are P1 and US7
is P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to spec.md's US1–US7
- **[X-TEAM: …]**: A cross-team touch point that must be agreed before it lands
- Every task names its exact file path

## Path Conventions

- `deploy/**` is the infrastructure-as-code tree (plan.md Project Structure).
- App code lives in `src/server/ops/**`, `src/app/api/{ops,health}/**` and
  `src/app/(shell)/admin/backups/**`.
- Schema is in `prisma/schema/ops.prisma`, migrations in `prisma/migrations/**`.
- Tests are in `tests/{unit,integration,contract}/ops/**` (Vitest, `.test.ts` only) and in
  `deploy/tests/*.bats`.

**Brief acceptance criteria → test/drill tasks** (verification loop):

| Acceptance criterion | Scenario | Test / drill task(s) |
|---|---|---|
| Restore to a clean machine within the RTO (4 h) | US3-1, SC-001 | T058 (CI round-trip), T059 (verify negative), T090 (timed go-live drill) |
| The order → delivery flow works with the internet unplugged | US6-1, SC-005 | T079 (CI offline-boot), T080 (font/egress grep), T091 (unplugged drill) |
| An external port scan finds nothing open | US4-1, SC-004 | T066 (CI exposure), T092 (external scan) |
| A missed backup raises an Admin alert | US5-1, SC-003 | T069, T070, T072 (tests), T093 (staging drill) |
| RPO 24 h (a fresh restore point every day on 3 destinations) | US2-1, SC-002 | T044, T045 (bats), T071 (overdue test) |
| Graceful UPS shutdown | FR-006 | T094 (UPS drill) |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `deploy/` skeleton, pinning, and the CI lint gates that every later task
relies on.

- [ ] T001 Create the `deploy/` tree per plan.md Project Structure (empty files with headers)
  and `deploy/README.md`, which links to the runbooks. Nothing outside `deploy/` changes.
- [ ] T002 [P] Create `deploy/compose/images.lock` with pinned `name:version@sha256:` entries for
  caddy 2.8, postgres 16, restic 0.17 and rest-server (research §2). Add
  `deploy/scripts/pin-check.sh`, which fails on any `:latest` or a missing digest in
  `images.lock`, `compose.yaml` or `Dockerfile`.
- [ ] T003 [P] Create `.github/workflows/deploy.yml` with the jobs `shellcheck` (`-S style`),
  `bats`, `hadolint`, `pin-check` and `compose-config`. It triggers on `deploy/**`, `prisma/**`,
  `src/env.js`, `next.config.js` and `src/server/ops/**`.
- [ ] T004 [P] Create `deploy/scripts/lib/common.sh`:
  - `log`, `die`
  - `with_lock` (flock, exit 75)
  - `load_conf`, `new_run_id`, `emit_report`
  - `redact`

  All follow contracts/backup-cli.md §1.
- [ ] T005 [P] Write `deploy/tests/common.bats` covering: lock contention → 75, `redact` strips
  `://u:p@` and password-file contents, `emit_report` writes a valid JSON file (checked with
  `jq`), and `load_conf` rejects unknown keys.
- [ ] T006 [P] Create `deploy/env/printex.env.example` with every key from contracts/compose.md
  "Env keys" and no values. Add `deploy/scripts/secret-scan.sh`, a gitleaks run in the `deploy.yml`
  `secrets` job (SC-007).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The migrations baseline, the production build, config validation, DB roles, the
shared aspect layer and the `ops` module skeleton. **No user story can start until this phase is
complete.**

### Migrations baseline (research §11) — BLOCKED on owner + Fady agreement [X-TEAM: Fady]

- [ ] T010 [X-TEAM: Fady] Get agreement on research §11 (squash to baseline; the fallback is a
  catch-up migration) and on a schema-change freeze window. Record it in Linear PRI-20.
- [ ] T011 Generate `prisma/migrations/0_baseline/migration.sql` with `prisma migrate diff
  --from-empty --to-schema-datamodel prisma/schema --script`. Delete the 3 old migration folders
  and add `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).
- [ ] T012 Create `prisma/migrations/1_baseline_constraints/migration.sql`: every
  `prisma/manual-sql/*.sql` statement made idempotent, with `REVOKE … FROM printex_app` by name
  (not `CURRENT_USER`) and partial/expression indexes. No backfills. Mark `prisma/manual-sql/` as
  superseded in its README.
- [ ] T013 Create `deploy/scripts/db-roles.sql`, which is idempotent (`DO $$ … IF NOT EXISTS`):
  - `printex_owner`, `printex_app`, `printex_backup` per data-model.md "DB roles"
  - `ALTER DEFAULT PRIVILEGES FOR ROLE printex_owner`
  - `REVOKE CREATE ON SCHEMA public FROM PUBLIC`

  Also create `deploy/compose/pg_hba.conf` per data-model.md.
- [ ] T014 Update `.github/workflows/ci.yml`:
  - apply `db-roles.sql`
  - replace `prisma db push` with `prisma migrate deploy` (as owner)
  - drop the hand-run REVOKE step
  - add a `migrations` drift job (contracts/upgrade.md §3)
- [ ] T015 [X-TEAM: Fady] Write `deploy/runbooks/migrations-baseline.md` for existing dev DBs:
  zero-drift check → delete the 3 `_prisma_migrations` rows → `db execute` the constraints →
  `migrate resolve --applied 0_baseline` and `1_baseline_constraints`. Fady runs it on the shared
  dev DB. Never run it unattended.

### Build, config and startup

- [ ] T016 [P] Write `tests/unit/ops/env.test.ts` (it fails first). It covers the production
  rules in contracts/compose.md:
  - secret ≥ 32
  - `BETTER_AUTH_URL` is https
  - `DATABASE_URL` user ≠ `printex_owner`/`postgres`
  - `OPS_REPORT_TOKEN` ≥ 32
  - `STORAGE_ROOT` is absolute
  - GitHub keys are optional but must be set together
  - `BACKUP_STALE_HOURS` is in 1–72

  Error messages must never contain values.
- [ ] T017 Update `src/env.js` so T016 passes. Add `BETTER_AUTH_URL`,
  `BETTER_AUTH_EXTRA_ORIGINS`, `OPS_REPORT_TOKEN` and `BACKUP_STALE_HOURS`, and make
  `BETTER_AUTH_GITHUB_*` optional.
- [ ] T018 Create or extend `src/instrumentation.ts`, a **SHARED** file (015/016): create it if
  absent, otherwise add only the 091 block. The 091 block imports `~/env` in `register()` so that a
  bad config exits at boot (FR-008).
- [ ] T019 [P] Set `output: "standalone"` in `next.config.js`. Replace `next/font/google` in
  `src/app/layout.tsx` with `next/font/local` (font files committed under `src/app/fonts/`, OFL
  licence included), per research §12.
- [ ] T020 Create `deploy/docker/Dockerfile` with targets `deps` → `build` → `runner` (uid 10001,
  standalone, no dev dependencies) and `tools` (prisma CLI, `tsx`, `seed.ts`,
  `bootstrap-admin.ts`, `scripts/count-orders.mjs`). Base images must be pinned by digest. The
  `deploy.yml` `image` job builds both targets and pushes to GHCR on `main` only, then writes the
  digests as a build artifact.
- [ ] T021 [P] Update `.dockerignore` to exclude `.env*`, `.storage`, `node_modules`, `.git` and
  `tests`. The `deploy.yml` `image` job runs `docker run --rm <image> sh -c 'ls -a /app'` and
  fails if `.env` appears (SC-007).

### Shared aspect layer and the ops module

- [ ] T022 **Shared with 015/016**: if `src/server/core/aspects/**` and `src/server/aspects.ts`
  are not on `main`, create them exactly per 016 contracts/aspects.md, including
  `tests/unit/core/aspects.test.ts`. If they already exist, reuse them unchanged and never fork.
- [ ] T023 [X-TEAM: Fady / 001] Add `"ops.backup.report"` to the `Permission` union and the seed
  catalogue in `src/server/auth/permissions.ts`. It is granted to no role, only to the `system_ops`
  user via `UserPermission`.
- [ ] T024 Create `prisma/schema/ops.prisma` exactly per data-model.md (3 enums plus
  `BackupReport`). Create `prisma/migrations/2_ops_backup_report/migration.sql`
  (`migrate dev --create-only`), which includes `REVOKE UPDATE, DELETE ON "BackupReport" FROM
  printex_app;`. Depends on T011–T013.
- [ ] T025 [P] Create the `src/server/ops/` skeleton: `index.ts` (barrel), `errors.ts`
  (contracts/backup-health.md §1) and `aspect.ts` (the `forModule` binding). Add an ESLint barrel
  rule for `~/server/ops/**` in `eslint.config.js`.
- [ ] T026 [P] Create `src/server/ops/reportSchema.ts` (the Zod `BackupReportInput`, per
  data-model.md "Validation rules"), plus `tests/unit/ops/reportSchema.test.ts`.

**Checkpoint**: `pnpm typecheck && pnpm test` is green, CI `migrations` is green, and the image
builds.

---

## Phase 3: User Story 1 - Stand up the shop server and create the first Admin (Priority: P1) 🎯 MVP

**Goal**: Starting from a bare Ubuntu machine, one idempotent install produces a running, healthy,
HTTPS stack, and a one-time command creates the first Admin.

**Independent Test**: quickstart.md Scenarios 1–3.

### Tests for User Story 1

- [ ] T030 [P] [US1] Write `tests/integration/ops/healthRoute.test.ts` per contracts/health.md
  Tests.
- [ ] T031 [P] [US1] Write `tests/integration/ops/bootstrapAdmin.test.ts`. It covers:
  - creates an ADMIN_OWNER with a hashed credential
  - password < 12 → exit 11
  - a second run with an active Admin → exit 10 and no change
  - audit `system.bootstrap_admin` with actorId null
- [ ] T032 [P] [US1] Write `tests/integration/ops/seedProfile.test.ts`. It covers:
  - `reference` → roles, 5 departments, the Cash Customer, classifications, `system_ops` (no
    Account, only `ops.backup.report`), and no orders or dev users
  - `dev` with `NODE_ENV=production` → throws
  - running `reference` twice → the same row counts

### Implementation for User Story 1

- [ ] T033 [US1] Create `src/server/ops/health.ts` and `src/app/api/health/route.ts` per
  contracts/health.md.
- [ ] T034 [US1] Refactor `prisma/seed.ts` into `SEED_PROFILE=reference|dev` (research §13). The
  existing dev data moves under `dev` unchanged, and `system_ops` is added to `reference`.
  [X-TEAM: Fady — the seed is shared]
- [ ] T035 [US1] Create `prisma/bootstrap-admin.ts` and `deploy/scripts/bootstrap-admin.sh`
  (contracts/backup-cli.md §2). The password is read from a TTY with no echo and is never in argv
  or the env.
- [ ] T036 [US1] Create `deploy/compose/compose.yaml` per contracts/compose.md (services, networks,
  profiles, healthchecks, read_only, cap_drop, `${LAN_IP}` binds), plus
  `deploy/compose/compose.offline.yaml`.
- [ ] T037 [P] [US1] Create `deploy/caddy/Caddyfile` and `deploy/caddy/maintenance.html`:
  - `tls internal`
  - both hostnames
  - headers per FR-015
  - the `remote_ip` guard for `/api/ops/*` and `/api/health`
  - the maintenance-flag handling
- [ ] T038 [US1] Create `deploy/host/install.sh`. It is idempotent and has `--restore` mode:
  - users `printex` and `printex-backup`
  - the data-disk check and `/srv/printex/*` directories with owners and modes
  - packages
  - docker from the pinned apt repo
  - apply `db-roles.sql`
  - `migrate deploy`
  - `seed reference`
  - install the units
  - install avahi (`printex.local`) and chrony

  Every step logs "already configured" when there is nothing to do. It depends on T013, T020, T036
  and T037.
- [ ] T039 [P] [US1] Create `deploy/host/systemd/printex.service` (`RequiresMountsFor=/srv/printex`,
  compose up/down, `Restart=on-failure`). Set `TimeoutStopSec=120`, and set compose
  `stop_grace_period: 90s` on `db` so Postgres always gets a clean fast shutdown (FR-005).
- [ ] T040 [P] [US1] Create the UPS configuration in `deploy/host/nut/{ups.conf,upsmon.conf,upssched.conf,upssched-cmd}`
  per contracts/backup-cli.md §7. `install.sh` enables it when `UPS_DRIVER` is set.
- [ ] T041 [P] [US1] Create `deploy/tests/install.bats`, which runs `install.sh --dry-run` twice
  against a fixture root and checks the second run makes zero changes (FR-004). Add a `deploy.yml`
  `install-vm` job that runs `install.sh` in an `ubuntu:24.04` systemd container (best-effort
  smoke).
- [ ] T042 [US1] Write `deploy/runbooks/install.md` (hardware min/recommended spec from research
  §1, disk layout, the step-by-step install, and bootstrap). Include the BIOS/UEFI "power on after AC power loss" setting, which FR-006
  needs so the server restarts when mains power returns.
- [ ] T043 [US1] Create `deploy/scripts/smoke.sh` and `scripts/count-orders.mjs` (in the tools
  image) per contracts/upgrade.md §2. `install.sh`, `restore.sh` (T055) and `upgrade.sh` (T084)
  all call it, so it lands in US1.
**Checkpoint**: quickstart Scenarios 1–3 pass on a staging VM.

---

## Phase 4: User Story 2 - Every night, a complete backup leaves the server (Priority: P1)

**Goal**: At 02:00, a consistent DB dump plus files plus config is stored encrypted on USB, the LAN
PC and off-site, with 7/4/12 retention, run by an unprivileged user.

**Independent Test**: quickstart.md Scenarios 4–5.

### Tests for User Story 2

- [ ] T044 [P] [US2] Write `deploy/tests/backup-args.bats` (restic, pg_dump and psql stubbed on
  PATH). It checks:
  - destination selection
  - one destination failing → the others still run, and exit 1
  - forget flags `7/4/12`
  - no prune on LAN
  - `files/.tmp` excluded
  - the `pre-upgrade` tag
  - one report spooled per destination
- [ ] T045 [P] [US2] Write `deploy/tests/report.bats`: 201/200 → spool file deleted, 500 or a
  network error → kept, and the token is never in the process list or logs (curl reads it from
  `--config`).

### Implementation for User Story 2

- [ ] T046 [US2] Create `deploy/scripts/record-counts.sql` (per-table counts inside the exported
  snapshot) and `deploy/scripts/backup.sh` per research §5 and contracts/backup-cli.md.
- [ ] T047 [US2] Create `deploy/scripts/report.sh` (POST the spooled files, `--cacert
  $CA_CERT`, bearer token from a 0600 file).
- [ ] T048 [P] [US2] Create `deploy/host/systemd/printex-backup.{service,timer}` (user
  `printex-backup`, `Persistent=true`, `ProtectSystem=strict`, `ReadWritePaths` limited to the
  staging, state and USB mount).
- [ ] T049 [P] [US2] Create the LAN PC setup: `deploy/lan-pc/linux/rest-server.service`,
  `prune.{service,timer}`, and `deploy/lan-pc/windows/install-rest-server.ps1` plus
  `prune-task.xml` (append-only, per-user htpasswd, TLS with a self-signed cert pinned on the
  server).
- [ ] T050 [P] [US2] Write `deploy/runbooks/recovery-kit.md` (what goes into the sealed kit and the
  two storage locations, research §6), and add `deploy/scripts/init-repos.sh`, which creates the 3
  repositories idempotently with a second recovery key each. The runbook requires the kit to be
  re-issued whenever any of its secrets changes (FR-027).

**Checkpoint**: quickstart Scenario 4 passes on staging.

---

## Phase 5: User Story 3 - Restore last night's backup onto a clean machine within 4 hours (Priority: P1)

**Goal**: A documented, scripted, verified full restore plus single-object restore, with a weekly
automated verification.

**Independent Test**: quickstart.md Scenarios 6–8.

### Tests for User Story 3

- [ ] T052 [P] [US3] Write `deploy/tests/verify.bats`: a counts mismatch → exit 1
  `COUNTS_MISMATCH`, a missing `FileObject` table → exit 3 WARNING, and the temp container is
  always removed (trap).
- [ ] T053 [P] [US3] Write `deploy/tests/restore-object.bats` covering exit codes 0/4/5, the
  no-op on a healthy file, and quarantine-never-delete.

### Implementation for User Story 3

- [ ] T054 [US3] Create `deploy/scripts/verify-restore.sh` and
  `deploy/host/systemd/printex-verify-restore.{service,timer}` per research §7 (a `--network none`
  Postgres, exact counts, a 100-object sample, `restic check --read-data-subset=2%`).
- [ ] T055 [US3] Create `deploy/scripts/restore.sh`. It checks free space, stops the app, restores
  the DB, files, config and Caddy PKI, then runs counts, sample and `smoke.sh`, and prints
  `COUNTS OK`/`SAMPLE OK`/`SMOKE OK`.
- [ ] T056 [US3] Create `deploy/scripts/restore-object.sh` and `deploy/scripts/verify-objects.sh`
  per contracts/backup-cli.md §2.1. [X-TEAM: 050 — key → path rule]
- [ ] T057 [US3] Write `deploy/runbooks/restore.md` (timed checklist, RTO clock definition,
  decision tree for choosing the source) and create `deploy/drills/DRILL-LOG.md`, a template with date, duration, restore point,
  source, problems and follow-ups (FR-025).
- [ ] T058 [US3] Add the `deploy.yml` `restore-roundtrip` job (quickstart Scenario 6.3): stack up,
  fixtures, backup to a local repo, `verify-restore.sh` → 0, then restore into a second compose
  project and compare counts.
- [ ] T059 [US3] Add the negative case to `restore-roundtrip`: `VERIFY_TAMPER=1` → exit 1.

**Checkpoint**: the CI round-trip is green, and quickstart Scenario 8 passes on staging.

---

## Phase 6: User Story 4 - The server cannot be reached from the internet or misused from the LAN (Priority: P1)

**Goal**: Only HTTPS/HTTP-redirect on the LAN, SSH from the admin IP, no DB exposure, automatic
security updates, secure cookies and headers.

**Independent Test**: quickstart.md Scenarios 9–10.

### Tests for User Story 4

- [ ] T060 [P] [US4] Write `deploy/tests/firewall.bats`: the rendered `after.rules.docker-user`
  allows only `LAN_CIDR` → 80/443, and sshd config lint (`sshd -t -f`) passes.
- [ ] T061 [P] [US4] Write `tests/unit/ops/authConfig.test.ts`: with `NODE_ENV=production`, the
  Better Auth options have `useSecureCookies: true`, `baseURL = BETTER_AUTH_URL`,
  `trustedOrigins` including the extras, and no GitHub provider unless both keys are set.

### Implementation for User Story 4

- [ ] T062 [US4] Create the `deploy/host/` hardening files and wire them into `install.sh`:
  - `ufw/after.rules.docker-user`
  - `sshd/99-printex.conf`
  - `unattended-upgrades/52printex`
- [ ] T063 [US4] [X-TEAM: Fady / 001] Update `src/server/better-auth/config.ts`: add `baseURL`,
  `trustedOrigins`, `advanced.useSecureCookies` in production, and register GitHub only when
  configured.
- [ ] T064 [US4] [X-TEAM: Fady / 001] Remove the GitHub sign-in button from `src/app/page.tsx`, and
  add `data-testid="sign-in-form"` to the credential form (used by `smoke.sh`).
- [ ] T065 [US4] Write `deploy/runbooks/port-scan.md` (external and LAN scan procedure and results
  table) and document the network boundary per contracts/network-boundary.md §1–§2.
- [ ] T066 [US4] Add the `deploy.yml` `exposure` job (contracts/network-boundary.md §4 Automated).
  It also asserts that a fixture compose file with a published `db` port **fails** the check.
- [ ] T067 [US4] [X-TEAM: Fady / 054] Get agreement on contracts/network-boundary.md §3 (the gateway
  is outbound-only and holds no data copy). Record it in Linear.

**Checkpoint**: quickstart Scenarios 9.2–9.7 and 10 pass on staging.

---

## Phase 7: User Story 5 - A missed or failed backup, or a filling disk, alerts the Admin (Priority: P1)

**Goal**: Every backup, verify and health result is recorded in the app. Failures, misses and low
disk notify every active `admin.config` holder once per 20 h, and Admins can see the status.

**Independent Test**: quickstart.md Scenarios 11–12.

### Tests for User Story 5

- [ ] T069 [P] [US5] Write `tests/unit/ops/alerts.test.ts` per contracts/backup-health.md §8.
- [ ] T070 [P] [US5] Write `tests/integration/ops/recordBackupReport.test.ts` and
  `tests/integration/ops/reportRoute.test.ts` per contracts/backup-health.md §8.
- [ ] T071 [P] [US5] Write `tests/integration/ops/backupStatus.test.ts` per
  contracts/backup-health.md §8.
- [ ] T072 [P] [US5] Write `deploy/tests/watchdog.bats` with a fake clock (`NOW=` override). It
  covers:
  - 26 h stale → MISSED
  - 06:00 with no success since 02:00 → `NO_SUCCESS_TODAY`
  - running > 20 h → overrun
  - disk 14 % → WARNING, 4 % → CRITICAL
  - the spool flushed
- [ ] T073 [P] [US5] Write `tests/contract/ops/append-only.test.ts` and
  `tests/contract/ops/notify-shape.test.ts` per contracts/backup-health.md §8.

### Implementation for User Story 5

- [ ] T074 [US5] Create `src/server/ops/systemActor.ts`, `alerts.ts` and `recordBackupReport.ts`
  per contracts/backup-health.md §2–§3, and export them from the barrel.
- [ ] T075 [US5] Create `src/app/api/ops/backup-reports/route.ts` per contracts/backup-health.md §6.
- [ ] T076 [US5] Create `src/server/ops/backupStatus.ts` and
  `src/app/(shell)/admin/backups/page.tsx`, add a nav link for `admin.config` holders, and add the
  `ops.*` keys to `src/messages/ar.json`.
- [ ] T077 [US5] Create `deploy/scripts/watchdog.sh` and
  `deploy/host/systemd/printex-backup-watchdog.{service,timer}`.
- [ ] T078 [US5] [X-TEAM: Fady / 053] Get agreement on the notification port
  (contracts/backup-health.md §5): the types, payload, recipients, the no-internet-channel rule,
  and 053 owning delivery. Record it in Linear.

**Checkpoint**: the Vitest suite is green, and quickstart Scenario 11 passes on staging.

---

## Phase 8: User Story 6 - The shop keeps working with the internet unplugged (Priority: P1)

**Goal**: No internet dependency at runtime, proven in CI and in a physical drill.

**Independent Test**: quickstart.md Scenario 13.

- [ ] T079 [US6] Add the `deploy.yml` `offline-boot` job. It runs `compose.yaml` +
  `compose.offline.yaml` with all networks internal, applies the reference seed plus one test
  user, checks the sign-in page returns 200, and signs in via the credential endpoint with curl,
  expecting a session cookie.
- [ ] T080 [US6] In `offline-boot`, grep the built `.next/` and the image for
  `fonts.googleapis.com`, `fonts.gstatic.com`, `github.com/login` and CDN hosts. Any hit fails the
  job.
- [ ] T081 [US6] Write `deploy/runbooks/offline-drill.md` (unplug the WAN, walk the full
  lifecycle step list with roles, the expected off-site backup failure, and the record template).

**Checkpoint**: `offline-boot` is green.

---

## Phase 9: User Story 7 - Upgrade safely, and roll back if something goes wrong (Priority: P2)

**Goal**: One command upgrades with a maintenance page, a pre-upgrade backup, migrations, smoke
checks, a manual Admin check, and automatic rollback.

**Independent Test**: quickstart.md Scenario 14.

- [ ] T083 [P] [US7] Write `deploy/tests/upgrade.bats` (docker and compose stubbed):
  - the state transitions per contracts/upgrade.md §1
  - a BACKUP failure → app restarted, exit 1
  - a MIGRATE failure → ROLLBACK
  - `--resume` after a crash → ROLLBACK
  - a non-digest argument → refused
- [ ] T084 [US7] Create `deploy/scripts/upgrade.sh` and `rollback.sh` per contracts/upgrade.md
  §1. They reuse `smoke.sh` from T043. The upgrade log entry carries every FR-036 field.
- [ ] T085 [US7] Add the `deploy.yml` `upgrade-rehearsal` job (contracts/upgrade.md §4), including
  the `SMOKE_BREAK=1` build arg, which only takes effect in that job. It asserts that the rollback
  path completes in under 60 minutes (SC-008) and that the fixture data is identical.
- [ ] T086 [US7] Write `deploy/runbooks/upgrade.md` (pre-checks, running it, reading
  `upgrade.log`, what to do on exit 2, and the migration authoring rules from contracts/upgrade.md
  §3).

**Checkpoint**: `upgrade-rehearsal` is green.

---

## Phase 10: Polish, drills & go-live

**Purpose**: The security review, timed drills and owner go-live items. The drills are the
evidence for the brief's acceptance criteria.

- [ ] T088 [P] Write `deploy/runbooks/onboarding.md` (root CA install on Windows, Android and iOS,
  bookmark, the Admin creating the user with roles and departments, handing over the initial
  password, first sign-in, and the `printex.lan` fallback) per FR-038.
- [ ] T089 Run the full-system security review (FR-016): app authz on server paths, secrets
  (T006 scan), headers and cookies (quickstart 10), host hardening (the Lynis report is attached, and every warning
  is fixed or explained), image scan (`trivy image`, no CRITICAL). Record it in
  `deploy/drills/SECURITY-REVIEW.md` and fix or accept each finding with the owner.
- [ ] T090 **Go-live restore drill** (quickstart Scenario 7) on a clean machine, timed. It must be
  ≤ 4 h. Record it in `DRILL-LOG.md`, and schedule the quarterly repeats.
- [ ] T091 **Offline drill** (quickstart Scenario 13.2) with real staff roles. Record it in
  `DRILL-LOG.md`.
- [ ] T092 **External port scan** (quickstart Scenario 9.1) from outside the shop network. Record
  it in `deploy/runbooks/port-scan.md`.
- [ ] T093 **Missed-backup alert drill** (quickstart Scenario 11) on staging, or on the production
  server before go-live. Record it in `DRILL-LOG.md`.
- [ ] T094 **UPS drill** (quickstart Scenario 15). Record it in `DRILL-LOG.md`.
- [ ] T095 Onboard every staff device (quickstart Scenario 16), each ≤ 10 min (SC-009).
- [ ] T096 [X-TEAM: owner] Close out spec.md "Open go-live items (owner)" 1–7 and confirm every
  ASSUMPTION in Clarifications. Record this in Linear PRI-20.
- [ ] T097 Cross-team sign-off (Fady, Track B) before merge: T010/T015 (baseline), T023
  (permission), T034 (seed), T063/T064 (auth), T067 (054), T078 (053), and T056 (050 key rule).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002–T006 run in parallel after T001.
- **Foundational (Phase 2)**: T010 gates T011–T015, which gate T024 and every DB-dependent test.
  T016 → T017 → T018. T019 → T020. T022 before T025. T023 before T034 and T074. This phase
  BLOCKS all user stories.
- **User stories**:
  - **US1** needs Phase 2.
  - **US2** needs US1's `install.sh`/compose (T036/T038) for host runs. Its bats tests (T044/T045)
    can start after T004.
  - **US3** needs US2 (backups exist) and US1's `smoke.sh` (T043).
  - **US4** needs US1 (T036–T038). T063/T064 are independent app changes.
  - **US5** needs T024–T026 (schema, module) and US2's `emit_report`/`report.sh` for end-to-end
    runs. The app-side tests need only Phase 2.
  - **US6** needs T019 and T036.
  - **US7** needs US2 (`backup.sh --tag pre-upgrade`) and US1's `smoke.sh` (T043).
- **Polish (Phase 10)**: needs all stories. T090–T094 need the real or staging hardware (owner
  go-live item 1).

### Within Each User Story

- Tests are written first and are expected to fail.
- Schema, then services, then routes and pages. Scripts before units, and units before runbooks.

### Parallel Opportunities

- After Phase 2, the app-side US5 tasks (T069–T076) and the host-side US2/US3 tasks proceed in
  parallel, because they touch disjoint files.
- US4's T061/T063/T064 (the auth changes) can proceed in parallel with any host work.
- All `[P]` bats files are independent.

---

## Parallel Example: User Story 5

```bash
Task: "Unit test alert classification in tests/unit/ops/alerts.test.ts"
Task: "Integration test recordBackupReport in tests/integration/ops/recordBackupReport.test.ts"
Task: "Integration test status query in tests/integration/ops/backupStatus.test.ts"
Task: "Bats watchdog rules in deploy/tests/watchdog.bats"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 and Phase 2. The baseline (T010–T015) is the critical path, so start the Fady
   conversation on day 1.
2. US1: a running, healthy, HTTPS stack plus the first Admin.
3. **STOP and VALIDATE**: quickstart Scenarios 1–3.

### Incremental Delivery (all P1 stories before go-live)

1. US2 (backups) → US5 (alerts, so that failures are visible from the first night) → US3
   (restore + weekly verify) → US4 (hardening) → US6 (offline proof).
2. US7 (upgrade) is P2, but it must be in place before the **first** post-go-live release.
3. Phase 10 drills are the go-live gate.

---

## Notes

- There is no `db push` against a shared DB. T015 is run by Fady, never unattended.
- Shared files (create if absent, otherwise reuse unchanged, and never fork):
  - `src/server/core/aspects/**` and `src/server/aspects.ts` (T022)
  - `src/instrumentation.ts` (T018, where 091 adds only its block)
- Cross-feature touch points, to coordinate before landing:
  - 001: T023, T034, T063, T064
  - 050: T056
  - 053: T078
  - 054: T067
  - CI shared with every feature: T014
- Task IDs skip numbers between phases (T007–T009, T027–T029, …) to leave room for inserts
  without renumbering the cross-references in research.md and the contracts.
