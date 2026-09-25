# Implementation Plan: Notifications & Delay Detection

**Branch**: `helmysaman8/pri-17-spec-plan-053-notifications` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-notifications/spec.md`

## Summary

053 is everything after `notify()`. 002 records an outbox row in the transaction that caused an event; 053
turns those rows into per-user notifications. It adds an outbox processor with a database-enforced
idempotency boundary, four-mode recipient resolution, a shared event catalog covering PRD §38 with Arabic
titles and deep links, a notification center (bell with unread count, dropdown, full page), LAN real-time
delivery over SSE with a complete polling fallback, Admin-configurable per-phase delay thresholds
(4h/1h/2h/8h/24h), a leased in-process scheduler that alerts exactly once per breach, and
`getDelayedWorkItems()` for 011's reception queue and 090's dashboard.

## Technical Context

**Language/Version**: TypeScript strict, Node 22 (as 052).

**Primary Dependencies**: Next.js 15 App Router, Prisma/PostgreSQL (multi-file `prismaSchemaFolder`),
Zod, Vitest, existing 001/002/011/012/013/014/015/016/051/091 contracts. No new package.

**Storage**: PostgreSQL additive schema `prisma/schema/notifications.prisma`; six new tables
(`Notification`, `NotificationTypeOverride`, `DelayThreshold`, `DelayBreach`, `SchedulerRun`,
`SchedulerLease`); four added columns on 002's `notification_event` plus a retyping of its already-reserved
`deliveryStatus` to the `DeliveryStatus` enum and a `NULL → PENDING` backfill (A-001, research.md §Decision:
outbox reserved columns — the backfill is load-bearing, not cosmetic: without it the claim predicate skips
every event the live features have already recorded). One raw-SQL step for the threshold CHECK constraint.
No DB-level `REVOKE` on `notification` (reasoned in [data-model.md](./data-model.md) § Migration and
immutability notes).

**Module boundary**: New `src/server/notifications/` barrel is the only public import surface (mirror of
`src/server/pricing/` and `src/server/finance/`). Internals: `catalog.ts`, `derived.ts`, `processor.ts`,
`recipients.ts`, `center.ts`, `delays.ts`, `thresholds.ts`, `overrides.ts`, `scheduler.ts`, `stream.ts`,
`errors.ts`. UI in `src/components/notifications/` and shell routes.

**Testing**: Unit tests for age computation, phase mapping, age formatting, catalog rendering; integration
tests through server entry points for authorization, idempotency (the acceptance criterion), once-per-breach,
scope, and audit emission; contract tests for the 011 seam, the 051 `pendingSince` read, the 001 permission
vocabulary, and the 015/016/091 event aliases. Vitest, matching the repo's `fileParallelism: false` /
`maxWorkers: 1` / 20s-timeout config.

**Target Platform**: Local LAN server (Node on the shop's machine), Arabic RTL browsers on employee devices.

**Performance Goals**: notification visible on a connected client within 2s p95; bell + first dropdown page
< 500ms p95; `getDelayedWorkItems` first page < 500ms p95 on a full shop; scheduler tick completes without
touching more rows than the shop's open Work Item count.

**Constraints** (from spec + constitution):
- Works 100% with the internet unplugged (constitution VII, PRD §52). No external push, no CDN, no
  third-party channel.
- A notification is a pointer, never the record (constitution III, PRD §45). The audit log and the outbox
  row are the system of record.
- Idempotency is a schema property, not an application convention.
- No new permission key — 001's 22 keys are frozen; 053 reuses `admin.config` and `audit.view`.
- Delay detection observes and reports; it never changes a Work Item's state, a pricing status, or a
  business gate (constitution II).
- Arabic-first, RTL, logical properties only (constitution IX).
- The scheduler runs in-process behind a persisted lease; no new container (PRD §52 topology).

**Scale/Scope**: A single print shop — tens of users, hundreds to low-thousands of open Work Items,
one server. Every design decision below is sized for that, not for a distributed system.

## Constitution Check

*GATE: passed before Phase 0 research; re-checked after Phase 1 design (below).*

| Principle | Result |
|---|---|
| I. Canonical Order → Work Item model | PASS: notifications reference Work Item/Order but add no parallel source of truth. `work_item.state_changed` is a *trigger*, not a second model of the workflow; delay state is derived from the same state, never stored beside it. |
| II. Business gates are inviolable | PASS: 053 observes and reports. It never writes a Work Item state, never blocks a transition, never touches `PricingStatus`, and never participates in the delivery gate. PRD §6 (urgent) and §55 Rule 12 are honored — urgency changes neither alerting nor frequency. |
| III. History is append-only | PASS: notification content is write-once; no delete path exists; delay state is derived. The notification is explicitly a pointer, with the audit log as the record (FR-060). The one `DELETE` in 053 removes a `NotificationTypeOverride` *configuration* row, never a notification, breach, or audit record, and it is itself audit-backed (research.md §Decision: per-event override). The outbox has a single processing marker — 002's own reserved `deliveredAt`/`deliveryStatus`, reused rather than shadowed by a parallel pair (A-001). |
| IV. Files are immutable/private | PASS: 053 stores no file bytes and no file identifiers beyond what an event already carries. A notification about a file revision links to the Work Item, not to a file URL. |
| V. Server is the only authority | PASS: `getActor()` first on every user path; recipient resolution, unread counts, read state, and delay state are all server-computed. The client supplies no recipient, no count, and no delay signal. |
| VI. Configuration over hard-coding | PASS: thresholds and their recipients are `DelayThreshold` rows, and each catalog type's recipients are overridable through a `NotificationTypeOverride` row (FR-017), so no recipient is reachable *only* through a catalog constant. No employee name, role name, or department name appears in delivery logic. `DelayPhase` is a fixed 5-value measurement vocabulary by design — a new *threshold* is data, a new *axis to measure* is code, mirroring 001's permission-vocabulary precedent. |
| VII. Local-first, isolated integrations | PASS: the stream is served by the same local process; no outbound network I/O anywhere in 053. 091's `ops.*` alerts are in-app only and never routed to WhatsApp. |
| VIII. AI optional | PASS: no AI features. `operational.anomaly` is a catalog entry owned by 090, not an AI implementation. |
| IX. Arabic-first, task-oriented UX | PASS: every title, body, empty state, error, and validation message is Arabic. The bell is on every page for every role; the delayed list links straight to the Order (minimal clicks). |

**Post-design re-check (after Phase 1 artifacts)**: PASS — the strongest instance is FR-018 (captured
notification content), which is *stronger* than the spec's minimum: a notification is write-once, so no later
change to a Work Item or a catalog edit can rewrite what an employee was already told. The one deviation from
the letter of 002's contract is documented below and in research.md, not absorbed silently.

### Deliberate deviation, flagged for Fady

Adding `permissions` to 002's `NotifyEvent` extends a contract 002 states was frozen with Fady. It is
additive and backward-compatible, and 053's own operations do not need it — but 016's change-control
notifications and 091's `ops.*` alerts are specified in terms of permissions, so without it 053 would have
to drop them. Raised here rather than absorbed. Everything else in this plan is inside 053's own surface.

## Architecture and ownership

1. `src/server/notifications/catalog.ts` — the shared event vocabulary: every entry with canonical type,
   aliases, Arabic title/body, default recipients, link resolver, severity, owner. Exports the `Events`
   constant object emitters reference, plus `lookup(type)` (canonical + aliases) and
   `renderEntry(entry, ctx)`. No database access; pure.
2. `src/server/notifications/recipients.ts` — `resolveRecipients(spec)`: four-mode union against active
   users, deduplicated. The only place that reads `UserRole`/`UserDepartment`/`RolePermission`/
   `UserPermission` for 053.
3. `src/server/notifications/processor.ts` — `processOutboxBatch(limit)`: claim → catalog lookup → resolve →
   insert notifications + mark processed, one transaction per event. Catch-on-duplicate treats the unique
   violation as success. Never throws per event.
4. `src/server/notifications/center.ts` — `list` / `unreadCount` / `markRead` / `markUnread` / `markAllRead`,
   all user-scoped, with the scope-withholding rule for out-of-scope targets (FR-025).
5. `src/server/notifications/delays.ts` — the age derivation (`PhaseTiming` open QUEUE segment; 051
   `pendingSince` for pricing), the state→phase mapping, `getDelayedWorkItems(actor, filter)`,
   `getDelayedWorkItemIds()`, and the shared Arabic age formatter.
6. `src/server/notifications/thresholds.ts` — `DelayThreshold` read/update, Zod validation against 001's
   `ALL_PERMISSIONS`/`ALL_ROLE_KEYS` and active `Department`s, and `schedulerStatus()`.
7. `src/server/notifications/scheduler.ts` — the lease-guarded interval, `runDelayTick()`, and the
   idempotent `start`/`stop`. Module-load guarded.
8. `src/server/notifications/stream.ts` — the in-process connection registry, `publish(userId, …)`, and the
   `publish` call the processor makes after each event commits. Content-free payloads only.
9. `src/server/notifications/errors.ts` — the SCREAMING_SNAKE codes shared across the feature.
10. UI: `<NotificationBell>` + `<NotificationDropdown>` in the shell layout; `/notifications` page;
    `/admin/notifications` thresholds screen; `/delayed` list; the 011 queue badge.

## Integration dependencies

- **001**: `getActor`, `authorize`, `audit.record`, `Actor` (with `permissions` — import from `~/server/auth`,
  **not** `~/server/core`, whose `Actor` lacks the field), `ALL_PERMISSIONS`, `ALL_ROLE_KEYS`, `RoleKey`,
  `Permission`. **No new key**; `admin.config` and `audit.view` only.
- **002**: `notify()` and `NotificationEvent` (read side + 053's five processing columns), `WorkItem`,
  `WorkItemState`, `PhaseTiming` (read-only age anchor), and 002's reserved-writer rule for the processing
  columns.
- **011**: `listReceptionQueue(actor, opts?)` — 053 supplies `opts.getDelayedWorkItemIds`; 011 works
  unchanged without it (011 FR-008a).
- **051**: `pendingSince(workItemId)` / `PricingStatus.waitingSince` — the pricing age anchor. Implemented
  today.
- **012/013/014**: already emit `workitem.assigned` / `workitem.rejected`; 014 adopts
  `work_item.production_file_revised` from the catalog.
- **015/016/091**: spec-only features. 053 references their event **types** as catalog entries — never their
  code. No compile-time import, no runtime dependency, so their absence blocks nothing (constitution VII).
- **090**: consumes `getDelayedWorkItems()` for the "Delayed Orders" tile (PRD §49).

## Project structure

### Documentation (this feature)

```text
specs/053-notifications/
├── spec.md                  # Input specification
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── tasks.md                 # Phase 2 output (/speckit-tasks — NOT created here)
├── checklists/requirements.md
└── contracts/
    ├── notification-service.md   # processor, center, delays, thresholds, scheduler
    ├── event-catalog.md           # the shared event vocabulary
    ├── notification-stream.md     # SSE + fallback
    ├── authorization-audit.md     # 001 binding, audit matrix, system actors
    └── ui.md                      # bell, dropdown, page, thresholds screen, delayed surfaces
```

### Source Code (repository root)

```text
src/server/notifications/          # barrel: index.ts + catalog, derived, recipients, overrides,
                                  # processor, center, delays, thresholds, scheduler, stream, errors
src/components/notifications/      # NotificationBell, NotificationDropdown, NotificationList,
                                  # ThresholdsScreen, DelayedList, use-notification-stream
src/app/(shell)/layout.tsx         # add the shell header hosting <NotificationBell>
src/app/(shell)/notifications/     # full notification page (new)
src/app/(shell)/admin/notifications/  # thresholds + scheduler + unmapped types (new)
src/app/(shell)/delayed/           # delayed-work list (new)
src/app/(shell)/reception/page.tsx # bind opts.getDelayedWorkItemIds + delayed badge
src/app/(shell)/nav.ts             # add admin + delayed nav entries
src/app/api/notifications/stream/  # SSE route (new)
src/messages/ar.json               # notifications namespace + ops.alert.<type>

prisma/schema/notifications.prisma # additive: Notification, DelayThreshold, DelayBreach,
                                   # SchedulerRun, SchedulerLease + 5 columns on NotificationEvent
prisma/schema/migrations/<ts>_notifications/  # tables, indexes, CHECK, 5 seeded thresholds, lease row
config/053-notifications.yaml      # seed mirror of the default thresholds (FileConfig/YAML precedent)

tests/unit/notifications/          # ages, phase mapping, formatting, catalog rendering
tests/integration/notifications/   # processor idempotency, center authz/scope, once-per-breach, audit
tests/contract/notifications/      # 011 seam, 051 pendingSince, 001 vocabulary, event aliases
```

**Structure Decision**: single-project web app (existing layout), following the 051/052 module pattern
exactly — one server barrel, one additive Prisma file, feature components, feature routes under `(shell)`,
feature-scoped tests. No new top-level directories, no new packages, no new container.

## Delivery and sequencing

- **Phase 2 (Foundational) blocks everything**: schema, catalog, recipient resolution, and the
  `admin.config`/`audit.view` binding must land before any user story, because every story reads the
  catalog or writes a `Notification`.
- The processor ships before the UI. A notification that exists but is not yet visible is already a working
  system (011's queue, 090's dashboard, any future API can read it) — and it is the only way to satisfy the
  2-second criterion without holding delivery behind UI work.
- 053 never imports 015/016/091 code at compile time; their events are catalog entries. Their absence
  blocks nothing, and adding an emitter later requires only a catalog entry, which already exists.
- The scheduler starts with the processor: an alert with no way to see it running is a support incident.
  `schedulerStatus()` ships in the same phase.
- 014's `production_file_revised` acknowledgement gate stays 014's to implement. 053 delivers the catalog
  entry and the notification; 014 delivers the timer hold.
- **Backup scope**: all six tables live in the primary PostgreSQL database — covered by the existing DB
  backup set. 053 adds no new persistent store, so no new backup obligation (constitution Backups).
