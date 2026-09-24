# Contract: Container Stack (`deploy/compose/compose.yaml`)

Owner: 091. Consumers: the install, backup, restore and upgrade scripts, and any later feature
that needs a container (for example 053's worker).

## 1. Services

| Service | Image (from `images.lock`) | Networks | Published ports | Volumes (host → container) | Runs as | Restart |
|---|---|---|---|---|---|---|
| `proxy` | `caddy:2.8.x@sha256:…` | `edge` | `${LAN_IP}:443:443`, `${LAN_IP}:80:80` (never `0.0.0.0`) | `deploy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro`, `deploy/caddy/maintenance.html:/srv/maintenance.html:ro`, `/srv/printex/caddy:/data`, `/srv/printex/backup-state/maintenance.flag:/srv/flags/maintenance.flag:ro` | caddy default | `unless-stopped` |
| `app` | `${PRINTEX_IMAGE}` = `ghcr.io/<org>/printex@sha256:…` (runner target) | `edge`, `backend` | none | `/srv/printex/files:/data/files` | uid 10001 | `unless-stopped` |
| `db` | `postgres:16.x-bookworm@sha256:…` | `backend` | none | `/srv/printex/postgres:/var/lib/postgresql/data`, `/srv/printex/pg-socket:/var/run/postgresql`, `deploy/compose/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro` | 999 (postgres) | `unless-stopped` |
| `migrate` (profile `tools`) | `${PRINTEX_TOOLS_IMAGE}` (tools target, same commit as `PRINTEX_IMAGE`) | `backend` | none | none | uid 10001 | `no` |
| `tools` (profile `tools`) | `${PRINTEX_TOOLS_IMAGE}` | `backend` | none | none | uid 10001 | `no` |
| `worker` (profile `worker`, **reserved for 053**) | defined by 053 | `backend` (plus egress only if 053 justifies it) | none | none | non-root | `unless-stopped` |

`app` settings:

- `read_only: true`, with `tmpfs` for `/tmp` and `/app/.next/cache`
- `cap_drop: [ALL]`, `security_opt: ["no-new-privileges:true"]`
- `env_file: /etc/printex/printex.env`
- `environment: { NODE_ENV: production, STORAGE_ROOT: /data/files, TZ: UTC, HOSTNAME: 0.0.0.0,
  PORT: 3000 }`
- `healthcheck: node -e "fetch('http://127.0.0.1:3000/api/health?probe=ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`
  (interval 15s, retries 5, start_period 30s)
- `depends_on: { db: { condition: service_healthy } }`
- `stop_grace_period: 30s`

`db` settings:

- `POSTGRES_PASSWORD_FILE=/run/secrets/pg_superuser`, using a compose `secrets:` file
  `/etc/printex/secrets/pg_superuser` (0600 root)
- `command: ["postgres", "-c", "hba_file=/etc/postgresql/pg_hba.conf", "-c", "listen_addresses=*",
  "-c", "password_encryption=scram-sha-256"]`
- `stop_grace_period: 120s` (a clean shutdown before the UPS powers off)
- `shm_size: 256mb`
- `healthcheck: pg_isready -U postgres` (interval 10s)

The `migrate` command is `pnpm exec prisma migrate deploy --schema prisma/schema`, with the env
`DATABASE_URL=${DIRECT_URL}` and `DIRECT_URL` from `/etc/printex/migrate.env` (0600 root). The
owner credentials are never in `printex.env`.

`tools` commands (entrypoint `node`): `prisma/seed.ts` with `SEED_PROFILE=reference`,
`prisma/bootstrap-admin.ts <username>` (password on stdin), and `scripts/count-orders.mjs` (smoke
read).

## 2. Networks

| Network | `internal` | Purpose |
|---|---|---|
| `edge` | `false` | proxy ↔ app. This is the only network with a bridge to the host |
| `backend` | `true` | app, tools, migrate ↔ db. It has no egress and is unreachable from the LAN |

`compose.offline.yaml` (CI and the drill) overrides `edge` to `internal: true` too, which proves
FR-039/FR-040.

## 3. Environment file keys (`/etc/printex/printex.env`, mirrored by `deploy/env/printex.env.example` with empty values)

| Key | Required in production | Validation (`src/env.js`) | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | url, user must be `printex_app` (rejected if the user is `postgres` or `printex_owner`) | runtime role |
| `BETTER_AUTH_SECRET` | yes | string ≥ 32 | kept across restores (recovery kit) |
| `BETTER_AUTH_URL` | yes | url, `https:` | `https://printex.local` |
| `BETTER_AUTH_EXTRA_ORIGINS` | no | comma list of `https:` urls | `https://printex.lan` |
| `STORAGE_ROOT` | yes | absolute path | set by compose to `/data/files` |
| `OPS_REPORT_TOKEN` | yes | string ≥ 32 | the same value is in `/etc/printex/backup/report.token` |
| `BACKUP_STALE_HOURS` | no | int 1–168, default 26 | read-time overdue |
| `BETTER_AUTH_GITHUB_CLIENT_ID/SECRET` | **no** (omitted) | optional. The provider is registered only if both are set | 001 change |
| `DIRECT_URL` | **no** (not given to `app`) | optional in `app` | only in `migrate.env` |
| `NODE_ENV` | set by compose | enum | |

Startup validation: `src/instrumentation.ts` `register()` imports `~/env` when `NEXT_RUNTIME ===
"nodejs"`. createEnv throws, and the process exits non-zero before it serves any request. The
container then fails its healthcheck and `upgrade.sh` rolls back (FR-008).

## 4. Pinning (`deploy/compose/images.lock`)

```text
CADDY_IMAGE=caddy:2.8.4@sha256:<digest>
POSTGRES_IMAGE=postgres:16.4-bookworm@sha256:<digest>
PRINTEX_IMAGE=ghcr.io/<org>/printex@sha256:<digest>          # written by upgrade.sh
PRINTEX_TOOLS_IMAGE=ghcr.io/<org>/printex-tools@sha256:<digest>
RESTIC_VERSION=0.17.3  RESTIC_SHA256=<sha256>                # host binary
```

The exact patch versions and digests are chosen at implementation time. CI job `pins` fails if
any `image:` in `compose.yaml` is not `${…}` from this file, or if any value lacks `@sha256:`.

## 5. Host units

- `printex.service`:
  - `Type=oneshot`, `RemainAfterExit=yes`
  - `RequiresMountsFor=/srv/printex`
  - `After=docker.service network-online.target`, `Requires=docker.service`
  - `ExecStart=docker compose --env-file deploy/compose/images.lock -f deploy/compose/compose.yaml up -d --wait`
  - `ExecStop=docker compose … down` (with the compose stop grace periods above)
  - `TimeoutStopSec=180`
- The UPS monitor (`upsmon`) runs `SHUTDOWNCMD "/sbin/shutdown -h +0"`, which stops
  `printex.service` first through normal systemd ordering.
