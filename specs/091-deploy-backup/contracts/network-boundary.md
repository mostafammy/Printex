# Contract: Network Boundary (LAN exposure + 054 gateway)

Owner: 091. Cross-team: **054** (WhatsApp gateway, Fady) must agree to §3.

## 1. Exposure matrix (what answers where)

| Port / service | From the internet | From a LAN staff device | From the admin machine (`ADMIN_IP`) | From the server itself |
|---|---|---|---|---|
| 443 HTTPS (Caddy → app) | **closed** (no router forwarding; UPnP off) | open | open | open |
| 80 HTTP (redirect to 443 only) | **closed** | open (redirect) | open | open |
| 22 SSH (key-only) | **closed** | **closed** (UFW) | open | n/a |
| 3000 app | closed | closed (not published) | closed | only inside docker `edge` |
| 5432 Postgres | closed | closed (not published, `internal` network) | closed | unix socket `/srv/printex/pg-socket` (backup role only) |
| `/api/ops/*`, `/api/health` paths | closed | 404 (Caddy `remote_ip` guard) | 404 | allowed |
| mDNS 5353/udp (avahi) | closed | open (announces `printex.local`) | open | — |

Enforcement layers:

1. Compose publishes only `${LAN_IP}:80/443`.
2. UFW is deny-by-default inbound.
3. `DOCKER-USER` limits the published ports to `LAN_CIDR`.
4. The router has no port forwarding and UPnP is off (owner go-live item).

## 2. Outbound (egress) from the server

| Purpose | Destination | Required for core? |
|---|---|---|
| OS security updates | Ubuntu mirrors | no |
| Pinned image pulls (upgrade day only) | ghcr.io, Docker Hub | no (a tarball over USB is the fallback) |
| Off-site backup | the S3-compatible provider endpoint | no (the USB and LAN copies continue) |
| Time sync | NTP pool (chrony) | no (it free-runs offline) |
| 054 gateway sync (future) | the gateway's HTTPS/WSS endpoint | no (queued while offline) |

The core runtime makes no outbound connection (FR-039). The CI `offline-boot` job proves the app
starts and serves sign-in with every network `internal: true`.

## 3. WhatsApp gateway (054) boundary (documented here, built by 054)

```text
 INTERNET                                  │  SHOP LAN (no inbound from internet)
                                           │
 Meta Cloud API ──HTTPS webhooks──► 054 Gateway (hosted off-site, public HTTPS)
                                           │
                                           │   ◄── outbound only: local app (or 053/054 worker)
                                           │       opens HTTPS/WSS to the gateway,
                                           │       authenticates (mutual token or mTLS),
                                           │       pulls inbound events, pushes outbound
                                           │       messages, acknowledges by id
                                           │
                                     Local Printex server (source of truth)
```

The rules 054 must satisfy:

1. The gateway **never** opens a connection into the shop. There is no port forwarding, no
   tunnel that terminates on the server as a listener, and no reverse proxy from the gateway to
   the LAN.
2. The local side initiates every connection. It runs in the reserved `worker` compose slot (or
   in 053/054's own container on `backend` plus an egress-only network). Credentials live in
   `/etc/printex/printex.env` as `WHATSAPP_GATEWAY_URL` and `WHATSAPP_GATEWAY_TOKEN`, validated
   by `src/env.js` and optional.
3. The gateway holds **no copy of Orders, Customers or Staff** beyond what a message needs
   transiently (constitution VII: the local app is the source of truth). Its own data is outside
   091's backup scope, and 054 documents its own retention.
4. A gateway outage, or no internet at all, never blocks a core workflow. Outbound messages stay
   in the local outbox (`NotificationEvent`, delivery status owned by 053) and are retried.
5. Every connection uses TLS 1.2+ with certificate verification against the gateway's public
   certificate. No plaintext is allowed.
6. Inbound webhook authenticity (Meta signature verification) is the gateway's job. The local app
   trusts only authenticated pulls from the gateway, and still validates every payload with Zod
   (constitution V).

## 4. Verification

- **External scan** (US4-1, SC-004): from outside the shop, scan the shop's public IP address
  with `nmap -Pn -p- --open <public-ip>` from a phone hotspot or cloud VM, or use a scanning
  service. Expect no open ports that lead to the server. The result is recorded in
  `deploy/runbooks/port-scan.md` with its date.
- **LAN scan** (US4-2): run `nmap -p- printex.local` from a staff PC. Expect 80 and 443 only. From
  `ADMIN_IP` expect 22, 80 and 443.
- **DB reachability** (US4-4): `pg_isready -h <server-lan-ip> -p 5432` from a LAN PC must report
  no response. `docker compose port db 5432` prints nothing.
- **Automated**: the `deploy.yml` job `exposure` runs `docker compose config` and asserts that
  only `proxy` has `ports`, that each is prefixed with `${LAN_IP}`, and that `backend.internal ==
  true`.
