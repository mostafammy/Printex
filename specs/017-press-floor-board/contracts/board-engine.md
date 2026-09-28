# Contract: Client board engine (`src/lib/board/`) and React surface (`src/components/board/`)

This is the public surface other developers (and future features) code against. The engine
imports no React, Next.js or DOM globals except through the ports below. The React layer imports
the engine, never the reverse.

## Ports (dependency inversion)

```ts
interface MoveGateway {
  move(req: MoveRequest): Promise<MoveResult>;
  moveGroup(req: GroupMoveRequest): Promise<GroupMoveResult>;
  cards(ids: string[]): Promise<BoardCard[]>;
}
interface SnapshotGateway { snapshot(req: SnapshotRequest): Promise<BoardSnapshot>; }
interface LiveSource {
  subscribe(onUpdate: (u: BoardUpdate) => void, onStatus: (s: LiveStatus) => void,
            onResync: () => void): () => void;
}
interface MotionPort {
  play(kind: ChoreographyKind, ctx: MotionContext): Promise<void>;   // resolves when settled
  measure(cardId: string): DOMRectReadOnly | null;                   // FLIP "first"
}
interface FeedbackPort { notify(event: FeedbackEvent): void; }
interface Clock { now(): number; }                                   // tests use a fake
```

Production adapters: `ServerActionMoveGateway`, `ServerActionSnapshotGateway`,
`EventSourceLiveSource`, `WaapiMotionDirector`, `FeedbackCenter`, `SystemClock`.
Test adapters: `Fake*` in `tests/unit/board/fakes.ts`.

## `BoardStore`

```ts
class BoardStore {
  constructor(snapshot: BoardSnapshot, clock: Clock)
  // reads (stable references between changes → safe for useSyncExternalStore)
  getCard(id): BoardCard | undefined
  getLane(state): readonly string[]            // sorted per FR-005
  getMeta(): BoardMeta                          // counts, live status, slice, filters
  subscribe(topic: Topic, listener: () => void): () => void   // "lane:<state>" | "card:<id>" | "meta"
  // writes (called by commands/controller only)
  applyOptimistic(cardId, to, token): void
  commit(token, card: BoardCard): void
  rollback(token): void
  applyUpdate(u: BoardUpdate): ApplyOutcome     // data-model §3.3 rules
  replace(snapshot: BoardSnapshot): Diff        // resync; Diff drives Travel/Land/RollOut
  upsert(cards: BoardCard[]): void
  remove(ids: string[]): void
}
```

Invariants (unit tested):

- a card is in exactly one lane;
- lanes stay sorted;
- `rollback` restores the exact previous lane and index;
- no listener fires for a topic whose data did not change;
- batched writes within one frame notify once.

## Commands

```ts
abstract class BoardCommand {
  abstract execute(): Promise<CommandOutcome>;
  cancel(reason: CancelReason): void;           // e.g. superseded by a live update
  readonly state: "created" | "applied" | "committed" | "rolledBack" | "superseded";
}
class MoveCommand extends BoardCommand { constructor(deps, card, option: MoveOption, input?) }
class GroupMoveCommand extends BoardCommand { constructor(deps, orderId, to, input?) }
```

`MoveCommand.execute()` sequence (the only allowed order):

1. `from = motion.measure(card.id)`
2. `store.applyOptimistic(...)` (the card is now in the target lane, flagged `pending`)
3. `motion.play(option.backward ? "rework-arc" : "travel", { from })` in parallel with
   `gateway.move(...)`
4. On success: `store.commit`, then `motion.play("stamp")`, then `feedback.notify(MoveCommitted)`
5. On refusal: `store.rollback`, then `motion.play("fly-back")`, then
   `feedback.notify(MoveRefused{messageAr})`. If the code is `STALE_STATE`, `store.upsert(card)`
   comes first.
6. If superseded by a live update: no rollback animation beyond `travel` to the true position,
   then `feedback.notify(MovedByOther)`.

## Drop policies (Strategy)

```ts
interface DropPolicy { onDrop(ctx: DropContext): Promise<void>; }
// DirectDropPolicy → new MoveCommand(...).execute()
// SheetDropPolicy  → card held "pending-input" → sheets.open(option.sheet, card) → confirm → MoveCommand | cancel → FlyBack
// ScreenDropPolicy → card returns (FlyBack) → router.push(option.screenHref)
class DropPolicyResolver { resolve(option: MoveOption, card: BoardCard): DropPolicy }
```

## Registries (open/closed extension points)

```ts
class ChoreographyRegistry { register(kind: ChoreographyKind, c: Choreography): void }
interface Choreography { run(el: HTMLElement, ctx: MotionContext): Animation[] }   // WAAPI animations
class SheetRegistry { register(id: SheetId, component: SheetComponent, schema: ZodSchema): void }
class CommandBarRegistry { register(source: CommandSource): void }
interface CommandSource { id: string; labelAr: string; search(q: string, signal: AbortSignal): Promise<CommandItem[]> }
```

Adding a feature later:

| To add… | Do this | Touch existing code? |
|---|---|---|
| A new animation moment | a `Choreography` class + `registry.register("confetti-lite", …)` + a `motion.play(...)` call site | only the call site |
| A new alert/message | a `FeedbackEvent` variant + an Arabic formatter in `ToastChannel` | no |
| A new sheet for a new edge | a sheet component + schema + `SheetRegistry.register` (plus a server `EdgeHandler`) | no |
| A new ⌘K source | a `CommandSource` class + `register` | no |

## Motion tokens (`src/styles/ink.css`, read by the choreographies through `getComputedStyle`)

```css
--motion-spring: linear(…);        /* ~380 ms settle, slight overshoot (modern-web-guidance physics-based-easing) */
--motion-bounce: linear(…);        /* stamp */
--motion-duration-travel: 380ms;  --motion-duration-stamp: 220ms;
--motion-duration-flyback: 420ms; --motion-duration-arc: 520ms; --motion-duration-rollout: 480ms;
```

## React surface

| Component | Responsibility | Subscribes to |
|---|---|---|
| `BoardProvider` | builds the controller from the RSC snapshot plus adapters; disposes on unmount | — |
| `Board` | column layout (RTL logical grid), dnd-kit `DndContext`, `DragOverlay` | `meta` |
| `StationColumn` | header (ink, icon, Arabic label, count), lanes, drop target states `idle / offered / dimmed(hint)` | `meta` |
| `SubLane` | virtualized list (`@tanstack/react-virtual`) | `lane:<state>` |
| `JobTicket` | card anatomy (FR-003): perforated edge, registration mark, ink bar, badges; `React.memo` | `card:<id>` |
| `OrderTag` | shared tag, highlight siblings, hidden-count, group-drag handle | `meta` |
| `MoveToMenu` | keyboard/phone move list with the same `moves` (FR-020, FR-035c) | `card:<id>` |
| `sheets/*` | one component per `SheetId`, Base UI `Dialog` anchored next to the card | — |
| `GroupResultSheet` | FR-019 summary | — |
| `LiveIndicator` | offline/updated states | `meta` |
| `shell/IconRail`, `shell/CommandBar` | FR-033 | — |

Hooks: `useBoardSelector(topic, selector)` wraps `useSyncExternalStore`; `useBoardController()`
reads context. No component calls a gateway directly.

Accessibility contract:

- every ticket is a `button`-role element with an Arabic accessible name
  (`"<customer> — <title> — <state>"`);
- the "move to" trigger has the shortcut key `M`, and `Enter` opens the ticket;
- lanes are `list`/`listitem`;
- `AnnouncerChannel` is an `aria-live="polite"` region;
- focus returns to the moved ticket after a commit, or to the origin after a cancel.
