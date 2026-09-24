# Contract: Health Check (`GET /api/health`)

Owner: 091. Consumers: the `app` container healthcheck, `smoke.sh`, `upgrade.sh`, `restore.sh`,
`verify-restore.sh`, and the CI offline-boot job.

## Request

`GET /api/health?probe=live|ready`. The default is `ready`. The runtime is `nodejs`, with
`dynamic = "force-dynamic"`. There is no authentication (plan.md Complexity Tracking).

## Behaviour (`src/server/ops/health.ts`)

| Probe | Checks | Budget |
|---|---|---|
| `live` | the process is serving requests. It touches nothing | < 10 ms |
| `ready` | `env`: the `~/env` import succeeded (always true if the process started, because instrumentation validates at boot). `db`: `SELECT 1` through `db` with a 2 s timeout. `storage`: `STORAGE_ROOT` exists and is writable (create and remove a `.health-<pid>` file under `STORAGE_ROOT/.tmp/` with a 2 s timeout) | < 5 s total |

## Response

- `200` `{ "status": "ok", "checks": { "env": true, "db": true, "storage": true } }`
- `503` `{ "status": "unavailable", "checks": { "env": true, "db": false, "storage": true } }`
- `Cache-Control: no-store`.

The body never includes versions, hostnames, paths, error messages, row counts or env values.
Failures are logged server-side (with no secrets).

## Exposure

The Caddyfile answers `404` for `/api/health` to every `remote_ip` except the server's own LAN IP
and the docker `edge` gateway. The container healthcheck calls `127.0.0.1:3000` directly.

## Tests

`tests/integration/ops/healthRoute.test.ts`:

- `live` returns 200.
- `ready` returns 200 with the DB up.
- `ready` returns 503 when the DB client is replaced by a failing stub, and when `STORAGE_ROOT`
  is read-only (a temp dir chmod 0500).
- The body keys are exactly `status` and `checks`, and no `error`/`message` field is ever present.
