# Implementation Plan: Press Floor Board

**Branch**: `017-press-floor-board` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-press-floor-board/spec.md`

**Linear**: PRI-64 (spec & plan) · PRI-65 (implement) · depends on **PRI-66** (approved/priced
auto-routing, found during planning), 015, 016.

## Summary

Replace the sidebar-first shell with a live **Press Floor Board**: seven station columns in RTL
flow, where each Work Item is a job-ticket card. A card moves by drag (desktop and tablet) or by
the "move to" list (keyboard and phone). The server decides which moves to offer per card and
executes every move through the *existing* domain action for that edge, so gates, audit and side
effects are identical to today's buttons. Moves appear on every open board within 2 s through
Postgres `LISTEN/NOTIFY` → an in-process hub → SSE. The UI adopts a CMYK "ink" token system, and
motion is limited to a handful of spring-eased WAAPI choreographies.

Architecturally, the client is an **object-oriented engine** (store, commands, drop-policy
strategies, state-machine drag and live sessions, a motion director with a choreography registry,
and a feedback center), wired through ports and rendered by thin, functional React components.
New animations, alerts, sheets and command-bar sources are added by registering one new class.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Next.js 15 (App Router), Node.js 20+.

**Primary Dependencies**:

| Dependency | Status | Used for |
|---|---|---|
| Prisma 6 | existing | reads for snapshot and cards |
| `@base-ui/react` | existing | Dialog, Popover, Toast, Menu, Tooltip, Autocomplete (sheets, toasts, ⌘K) |
| `@tanstack/react-virtual` | existing | lane virtualization |
| `lucide-react` | existing | station and state icons |
| Zod | existing | action and SSE payload validation |
| `yaml` | existing | station targets config |
| **`@dnd-kit/core` ^6** | new (R7) | pointer, touch and accessible drag |
| **`pg` ^8 + `@types/pg`** | new (R4) | dedicated `LISTEN` connection |
| WAAPI + CSS `linear()` | platform | motion (no motion library, R5) |

**Storage**: PostgreSQL (existing). No new tables. One trigger (`board_transition_notify`), one
permission grant migration, and one YAML config (`config/017-board.yaml`).

**Testing**: Vitest (unit: node; components: jsdom + Testing Library; contract and integration:
test DB via `pnpm test:db`); `tests/performance/` for the snapshot budget; manual quickstart
walkthrough for motion, touch and cross-browser checks.

**Target Platform**: A single Linux server on the shop LAN (091). Staff browsers are evergreen
Chromium, Safari and Firefox on desktops, tablets and phones (R13).

**Project Type**: Web application (Next.js monolith: `src/server` domain + `src/app` routes +
`src/components` UI).

**Performance Goals**: board usable < 2 s with 500 active Work Items (SC-005), server snapshot
≤ 600 ms; optimistic move visible < 100 ms (SC-002); cross-client update < 2 s (SC-004); 60 fps
during drag and travel (transform/opacity only); zero animation while idle (SC-007).

**Constraints**: Arabic-first RTL with logical properties only; WCAG 2.1 AA contrast; reduced
motion honored; the server is the only authority (no rule logic in the client); no new
states or edges (only the FR-015a action).

**Scale/Scope**: 1 shop, ≈ 10–30 concurrent staff, a few hundred active Work Items, 7 stations,
13 on-board states, ≈ 18 edges.

## Constitution Check

*GATE: must pass before Phase 0 research, and is re-checked after Phase 1 design.*

| Principle | How 017 complies | Status |
|---|---|---|
| **I. Order → Work Item canonical** | One card = one Work Item. Order is shown as a tag and group. Stations and lanes are presentation only (`STATE_PLACEMENT`). No new states or edges. Order status is never shown as editable. | ✅ |
| **II. Gates inviolable** | Legality is computed server-side; every commit runs the full guard chain in the domain action. Self-review is never offered and is refused if forced. Delivered is refused while pricing is unresolved. Urgent only reorders lanes. PRI-66 (auto-routing) is specified as its own gate-critical fix, not improvised in UI code. | ✅ |
| **III. Append-only history** | Moves reuse domain actions, which write `WorkItemTransition` + `AuditEvent`. The new `sendToProduction` audits. **No undo** (FR-014a), so corrections are new audited moves. The trigger only reads (NOTIFY). | ✅ |
| **IV. Files immutable** | Not touched. The reject sheet's attachments go through the existing `uploadReturnAttachments`. | ✅ |
| **V. Server only authority** | The client renders server-offered `moves`. `NOT_OFFERED`/`FORBIDDEN` on forced calls. Live events are filtered per actor and carry ids only. | ✅ |
| **VI. Configuration over hard-coding** | Station targets are in `config/017-board.yaml`. Station → ink is a single token map. The new permission is grantable per user. | ✅ |
| **VII. Local-first, isolated integrations** | LISTEN/NOTIFY and SSE run entirely on the LAN server. No external service. | ✅ |
| **VIII. AI optional** | No AI. | ✅ N/A |
| **IX. Arabic-first, task-oriented** | Role slices answer "what do I do next". RTL logical layout; all strings Arabic; the board is one click from any page (⌘K). Added steps (sheets) exist only where a gate needs input, justified in spec FR-015. | ✅ |
| **Stack constraint** | New deps: `@dnd-kit/core`, `pg`. See Complexity Tracking. | ✅ justified |
| **Time** | UTC stored; elapsed/due rendered in the shop time zone (`FinanceConfig.shopTimezone`). | ✅ |
| **Security** | Every action calls `getActor` + `authorize` (via the domain action). SSE is auth-checked with a 5-minute re-check. No existence oracle for invisible Work Items. | ✅ |

**Post-design re-check (after Phase 1)**: ✅ still passing. The design added no tables, kept all
writes inside existing domain actions (plus FR-015a), and surfaced one pre-existing gate gap, which
was routed to PRI-66 instead of being patched in 017.

## Project Structure

### Documentation (this feature)

```text
specs/017-press-floor-board/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R14 decisions
├── data-model.md        # Phase 1: station map, DTOs, trigger, engine object model
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── board-server.md  # snapshot/cards/move/group/sendToProduction + EdgeCatalog
│   ├── board-live-sse.md# SSE endpoint, hub, LiveChannel
│   ├── board-engine.md  # client ports, store, commands, policies, registries, React surface
│   └── ink-tokens.md    # token layers, contrast rules, removals
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
config/
└── 017-board.yaml                        # station targets (R10)

prisma/
├── manual-sql/board-transition-notify.sql
├── migrations/<ts>_board_live_and_send_to_production/   # trigger + permission grant
└── seed.ts                               # + workitem.send_to_production on RECEPTION, ADMIN_OWNER

src/server/
├── auth/permissions.ts                   # + "workitem.send_to_production"
├── orders/sendToProduction.ts            # NEW domain action (FR-015a), exported from ~/server/orders
└── board/                                # NEW server module (functional + class registries, matches core style)
    ├── index.ts                          # public barrel
    ├── stations.ts                       # STATIONS, STATE_PLACEMENT (satisfies Record<WorkItemState,…>)
    ├── edgeCatalog.ts                    # EdgeCatalog class + EdgeHandler interface
    ├── edges/                            # one file per edge family: design.ts, review.ts, production.ts,
    │                                     #   reception.ts, cancel.ts, pricing.ts (SCREEN), system.ts
    ├── visibility.ts                     # canSeeWorkItem + toPrismaWhere
    ├── slices.ts                         # role → slice defaults & precedence (FR-021)
    ├── projection.ts                     # rows → BoardCard (pure) + queries (≤ 4)
    ├── snapshot.ts                       # getBoardSnapshot, getBoardCards
    ├── move.ts                           # moveWorkItem dispatcher + error → refusal mapping
    ├── groupMove.ts                      # moveOrderGroup
    ├── config.ts                         # YAML load + Zod (station targets)
    ├── messages.ts                       # MoveRefusalCode → Arabic
    └── live/
        ├── hub.ts                        # BoardLiveHub (pg LISTEN singleton, fan-out, status)
        └── payload.ts                    # Zod schema for NOTIFY payload

src/app/
├── page.tsx                              # redirect → /board
├── api/board/stream/route.ts             # SSE endpoint
└── (shell)/
    ├── layout.tsx                        # sidebar → IconRail + CommandBar; one ambient layer
    └── board/
        ├── page.tsx                      # RSC: getBoardSnapshot → <BoardProvider>
        └── actions.ts                    # "use server" thin wrappers

src/lib/board/                            # NEW client engine, OOP, no React imports
├── ports.ts                              # MoveGateway, SnapshotGateway, LiveSource, MotionPort, FeedbackPort, Clock
├── BoardController.ts                    # Mediator
├── createBoardController.ts              # composition root (the only place adapters are constructed)
├── store/BoardStore.ts                   # Observer store (topics)
├── commands/{BoardCommand,MoveCommand,GroupMoveCommand}.ts
├── policies/{DropPolicy,DirectDropPolicy,SheetDropPolicy,ScreenDropPolicy,DropPolicyResolver}.ts
├── drag/DragSession.ts                   # state machine; dnd-kit adapter lives in components
├── live/{LiveChannel,EventSourceLiveSource}.ts
├── motion/
│   ├── MotionDirector.ts                 # WAAPI, FLIP, reduced-motion swap
│   ├── ChoreographyRegistry.ts
│   ├── tokens.ts                         # reads --motion-* from CSS
│   └── choreographies/{Lift,Travel,Stamp,FlyBack,ReworkArc,RollOut,Land,Instant}.ts
├── feedback/{FeedbackCenter,ToastChannel,AnnouncerChannel,messages.ar}.ts
├── sheets/SheetRegistry.ts
├── commandBar/{CommandBarRegistry,sources/*}.ts
└── prefs/BoardViewPrefs.ts               # localStorage (try/catch), per device

src/components/
├── board/
│   ├── BoardProvider.tsx  Board.tsx  StationColumn.tsx  SubLane.tsx  JobTicket.tsx
│   ├── OrderTag.tsx  MoveToMenu.tsx  LiveIndicator.tsx  GroupResultSheet.tsx  SliceSwitcher.tsx
│   ├── dnd/DndBridge.tsx                 # dnd-kit ↔ DragSession adapter
│   ├── hooks/{useBoardSelector,useBoardController}.ts
│   └── sheets/{AssignDesigner,RejectDesign,SendBack,CompleteProduction,RouteDepartment,Cancel,Receive,Handover}Sheet.tsx
└── shell/{IconRail,CommandBar}.tsx       # replace (shell)/_components/sidebar-nav.tsx usage

src/styles/
├── ink.css                               # NEW token layers + motion tokens
└── globals.css                           # apple-* removed; imports ink.css

scripts/seed-board-demo.mjs               # dev-only demo floor (quickstart §2)

tests/
├── unit/board/        # stations, store, commands, policies, LiveChannel, DragSession, slices, ink-contrast, projection
├── contract/board/    # edge-catalog × roles (SC-003), audit parity (SC-006), sendToProduction, permissions matrix
├── integration/board/ # snapshot visibility, NOTIFY commit/rollback, hub filter/reconnect, group move
├── components/board/  # JobTicket, MoveToMenu, sheets, StationColumn states (jsdom)
└── performance/board-snapshot.test.ts
```

**Structure Decision**: Keep the existing monolith layout. Server logic goes in a new
`src/server/board` module (the same module-boundary rules as other `src/server/*` modules; it
imports other modules only through their barrels). The client engine goes in `src/lib/board`,
separate from `src/components/board`, which enforces "engine has no React". An ESLint
`no-restricted-imports` rule forbids `react`/`next` imports under `src/lib/board/**`, and
`src/server/**` imports from `src/components/**`.

## Engineering Standards (binding for every task and review)

The owner's bar: a principal engineer should read this code and call it world-class. The standards
below are measurable, and most are lint-enforced, so they hold without relying on anyone's memory.

### S1. One file, one responsibility

| Rule | Limit | Enforced by |
|---|---|---|
| One exported class, component, or cohesive function group per file | 1 primary export | review |
| File length (in `src/lib/board`, `src/server/board`, `src/components/board`, `src/components/shell`) | ≤ 150 lines (≤ 200 for React components with markup) | ESLint `max-lines` (skip blank/comments) |
| Function / method length | ≤ 40 lines | ESLint `max-lines-per-function` |
| Cyclomatic complexity | ≤ 8 | ESLint `complexity` |
| Parameters | ≤ 3 (use an options object beyond that) | ESLint `max-params` |
| Nesting depth | ≤ 3 | ESLint `max-depth` |

A file that grows past its limit gets split along its responsibilities, never by raising the limit.
File names match their primary export (`MoveCommand.ts` exports `MoveCommand`).

### S2. SOLID, concretely

- **S (single responsibility)**: one reason to change per class. `BoardStore` holds state, it
  doesn't fetch; `MoveCommand` orchestrates, it doesn't animate; `WaapiMotionDirector` animates, it
  doesn't decide.
- **O (open/closed)**: new animations, alerts, sheets, ⌘K sources and edges are added by *registering
  a new class* (`ChoreographyRegistry`, `FeedbackCenter` channels, `SheetRegistry`,
  `CommandBarRegistry`, server `EdgeCatalog`). Adding one never edits a `switch` in existing code, and
  review rejects any new `switch` or if-chain on a kind or edge.
- **L (Liskov substitution)**: every `DropPolicy`, `Choreography`, `EdgeHandler`, `CommandSource` and
  port adapter is substitutable. Its fake passes the same contract test suite as the real one.
- **I (interface segregation)**: small ports (`MotionPort`, `FeedbackPort`, `Clock`, …). No class
  depends on a method it doesn't use.
- **D (dependency inversion)**: engine classes receive ports through their constructors. Only one
  composition root, `src/lib/board/createBoardController.ts`, instantiates concrete adapters, and no
  engine class does `new` on an adapter.

### S3. Patterns (each one has a single, named home)

| Pattern | Where | Why it earns its place |
|---|---|---|
| Mediator | `BoardController` | React talks to one object, never to stores or gateways |
| Observer | `BoardStore` topics, `FeedbackCenter` channels | fine-grained re-render; alerts fan out |
| Command | `MoveCommand`, `GroupMoveCommand` | optimistic apply, commit, rollback and superseded as one unit |
| Strategy | `DropPolicy` family + `DropPolicyResolver` | direct, sheet or screen without conditionals |
| State | `DragSession`, `LiveChannel` | explicit transition tables, unit-tested |
| Registry / Plugin | choreographies, sheets, ⌘K sources, feedback channels, server edges | puzzle-piece extension (S2-O) |
| Adapter / Ports & Adapters | `ServerAction*Gateway`, `EventSourceLiveSource`, `WaapiMotionDirector`, `DndBridge` | swap infrastructure without touching the engine |
| Factory (composition root) | `createBoardController` | one place wires the object graph |
| Singleton (process scope) | `BoardLiveHub` | one `LISTEN` connection per server |

No pattern is added outside this table without a line in Complexity Tracking.

### S4. Paradigm boundaries (OOP where it pays)

- **Classes**: the engine (`src/lib/board`), server registries and handlers (`EdgeCatalog`,
  `EdgeHandler`s, `BoardLiveHub`). These are the parts with state, lifecycle and polymorphism.
- **Pure functions**: projections, mappers, selectors, validators (`projection.ts`, `stations.ts`,
  `slices.ts`), which are easiest to test and fastest to run.
- **Function components + hooks**: all React. Class components are legacy in React 19. Components
  hold **no business logic**: they read through `useBoardSelector` and call `BoardController`
  methods.
- Private state uses `#private` fields. Public surfaces are `readonly` where possible. There are no
  `any` types, and `unknown` is narrowed with Zod at boundaries.
- Import boundaries (ESLint `no-restricted-imports`): `src/lib/board/**` can't import `react`,
  `next/*`, `src/components/**` or `src/server/**`; `src/components/**` can't import
  `src/server/**` except types; and each module is imported only through its barrel.

### S5. Performance rules (the better-performing option wins)

- Prefer platform APIs over dependencies: WAAPI, CSS `linear()`, `EventSource`,
  `useSyncExternalStore`, `structuredClone`, `AbortController`. Any new dependency needs a
  Complexity Tracking row.
- Rendering: topic-scoped subscriptions, so a move re-renders only the two affected lanes and
  one ticket. Stable selector results. `React.memo` on `JobTicket`. No context value changes on
  every move.
- Data: a normalized `Map<id, BoardCard>` plus sorted id arrays per lane. Lane insert uses binary
  search (O(log n)), not a re-sort. Store writes within a frame are batched with
  `requestAnimationFrame`.
- Animation: transform and opacity only. Every layout read (FLIP "first") happens before any
  write. Nothing runs while idle, and all animations are cancelled on dispose.
- Network: server snapshot ≤ 4 queries; SSE payloads carry ids and deltas, not full cards.
  `AbortController` on every cancellable fetch.
- Bundles: the board route imports sheets with `next/dynamic` (loaded on first open); the engine
  has no side effects on import, so it tree-shakes.
- Lists: virtualize lanes over 40 cards (`@tanstack/react-virtual`).

### S6. Enforcement

A Foundational task adds the S1 and S4 ESLint rules, scoped to the 017 directories so legacy code
isn't mass-flagged, plus a CI grep that no `apple-` identifiers remain (ink-tokens contract).
`pnpm check` must stay green. A review checklist item per S-rule is used in every Gemini diff review.

## Delivery slices (for `/speckit-tasks`)

Ordered so each slice is shippable and testable. It matches the user-story priorities, and the
go-live gate needs all of them.

1. **Foundations**: permission + migration + trigger, `stations.ts`, `config.ts`, `visibility.ts`,
   `slices.ts`, ink tokens (without removing `apple-*` yet), and the `src/lib/board` skeleton with
   ports and fakes.
2. **US1 read-only board (MVP)**: projection/snapshot, `BoardStore`, `Board`/`StationColumn`/
   `SubLane`/`JobTicket`/`OrderTag`, `/` → `/board`, archive filter.
3. **US2 drag moves**: `EdgeCatalog` + edge handlers (non-015), `moveWorkItem`, `sendToProduction`,
   `MoveCommand`, `DirectDropPolicy`, `DragSession` + dnd-kit bridge, Lift/Travel/Stamp/FlyBack,
   toasts.
4. **US3 sheets**: `SheetRegistry`, `SheetDropPolicy`, all sheets except 015's, `ScreenDropPolicy`
   (pricing), ReworkArc.
5. **US4 live**: hub, SSE route, `LiveChannel`, reconciliation, `LiveIndicator`, health check.
6. **US7 keyboard/accessibility**: `MoveToMenu`, announcer, focus management, reduced-motion swap.
   (It is P2, but slotted before US5/US6 because it is also the phone path.)
7. **US5 group moves**: `moveOrderGroup`, `GroupMoveCommand`, `GroupResultSheet`.
8. **US6 slices**: `SliceSwitcher`, `BoardViewPrefs`, precedence.
9. **015 edges**: Receive/Handover handlers + sheets. Blocked by 015 merge.
10. **US8 ink + shell**: full `apple-*` removal, `IconRail`, `CommandBar` + sources, RollOut/Land,
    detail-page station ink, page-navigation view transitions (feature-detected).
11. **Polish**: performance budget test, idle check, quickstart walkthrough, `/code-review`,
    Fady's gate-critical review.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| PRI-66 not merged: Review and Pricing never empty | Hard dependency on PRI-65; the quickstart states it; the board still shows the true state. |
| 015 lands late | Collection/Delivered view-only through `UNAVAILABLE` handlers; slice 9 isolated. |
| FLIP + virtualization jank | Animate only in-viewport tickets; `DragOverlay` keeps the source in layout; rAF-batched store writes. |
| NOTIFY listener dies silently | Backoff reconnect + `resync` broadcast + `/admin/health` check + stale detection on the client (45 s). |
| Visibility drift from existing queues | A table-driven test compares `canSeeWorkItem` against the designer and operator queue queries. |
| Engine over-abstraction | Every class maps to a contract in `board-engine.md` with a test. No speculative interfaces beyond the listed ports. |

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| `pg` dependency (a second DB client) | Prisma cannot hold a `LISTEN` connection; commit-safe live updates from every writer (R4) | Polling misses concurrently committed rows; an in-process emitter needs edits to every domain action and cannot see commit. |
| `@dnd-kit/core` dependency | Touch press-and-hold, pointer, a11y announcements, collision, auto-scroll (FR-035, US7) | Native HTML drag and drop has no iOS touch support; a hand-rolled implementation is a11y-risky for a go-live gate. |
| OOP engine layer (`src/lib/board`) with ports and registries | The owner explicitly wants modular, extensible animation/alert/move additions; the engine has real state and lifecycle | An all-hooks design scatters logic across effects and has no single extension point; class components are legacy in React 19. |
| New domain action + permission (FR-015a) | The `NEW → READY_FOR_PRODUCTION` edge exists but nothing performs it; no-design jobs are stranded | Leaving it out means the board shows jobs that can never move. |
