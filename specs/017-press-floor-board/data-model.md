# Phase 1 Data Model: Press Floor Board

**Feature**: `017-press-floor-board` · **Date**: 2026-09-26

017 adds **no new tables and no new workflow states or edges**. It adds:

- one permission key,
- one Postgres trigger (live updates),
- one YAML config file,
- read models (DTOs) derived from existing tables,
- the client engine's object model.

---

## 1. Persistent changes

### 1.1 Permission (FR-015a, research R12)

| Change | Detail |
|---|---|
| `Permission` union + `ALL_PERMISSIONS` | add `"workitem.send_to_production"` |
| Seed (`prisma/seed.ts`) | granted to `RECEPTION` and `ADMIN_OWNER` |
| Data migration | idempotent grant of the key to those two roles on existing installs |
| Audit action | `workitem.sent_to_production` (after: `{ from: "NEW", to: "READY_FOR_PRODUCTION" }`) |

### 1.2 Trigger: `board_transition_notify` (research R4)

Stored under `prisma/manual-sql/board-transition-notify.sql` (precedent:
`audit-event-append-only.sql`) and applied by a migration.

```text
AFTER INSERT ON "WorkItemTransition" FOR EACH ROW
  → pg_notify('board_transition', json_build_object(
        'id', NEW.id, 'workItemId', NEW."workItemId",
        'orderId', (SELECT "orderId" FROM "WorkItem" WHERE id = NEW."workItemId"),
        'from', NEW."from", 'to', NEW."to",
        'actorId', NEW."actorId", 'at', NEW."at")::text)
```

- Delivered by Postgres only when the inserting transaction **commits**.
- The payload is ids and states only (≈200 bytes, far under the 8000-byte NOTIFY limit).
- A chained action (two transitions in one transaction) produces two notifications at commit, in
  insert order. The client collapses them (FR-024 "travel once", §3.3).

### 1.3 Config: `config/017-board.yaml` (research R10)

```yaml
# Minutes a Work Item may spend at a station before it counts as overdue.
stationTargets:
  reception:  { normal: 30,   urgent: 10 }
  design:     { normal: 1440, urgent: 240 }
  review:     { normal: 240,  urgent: 60 }
  pricing:    { normal: 240,  urgent: 60 }
  production: { normal: 2880, urgent: 480 }
  collection: { normal: 1440, urgent: 240 }
  delivered:  { normal: 0,    urgent: 0 }   # 0 = no target
```

It is validated with Zod at load time (every station present, integers ≥ 0). The path can be
overridden with `BOARD_CONFIG_PATH`, as in `052-finance`. Values are placeholders for the owner
to tune.

---

## 2. Station map (FR-002)

The source of truth is `src/server/board/stations.ts`, a pure module with no I/O, shared with the
client as a plain constant.

```text
StationId = "reception" | "design" | "review" | "pricing" | "production" | "collection" | "delivered"

STATIONS: readonly Station[] (in flow order)
Station {
  id: StationId
  labelAr: string            // "الاستقبال", "التصميم", "المراجعة", "التسعير", "الإنتاج", "التجهيز للتسليم", "تم التسليم"
  ink: InkName               // FR-027 table
  icon: LucideIconName
  lanes: readonly Lane[]
}
Lane { state: WorkItemState; labelAr: string }

STATE_PLACEMENT = {
  NEW: {station:"reception", lane:0}, ASSIGNED: {design,0}, IN_DESIGN: {design,1},
  REWORK_REQUIRED: {design,2}, DESIGN_COMPLETED: {design,3},
  WAITING_REVIEW: {review,0}, APPROVED: {review,1}, WAITING_PRICING: {pricing,0},
  READY_FOR_PRODUCTION: {production,0}, IN_PRODUCTION: {production,1},
  PRODUCTION_COMPLETED: {collection,0}, READY_FOR_COLLECTION: {collection,1},
  DELIVERED: {delivered,0}, COMPLETED: OFF_BOARD, CANCELLED: OFF_BOARD,
} satisfies Record<WorkItemState, Placement>
```

`satisfies Record<WorkItemState, …>` makes a new state without a placement a **compile error**
(FR-002, "fail the build"). A unit test also asserts that every state appears exactly once and
every lane maps back to its state.

`InkName = "cyan" | "magenta" | "violet" | "yellow" | "key" | "orange" | "green"`, plus the
non-station signal ink `"red"` (FR-027a). `STATION_INK` is derived from `STATIONS`.

---

## 3. Read models (DTOs)

These are serializable (server action ↔ client) and validated with Zod at the action boundary.
Dates travel as ISO strings.

### 3.1 `BoardCard` (FR-003–FR-008)

| Field | Type | Source |
|---|---|---|
| `id` | string | `WorkItem.id` |
| `orderId`, `orderNumber` | string, number | `Order` |
| `orderTagHue` | 0–359 | derived from `orderId` hash, for the order tag chip only (never a station ink) |
| `customerName` | string | `Customer.name` (or the Cash Customer label) |
| `title` | string | `WorkItem.description` ?? product type name |
| `quantity` | number \| null | `WorkItem.quantity` |
| `state` | WorkItemState | `WorkItem.state` |
| `priority` | `"URGENT" \| "NORMAL"` | `Order.priority` |
| `pricing` | `"PENDING" \| "PRICED" \| "DISPUTED" \| "NOT_REQUIRED"` | `PricingStatus.status`, or `NOT_REQUIRED` when no row exists |
| `enteredStationAt` | ISO | the earliest `WorkItemTransition.at` of the current consecutive run of states within the same station |
| `targetMinutes` | number \| null | config §1.3 × priority |
| `dueAt` | ISO \| null | `WorkItem.dueDate ?? Order.dueDate` |
| `reworkCount` | number | count of transitions to `REWORK_REQUIRED` |
| `assignee` | `{ id, name } \| null` | `WorkItem.assignee` |
| `departmentId` | string \| null | `effectiveDepartmentId` |
| `moves` | `MoveOption[]` | server precheck (§3.2) |
| `lastTransitionId` | string \| null | the latest `WorkItemTransition.id`, used for reconciliation |
| `lastTransitionAt` | ISO | same row's `at` |

Derived on the client (never sent): `elapsedRatio`, `isOverdue` (`now > dueAt` or elapsed >
target), and sort keys.

### 3.2 `MoveOption` (research R2, R3)

| Field | Type | Notes |
|---|---|---|
| `edgeId` | `${from}->${to}` | stable key |
| `to` | WorkItemState | |
| `kind` | `"DIRECT" \| "SHEET" \| "SCREEN"` | `SYSTEM` edges are never sent |
| `sheet` | `SheetId \| null` | e.g. `"reject-design"`, `"assign-designer"`, `"complete-production"`, `"send-back"`, `"cancel"`, `"route-department"`, `"handover"`, `"receive"` |
| `screenHref` | string \| null | for `SCREEN` |
| `backward` | boolean | true for moves into `REWORK_REQUIRED`, and for `ASSIGNED` reached from rework (FR-018, rework arc) |
| `destructive` | boolean | true for `CANCELLED` |
| `groupable` | boolean | whether this edge may be part of a group move |
| `labelAr` | string | "إرسال للإنتاج", "رفض التصميم", … |

Absent from the list means the move is not offered. The client *also* derives the reason a column
is dimmed from `blockedHints: { station: StationId; reasonAr: string }[]` (e.g. Delivered: "يجب
حسم التسعير أولاً", FR-017, US2-6), so dimmed columns can explain themselves.

### 3.3 `BoardUpdate` (live event, FR-024)

```text
BoardUpdate {
  transitionId: string; workItemId: string; orderId: string;
  from: WorkItemState; to: WorkItemState;
  actor: { id: string; name: string };   // name resolved by the hub (cached user lookup)
  at: ISO
}
```

Client reconciliation rules (`BoardStore.applyUpdate`):

1. If `transitionId` equals the card's `lastTransitionId`, or `at <= lastTransitionAt`, ignore it
   (already applied, e.g. by the user's own command).
2. If a pending optimistic move exists for this card:
   - an update matching the pending target confirms it;
   - an update with a different target means someone else won. The command is cancelled and
     FR-026 feedback is shown ("نقلها <name>").
3. Updates for the same `workItemId` that arrive within one animation frame are **coalesced**: the
   last `to` wins, and one travel animation plays (chained moves, spec Edge Cases).
4. After applying, the controller calls `getBoardCards([id])` to refresh `moves`, pricing and
   timing. If the card is no longer visible (the server returns nothing), it is removed with the
   Land/Roll-out choreography in reverse.

### 3.4 `MoveRequest` / `MoveResult`

```text
MoveRequest {
  workItemId: string
  edgeId: string                 // must match a server-offered MoveOption
  input?: SheetInput             // discriminated union by sheet id, Zod-validated
  clientMoveId: string           // uuid, for log correlation and idempotency within 60 s
}

MoveResult =
  | { ok: true;  card: BoardCard; transitionIds: string[] }
  | { ok: false; code: MoveRefusalCode; messageAr: string; card?: BoardCard }

MoveRefusalCode =
  "NOT_OFFERED" | "FORBIDDEN" | "STALE_STATE" | "GUARD_FAILED" | "VALIDATION" |
  "DEPENDENCY_UNAVAILABLE" | "INTERNAL"
```

`STALE_STATE` includes the fresh `card`, so the client moves it to its true position (edge case
"state changed while a sheet is open").

### 3.5 `GroupMoveResult` (FR-019)

```text
GroupMoveResult {
  orderId: string; to: WorkItemState;
  items: Array<
    | { workItemId; status: "MOVED"; card: BoardCard }
    | { workItemId; status: "REFUSED"; code: MoveRefusalCode; messageAr: string }
    | { workItemId; status: "NOT_ELIGIBLE"; reasonAr: string }   // no offered edge, cancelled, hidden
  >
}
```

Each `MOVED` item ran in its **own** transaction through the same dispatcher as a single move.
Hidden siblings are reported only as a count, never by id (FR-004).

### 3.6 `BoardSnapshot`

```text
BoardSnapshot {
  generatedAt: ISO
  cards: BoardCard[]            // visible, non-terminal (plus terminal when archive = true)
  hiddenSiblingCounts: Record<orderId, number>
  slice: SliceId                // resolved default or requested
  availableSlices: SliceId[]    // from the actor's roles (FR-021 table)
  blockedHints: ...             // see §3.2
}
```

### 3.7 `BoardView` (FR-023, per device)

This is kept in `localStorage` under `printex.board.view.v1`, with every read and write wrapped in
try/catch. It is never authoritative, and the server re-applies visibility.

```text
BoardView { slice: SliceId; filters: { stations?: StationId[]; departmentIds?: string[];
  designerIds?: string[]; urgentOnly?: boolean; overdueOnly?: boolean;
  pricing?: ("PENDING"|"PRICED"|"DISPUTED")[]; customerQuery?: string; archive?: boolean } }
```

`SliceId = "reception" | "designer" | "head-designer" | "production" | "delivery" | "accounting" | "floor"`.
Precedence for multi-role users follows spec FR-021.

---

## 4. Client object model (research R1)

Engine classes live in `src/lib/board/` and never import React. Arrows mean "depends on the
interface".

```text
BoardController (Mediator)
 ├─→ BoardStore               Observer; normalized cards + lanes; topics lane:<state>, card:<id>, meta
 ├─→ MoveGateway  «port»      moveWorkItem / moveOrderGroup / getBoardCards  (impl: ServerActionMoveGateway)
 ├─→ SnapshotGateway «port»   getBoardSnapshot                               (impl: ServerActionSnapshotGateway)
 ├─→ LiveSource   «port»      subscribe(onUpdate, onStatus)                   (impl: EventSourceLiveSource → LiveChannel)
 ├─→ DropPolicyResolver       MoveOption.kind → DropPolicy (Strategy)
 │     ├─ DirectDropPolicy    → new MoveCommand(...).execute()
 │     ├─ SheetDropPolicy     → SheetRegistry.open(sheetId) → on confirm → MoveCommand
 │     └─ ScreenDropPolicy    → router.push(screenHref); the card stays (FR-016)
 ├─→ MotionPort «port»        (impl: MotionDirector → ChoreographyRegistry)
 └─→ FeedbackPort «port»      (impl: FeedbackCenter → ToastChannel, AnnouncerChannel)

MoveCommand (Command)
  state: created → applied(optimistic) → committed | rolledBack | superseded
  execute(): store.applyOptimistic → motion.play("stamp"|"travel"|"rework-arc")
             → gateway.move → store.commit(card) | store.rollback + motion.play("fly-back")
             → feedback.notify(...)
GroupMoveCommand (Command)
  composes one server call (moveOrderGroup) → per item: commit/rollback → GroupResultSheet

DragSession (State machine; wraps @dnd-kit)
  idle → lifting → dragging(activeCard, offeredTargets) → dropping → settling → idle
  cancel() from any state → settling (fly-back)

LiveChannel (State machine)
  connecting → open ⇄ stale(heartbeat missed > 45 s) → resyncing → open;  closed on unmount

MotionDirector
  play(kind, target, opts): Promise<void>   // cancels running animation on the same element
  choreographies: Lift, Travel, Stamp, FlyBack, ReworkArc, RollOut, Land, Instant (reduced motion)

FeedbackCenter (Observer)
  notify(FeedbackEvent) → channels subscribed by kind
  FeedbackEvent = MoveCommitted | MoveRefused | MovedByOther | LiveStatusChanged | GroupMoveDone
  channels: ToastChannel (Base UI Toast), AnnouncerChannel (aria-live polite, Arabic),
            DragAnnouncementsChannel (@dnd-kit announcements)
```

**Extension points (open/closed)**: a new animation is a new `Choreography` plus `register(kind, …)`;
a new message or alert is a new `FeedbackEvent` variant plus a channel (or a formatter on an
existing channel); a new sheet is a new sheet component plus `SheetRegistry.register(sheetId, …)`;
a new ⌘K source is a new `CommandSource` plus `CommandBarRegistry.register`.

---

## 5. Validation rules summary

| Rule | Where enforced | Spec |
|---|---|---|
| Every state has exactly one placement | `satisfies` + unit test | FR-002 |
| Every `ALLOWED_EDGES` edge classified | EdgeCatalog contract test | FR-011, R3 |
| Move only if offered **and** server re-checks | dispatcher (`NOT_OFFERED`) + domain action | FR-011, FR-012 |
| `sendToProduction` only if `requiresDesign = false` | domain action | FR-015a |
| Sheet inputs | Zod per `SheetId`, client and server | FR-015 |
| Delivered refused while pricing unresolved | precheck hint + 015/051 guard | FR-017 |
| Live events filtered by visibility | hub filter with `canSeeWorkItem` | FR-022, US4-3 |
| Group: per-item transaction, no cross-item rollback | group dispatcher | FR-019 |
