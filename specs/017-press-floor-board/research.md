# Phase 0 Research: Press Floor Board

**Feature**: `017-press-floor-board` · **Date**: 2026-09-26 · **Spec**: [spec.md](./spec.md)

Each entry: **Decision** / **Rationale** / **Alternatives considered**. Items marked *(verified)*
were checked against the current code or against `modern-web-guidance` Baseline data on 2026-09-26.

---

## R1. Architecture style: object-oriented engine, functional React surface

**Decision**: Split the client into two layers.

1. **Board engine** (`src/lib/board/`): plain TypeScript classes with no React imports. They hold state
   and behavior: the store, move commands, drop policies, the live channel, the drag session, the
   motion director and choreographies, and the feedback center. Classes depend on small interfaces
   ("ports"), never on each other's concrete types.
2. **React surface** (`src/components/board/`): function components that *render* engine state
   through `useSyncExternalStore` and forward user intent to the controller. Components hold no
   business logic.

Patterns used, each where it earns its place:

| Pattern | Where | What it buys |
|---|---|---|
| **Command** | `MoveCommand`, `GroupMoveCommand` | One object per user move: `execute()` does optimistic apply → server call → reconcile or roll back. Commands are loggable and testable in isolation, and a new kind of move is a new class. |
| **Strategy** | `DropPolicy` (`DirectDrop`, `SheetDrop`, `ScreenDrop`) | How a drop behaves (commit now / ask first / open screen) is chosen per edge from server-provided metadata, without `if/else` chains in the controller. |
| **Registry (open/closed)** | `ChoreographyRegistry`, `SheetRegistry`, `CommandBarRegistry` | Adding an animation, a sheet or a ⌘K command = one new class plus one `register()` call. Existing code is not edited (matches the server's `InMemoryGuardRegistry` in `core/workflow/guards.ts`). |
| **Observer** | `BoardStore` (topic-scoped subscriptions), `FeedbackCenter` channels | Each lane re-renders only when its own cards change, and feedback outputs (toast, screen-reader announcer, haptics later) subscribe independently. |
| **State machine** | `DragSession`, `LiveChannel` | Explicit states (`idle → lifting → dragging → dropping → settling`; `connecting → open → stale → resyncing`) make illegal transitions impossible and are unit-testable without a DOM. |
| **Mediator** | `BoardController` | The only object that knows store + commands + motion + feedback. Components talk to the controller, and collaborators never talk to each other. |
| **Dependency inversion** | `MoveGateway`, `SnapshotGateway`, `LiveSource`, `MotionPort`, `FeedbackPort` | The engine is constructed with interfaces, so tests inject fakes and the React layer injects real adapters (server actions, `EventSource`, WAAPI). |

**Rationale**: The user asked for OOP, SOLID and modularity so that "adding an animation or a
message later" is cheap. Those qualities pay off in the *engine* layer: long-lived, stateful and
behavior-heavy. Writing React components themselves as classes would fight React 19 (hooks,
Server Components, the compiler) and the rest of this codebase, which uses function components
everywhere. Keeping OOP in the engine and functions in the view gives both: extensibility where
behavior lives, and idiomatic React where rendering lives. The engine is also framework-free, so
most of it is unit-testable in Vitest without jsdom.

**Alternatives considered**: (a) All-hooks architecture (custom hooks + context). Rejected: logic
scatters across effects, there is no single place to add a new animation or move type, and it is
hard to test without rendering. (b) Class components. Rejected: legacy in React 19 and inconsistent
with the codebase. (c) A state library (Zustand, Redux). Rejected: `useSyncExternalStore` over our
own `BoardStore` gives the same selective subscriptions with no dependency and full control over
optimistic reconciliation.

---

## R2. Where move legality is computed

**Decision**: The **server** computes, per card, the list of moves this actor may *offer* (`moves:
MoveOption[]`), and ships it inside the board snapshot and every card refresh. The client never
reads `ALLOWED_EDGES`, permissions or guards; it only renders what the server offered. The
precheck covers:

- the edge exists in `ALLOWED_EDGES`;
- the edge is user-initiated (per the edge catalog, R3);
- `actor.permissions.has(permission)`, plus department scope where the action is scoped;
- cheap static guards known to the catalog: `requiresDesign` (FR-015a), not the actor's own
  design (self-review), pricing resolved (Delivered, FR-017).

Every commit still runs the full guard chain inside the domain action (FR-012).

**Rationale**: Only one copy of the rules exists (constitution V, "server is the only authority"),
so the client cannot drift from the server. Moves are small (≤4 per card), so the payload cost is
negligible.

**Alternatives considered**: Ship `ALLOWED_EDGES` plus the actor's permissions to the client and
compute there. Rejected: this duplicates rule logic in two runtimes, and guards (self-review,
pricing) would need client copies.

---

## R3. Edge catalog: mapping each workflow edge to its action *(verified against code)*

**Decision**: A server-side `EdgeCatalog` (class registry, like the guard registry) classifies
every edge in `ALLOWED_EDGES` as `DIRECT`, `SHEET`, `SCREEN` or `SYSTEM`. A contract test asserts
every edge is classified, so a new edge fails the suite (same philosophy as FR-002).

| From → To | Kind | Domain action (existing unless noted) | Permission | Sheet input |
|---|---|---|---|---|
| NEW → ASSIGNED | SHEET | `designers.assignDesigner` | `workitem.assign_designer` | designer (with suggestion) |
| NEW → READY_FOR_PRODUCTION | DIRECT | **new** `orders.sendToProduction` (FR-015a) | **new** `workitem.send_to_production` | — |
| ASSIGNED → IN_DESIGN | DIRECT | `designers.startTimer` | `design.work` | — |
| IN_DESIGN → DESIGN_COMPLETED | DIRECT | `designers.markDesignComplete` (chains to review/approved) | `design.work` | — (refused if no version uploaded) |
| DESIGN_COMPLETED → WAITING_REVIEW / APPROVED | SYSTEM | chained inside `markDesignComplete` | — | — |
| WAITING_REVIEW → APPROVED | DIRECT | `review.approveDesign` | `design.review` | — |
| WAITING_REVIEW → REWORK_REQUIRED | SHEET | `review.rejectDesign` | `design.review` | category, explanation, attachments |
| REWORK_REQUIRED → IN_DESIGN | DIRECT | `designers.startTimer` | `design.work` | — |
| REWORK_REQUIRED → ASSIGNED | SHEET | `designers.assignDesigner` (reassign) | `workitem.assign_designer` | designer, reason |
| APPROVED → WAITING_PRICING / READY_FOR_PRODUCTION | SYSTEM | auto-routed on approval (**PRI-66**, not yet built) | — | — |
| WAITING_PRICING → READY_FOR_PRODUCTION | SCREEN | the drop opens the pricing panel (051); the move itself happens automatically once priced (**PRI-66**) | `pricing.*` | opens `/pricing?workItem=…` |
| READY_FOR_PRODUCTION → IN_PRODUCTION | SHEET* | `production.startProduction` (+ `routeToDepartment` if no department) | `production.operate` (dept-scoped) | department, only when unset |
| IN_PRODUCTION → PRODUCTION_COMPLETED | SHEET | `production.completeProduction` | `production.operate` | produced quantity |
| IN_PRODUCTION → REWORK_REQUIRED | SHEET | `production.sendBackToDesign` | `production.operate` | category, reason |
| PRODUCTION_COMPLETED → READY_FOR_COLLECTION | SHEET | 015 receive-and-count action | `collection.receive` | counted quantity |
| READY_FOR_COLLECTION → DELIVERED | SHEET | 015 hand-over action (group-capable) | `delivery.record` | hand-over details |
| DELIVERED → COMPLETED | SYSTEM | 015 financial closure | — | — |
| *any* → CANCELLED | SHEET | `orders.cancelWorkItem` / 016 `cancelAfterProductionStarted` when in or after production | `order.cancel` | reason (+ cost after production start) |

\*`SHEET*`: a conditional sheet. The catalog entry declares `needsInput(card)`, so the drop is direct
when a department is already set.

Cancellation is not a column. It is offered as a "Cancel…" item in the card's context menu and
the "move to" list, and as a dedicated drop zone that appears at the board's end edge during a
drag.

**Gap found (verified 2026-09-26)**: no code on `main` or on `016-change-control-impl` moves a Work
Item out of `APPROVED` or `WAITING_PRICING`. `approveDesign` stops at `APPROVED`, and production
tests seed `READY_FOR_PRODUCTION` directly. The product owner chose system auto-routing, tracked
as **PRI-66** (gate-critical, blocks PRI-65 and PRI-37). 017 only *displays* those moves.

Edges owned by 015 are registered by 015's module when it lands. Until then, the catalog marks
them `UNAVAILABLE` and the Collection/Delivered columns are view-only (spec Assumptions).

**Rationale**: FR-013 requires the *same* domain function as the button path. Existing page-level
`"use server"` wrappers swallow `Domain*Error`s silently (e.g. `production/[workItemId]/page.tsx`
returns early on `DomainProductionError`), so the board cannot reuse those wrappers. It must call
the domain functions directly through its own adapter that returns a typed `Result` with the
refusal reason (FR-014).

**Alternatives considered**: Calling `transitionWorkItem` generically. Rejected: this bypasses the
domain actions' side effects (timers, returns, notifications) and violates FR-013.

---

## R4. Live updates: Postgres `LISTEN/NOTIFY` → in-process hub → SSE *(verified: single-server LAN deployment, 091)*

**Decision**:

1. An `AFTER INSERT` trigger on `"WorkItemTransition"` calls
   `pg_notify('board_transition', json)` with `{id, workItemId, orderId, from, to, actorId, at}`.
   Notifications are delivered **only on commit**, so rolled-back transitions never leak, and moves
   from *any* code path (board, detail pages, system chains, seeds) are captured.
2. One `BoardLiveHub` per server process holds a single dedicated `pg` client in `LISTEN` mode
   (a `globalThis` singleton, which survives dev HMR). It reconnects with backoff and re-issues
   `LISTEN` after a reconnect.
3. The route handler `GET /api/board/stream` authenticates with `getActor()`, subscribes to the
   hub, and writes SSE frames. Each event passes a **visibility filter** (R6) before it is sent.
   Events carry **ids and states only**; card details are fetched through the authorized
   `getBoardCards` action. A comment heartbeat is sent every 20 s, with `retry: 3000`.
4. The client `LiveChannel` (a state machine) uses `EventSource`. On any reconnect it performs a
   **full resync** (`getBoardSnapshot`) rather than replaying missed events (FR-025).

**Rationale**: 091 fixes the deployment at one server on the LAN, and multi-server is out of scope.
LISTEN/NOTIFY is still preferred over an in-process emitter because it is commit-safe and captures
every writer without touching the 10+ existing domain actions. SSE is one-way, works over the
existing HTTPS and cookies, and auto-reconnects. A 2 s budget (SC-004) is comfortably met, since
NOTIFY latency on a LAN is milliseconds.

**Alternatives considered**: (a) An in-process `EventEmitter` fired after each action. Rejected:
it needs edits to every domain action, must fire *after* commit (which is hard with caller-owned
`tx`), and misses system chains. (b) Polling `WorkItemTransition` by `at`. Rejected: rows from
concurrently committing transactions can appear with an earlier `at` after the poll cursor passed,
so events would be missed. (c) WebSockets. Rejected: bidirectional transport isn't needed, and
it would require a custom server outside Next.js route handlers.

**New dependency**: `pg` (+ `@types/pg`). Prisma cannot hold a `LISTEN` connection. Justified in
the plan's Complexity Tracking.

---

## R5. Card motion: WAAPI FLIP with `linear()` springs, not View Transitions *(verified Baseline)*

**Decision**: Implement motion with the Web Animations API (`element.animate`) using the FLIP
technique (measure First → apply Last → Invert with a transform → Play to identity). Spring and
bounce feel comes from CSS `linear()` easing stored as tokens. Each "earned moment" is one
`Choreography` class registered in a `ChoreographyRegistry` and run by a `MotionDirector`:

| Choreography | Trigger | Motion (transform/opacity only) | Duration |
|---|---|---|---|
| `LiftChoreography` | drag start | scale 1.03, raise shadow, 1° tilt toward travel | 140 ms spring |
| `TravelChoreography` | any relocation (own or live) | FLIP translate from old rect to new rect | 380 ms spring |
| `StampChoreography` | commit accepted | scale 1 → 0.94 → 1 + ink ring burst in the station ink | 220 ms bounce |
| `FlyBackChoreography` | refusal / sheet cancel | FLIP back + 2-cycle horizontal shake (logical) | 420 ms spring |
| `ReworkArcChoreography` | backward edge | SVG path arc from old to new rect, drawn with `stroke-dashoffset`, red | 520 ms |
| `RollOutChoreography` | card → COMPLETED | translate along the flow axis + clip-path wipe, then remove | 480 ms |
| `LandChoreography` | card enters a lane from nowhere (newly visible) | fade + 8 px rise | 200 ms |

Rules enforced by the director:

- Only `transform`, `opacity`, `clip-path` and SVG stroke are animated (compositor-friendly).
- Animations on the same element are cancelled and replaced, never stacked. `finished` promises let
  commands await settle.
- Only cards inside the virtualized viewport animate. Off-screen changes are applied instantly.
- `prefers-reduced-motion: reduce` swaps every choreography for an `InstantChoreography` (FR-031).
  This is decided once in the director through a `matchMedia` listener, so choreographies never
  branch on it.
- Nothing loops. The director has no timers when idle (FR-030, SC-007).
- Directions come from measured rects, so RTL needs no special-casing. The shake uses the logical
  inline axis.

**Browser support** *(modern-web-guidance, 2026-09-26)*:

- `linear()` easing: Baseline widely available since 2023-12. Used without a fallback, per the
  guide's own MANDATORY rule that a duration is always paired with it.
- WAAPI: widely available.
- View Transitions: Baseline *newly* available only since 2025-10, and "active view transition" since
  2026-01. They are also document-global: a live update arriving mid-drag would abort a running
  transition.

**Rationale**: The FLIP + WAAPI approach gives per-card, interruptible, cancellable animation with
zero dependencies, and works with virtualization. The registry makes new animations a one-class
change, as requested.

**Alternatives considered**: (a) the `motion` (Framer) library. Rejected: about 30–50 kB for
features we'd use two of, and layout animations conflict with virtualization. (b) View Transitions
for card moves. Rejected for the reasons above. They *are* adopted, progressively and
feature-detected, for **page navigations** (board ↔ Work Item detail) through the
`directional-navigation-transitions` guide pattern, where a global transition is appropriate.

---

## R6. Visibility: who sees which card (live and snapshot)

**Decision**: A single pure function `canSeeWorkItem(actor, card)` in `src/server/board/visibility.ts`
drives both the snapshot query (translated to a Prisma `where`) and the live filter:

- Floor-wide visibility for anyone holding any of `order.create`, `order.edit`, `design.review`,
  `pricing.use_fixed`, `pricing.set_variable`, `collection.receive`, `delivery.record`,
  `audit.view`, or `admin.*`.
- `design.work` only → Work Items where `assigneeId = actor.userId`.
- `production.operate` only → Work Items whose effective department (`effectiveDepartmentId`) is in
  `actor.departmentIds`, in states from `READY_FOR_PRODUCTION` onward.
- Union across permissions for multi-role users.

**Rationale**: It mirrors how the existing queues scope data (designer queue, operator queue), in
one place, so FR-022's "never more than elsewhere" is testable with a table-driven test against
each queue's existing query.

**Alternatives considered**: Per-role hard-coded filters. Rejected: the codebase authorizes by
permission, never by role (`permissions.ts` header comment).

---

## R7. Drag and drop: `@dnd-kit/core`

**Decision**: Use `@dnd-kit/core` (stable 6.x) for pointer, touch and keyboard sensors, collision
detection and screen-reader announcements. Only `core` is needed (no sortable, since manual
reordering is out of scope).

- **Touch**: `TouchSensor` with `activationConstraint: { delay: 250, tolerance: 8 }` gives the
  press-and-hold pick-up and never hijacks scrolling (FR-035b, SC-010).
- **Keyboard**: the `KeyboardSensor` is *not* used for moving between columns. Keyboard moves go
  through the "move to" menu (FR-020), which is simpler and more predictable for staff than arrow
  navigation across virtualized lanes. The menu is also the phone path.
- **Announcements**: Arabic `announcements` strings are fed from `FeedbackCenter` (FR-032).
- **Overlay**: `DragOverlay` renders the lifted ticket, so the source card stays in layout and the
  FLIP source rect is exact.
- **Auto-scroll**: the built-in edge auto-scroll works for RTL overflow.
- dnd-kit is wrapped behind a `DragSession` adapter so the engine does not depend on the library
  (dependency inversion). Replacing it later touches one file.

**Alternatives considered**: (a) Native HTML drag and drop. Rejected: no touch support on iOS, and
poor keyboard and styling control. (b) `@dnd-kit/react` 0.x. Rejected: pre-1.0. (c) A hand-rolled
Pointer Events implementation. Rejected: rebuilding accessibility and collision is risky for a
go-live gate.

---

## R8. Rendering performance

**Decision**:

- Board data comes from **one** server action (`getBoardSnapshot`), rendered first as an RSC
  payload (no loading spinner on first paint), then hydrated into `BoardStore`.
- The store is normalized: `cards: Map<id, BoardCard>` plus `lanes: Map<WorkItemState, id[]>` kept
  sorted by FR-005. Subscriptions are topic-scoped (`lane:<state>`, `card:<id>`, `meta`), so a move
  re-renders exactly two lanes and one card.
- Each lane is virtualized with `@tanstack/react-virtual` (already a dependency), with an
  estimated fixed ticket height. `JobTicket` is `React.memo` on `(card, laneState)`.
- Columns use `content-visibility: auto` for off-screen columns on narrow viewports.
- Live bursts are coalesced: `BoardStore.applyBatch` flushes on `requestAnimationFrame`.
- Target: SC-005 (500 cards < 2 s, no dropped frames while dragging). Verified by
  `tests/performance/board-snapshot.test.ts` (server) and a manual Performance-panel check
  (quickstart §6).

---

## R9. Visual system: ink tokens *(verified: app uses the `.dark` class strategy)*

**Decision**: Replace the `apple-*` tokens in `src/styles/globals.css` with a three-layer token
system, split into `src/styles/ink.css`:

1. **Primitive inks**: `--ink-cyan`, `--ink-magenta`, `--ink-yellow`, `--ink-key`, `--ink-violet`,
   `--ink-orange`, `--ink-green`, `--ink-red`, each with `-fill`, `-edge`, `-text` and `-wash`
   variants defined in OKLCH for light and dark. `-text` variants are darkened (light theme) or
   lightened (dark theme) until they reach ≥ 4.5:1 against the card surface (FR-027, FR-029).
2. **Semantic station tokens**: `--station-reception: var(--ink-cyan)` … mapped by the table in
   FR-027. `--signal-backward`, `--signal-destructive` and `--signal-overdue` map to `--ink-red`
   (FR-027a).
3. **Component tokens**: `--ticket-edge`, `--ticket-wash`, `--lane-glow` set per element with
   `data-station="production"` → `--ticket-edge: var(--station-production-edge)`. Components never
   name an ink directly.

The theme mechanism stays on the existing `.dark` class (so the rest of the app doesn't change).
`color-scheme` is set on `:root` and `.dark`, and a `<meta name="color-scheme" content="light dark">`
is added (MANDATORY in the `dark-mode` guide). `light-dark()` is **not** used: it is only Baseline
since 2024-05, and the class strategy already covers it.

Station inks are exported to TypeScript as `STATION_INK: Record<StationId, InkName>` so the SVG
rework arc and the canvas-free ink burst can read the same token names.

Also removed: the global `* { transition-timing-function }` rule, the `transition: all` rules, two
of the three aurora blur layers (the shell keeps one low-cost gradient) and `animate-pulse` on nav.

**Rationale**: Semantic indirection means that re-inking a station is a one-line change, and that
contrast is proved once per ink (a unit test computes OKLCH → sRGB contrast for every `-text` on
the surface tokens).

---

## R10. Station targets and "overdue" *(gap found: no expected durations exist in code)*

**Decision**: A card is **overdue** when either (a) its effective due date (`WorkItem.dueDate ??
Order.dueDate`) has passed, or (b) its time at the current station exceeds that station's target.
Station targets live in `config/017-board.yaml` (minutes per station, urgent and normal),
following the `config/052-finance.yaml` precedent (constitution VI: configuration over
hard-coding). V1 has no admin editing UI. Time at station is computed from existing `PhaseTiming`
segments and the last `WorkItemTransition.at` (pure, as in `workflow/timing.ts`).

The card's ink bar fills with the station ink as time approaches the target (0–100%) and switches
to `--signal-overdue` with a clock-alert icon and "متأخر" text past it (FR-007).

**Alternatives considered**: (a) A DB config table plus admin UI. Deferred: scope creep for a
go-live gate, and it can be added later without changing the card contract. (b) Due date only.
Rejected: many Work Items have no due date, and the shop's pain is items stuck *between*
stations.

---

## R11. Shell: icon rail and command bar

**Decision**:

- `IconRail` replaces `SidebarNav` and reuses `nav.ts` and `filterNavByPermissions` unchanged (every
  existing destination stays reachable, FR-033). Labels appear as Base UI `Tooltip`s on hover and
  focus. Each icon uses its station ink when it maps to a station.
- `CommandBar` uses `@base-ui/react` `Dialog` + `Autocomplete` (already a dependency). It opens
  with ⌘K / Ctrl+K and a visible rail button. Sources come from a `CommandBarRegistry` of
  `CommandSource` classes (`PagesSource`, `OrdersSource`, `CustomersSource`, `WorkItemsSource`), so
  adding a source is a new class. Search reuses the existing `orders/search.ts` and
  `customers/search` server functions (permission-checked).
- Sheets, toasts and menus use Base UI `Dialog`/`Popover`/`Toast`/`Menu`. No new UI dependency.
- The home route `/` redirects to `/board` (FR-001). `/my-queue` and the other queues remain.

---

## R12. New permission rollout (FR-015a)

**Decision**: Add `"workitem.send_to_production"` to the `Permission` union and `ALL_PERMISSIONS`,
seed it onto `RECEPTION` and `ADMIN_OWNER` in `prisma/seed.ts`, and ship an idempotent data
migration that grants it to those two roles on existing installs. Update
`tests/contract/role-permission-matrix.test.ts`. The new `orders.sendToProduction(actor, workItemId)`
calls `authorize`, checks `requiresDesign === false` (returns a domain error otherwise), runs
`transitionWorkItem` to `READY_FOR_PRODUCTION` in one transaction, and records the audit event
`workitem.sent_to_production`.

---

## R13. Browser-support policy

**Decision**: Target evergreen browsers on shop devices (Chromium, Safari and Firefox from 2025
onward). Baseline *widely available* features are used freely. *Newly available* features are used
only with feature detection and graceful degradation: View Transitions for page navigation, and
`@starting-style` for sheet entry (sheets then simply appear without it). Recommend recording this
policy in a project `CLAUDE.md`/`AGENTS.md` for future agents (the `modern-web-guidance` skill
suggests this).

---

## R14. Observability

**Decision**: Structured server logs `board.move.accepted` / `board.move.refused` (with `code`,
edge and duration) and `board.live.{connected,disconnected,listener_error}`. The live hub's status
(listener connected, subscriber count, last event age) is added as a check on the existing
`/admin/health` page (`src/server/admin/health.ts`).
