# Contract: Upgrade, Rollback & Smoke (`deploy/scripts/{upgrade,rollback,smoke}.sh`)

Owner: 091. Consumer: the engineer, following `deploy/runbooks/upgrade.md`.

## 1. `upgrade.sh <printex-image-digest> <printex-tools-image-digest> [--offline-image <tar>]`

The state is persisted in `/srv/printex/backup-state/upgrade.state` (JSON: `{ phase, from, to,
backupSnapshot, dumpPath, startedAt }`). Every transition is appended to
`/srv/printex/backup-state/upgrade.log` (one JSON line per upgrade at the end, FR-036).

```text
PREFLIGHT ──► MAINTENANCE ──► STOP_APP ──► BACKUP ──► MIGRATE ──► START ──► SMOKE ──► OPEN ──► DONE
    │              │              │           │           │          │         │
    └─ fail: exit  └──────────────┴── fail ───┘           └── fail ──┴── fail ─┴──► ROLLBACK ──► SMOKE(prev) ──► OPEN(prev) ──► ROLLED_BACK
       (nothing                     (reopen on N, exit 1)
        changed)
```

| Phase | Action | Failure handling |
|---|---|---|
| PREFLIGHT | Refuse if `upgrade.state` shows an unfinished upgrade (the operator must run `upgrade.sh --resume`, which rolls back). Check: the free space on the data disk is at least 2 × the last dump; the target digests can be pulled (or `--offline-image` loaded) and are `@sha256:`; `docker compose config` is valid; the env check (`docker run --rm --env-file … <new image> node -e "import('./src/env.js')"`, which fails on missing keys) | exit 1, no change |
| MAINTENANCE | `touch maintenance.flag`. Caddy serves `maintenance.html` with 503 for every path except `/api/health` from localhost | — |
| STOP_APP | `compose stop app` (so no writes happen from here on) | → reopen on N, exit 1 |
| BACKUP | `backup.sh --tag pre-upgrade --dest usb --no-prune` **must** exit 0. The LAN and off-site backups are then attempted and are best-effort. Record `backupSnapshot` and `dumpPath` | → `compose start app`, remove the flag, exit 1 (US7-2) |
| MIGRATE | Set `PRINTEX_TOOLS_IMAGE` to the new tools image, then `compose run --rm migrate` (`prisma migrate deploy` as `printex_owner`). Capture the list of applied migrations | → ROLLBACK |
| START | Set `PRINTEX_IMAGE` to the new image in `images.lock` (the previous value is kept in `releases/previous`), then `compose up -d --wait app` (waits for the healthcheck) | → ROLLBACK |
| SMOKE | `smoke.sh` | → ROLLBACK |
| OPEN | Prompt the engineer: "Sign in as Admin and open the orders list, then type OK" (FR-035). Then remove the flag. With `--yes-manual-check` the prompt is skipped only in the CI rehearsal | engineer answers NO → ROLLBACK |
| ROLLBACK (`rollback.sh`) | 1. stop app; 2. `pg_restore --clean --if-exists --exit-on-error --no-owner --role=printex_owner` from `dumpPath` into `printex`; 3. restore the `images.lock` previous digests; 4. `compose up -d --wait app`; 5. `smoke.sh`; 6. remove the flag; 7. log `ROLLED_BACK` | if smoke on N also fails: keep maintenance, exit 2, and the runbook escalates to the full restore (restore.sh) |

Files are not rolled back: the app was stopped, so no file objects were added after the backup,
and objects are immutable.

## 2. `smoke.sh [--via-proxy]`

It exits 0 only if all of these pass (each with a 10 s timeout, and up to 12 retries for the first
check):

1. `GET https://printex.local/api/health?probe=ready` (from the server, with `--cacert` for the
   Caddy root) → 200 and `"status":"ok"`.
2. `GET https://printex.local/` → 200, and the HTML contains the Arabic sign-in form marker
   (`data-testid="sign-in-form"`, added by this feature to the sign-in page).
3. `compose run --rm tools scripts/count-orders.mjs` → prints an integer ≥ 0 (a `printex_app`
   read).
4. `compose run --rm migrate prisma migrate status` → "Database schema is up to date".

## 3. Migration rules after the baseline (research §11)

- Every schema change is a migration created with `prisma migrate dev --create-only`, reviewed,
  and committed. `db push` is never run against a shared or production DB.
- Prefer expand → migrate data → contract across two releases. Destructive statements (`DROP`,
  narrowing type changes) need explicit approval and a data-preservation note (the constitution
  quality gate).
- An append-only table's migration includes `REVOKE UPDATE, DELETE ON "<Table>" FROM
  printex_app;`.
- CI `migrations` job:
  1. On an empty PG 16 with `printex_app` created: `prisma migrate deploy` must succeed.
  2. `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema
     --shadow-database-url $SHADOW_URL --exit-code` must exit 0 (no drift).

## 4. Rehearsal

`deploy.yml` job `upgrade-rehearsal` (on `main`):

1. Start the stack with the image from `main~1`, seed the `reference` profile plus a fixture
   order, and upgrade to the current build. Assert DONE.
2. Upgrade to a deliberately broken image (build arg `SMOKE_BREAK=1`, which makes `/` return 500).
   Assert ROLLED_BACK and that the fixture order is still present.
