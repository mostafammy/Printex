# Contract: Board server module (`src/server/board/`)

All functions take the `Actor` from `getActor()` and never trust client-supplied identity or
legality. The `"use server"` wrappers live in `src/app/(shell)/board/actions.ts`. They are thin:
parse with Zod → call the module → return a serializable result. Domain errors are **never**
swallowed; they map to `MoveResult` refusals.

## `getBoardSnapshot(actor, request) → BoardSnapshot`

```text
request { slice?: SliceId; filters?: BoardView["filters"] }
```

1. Resolve the slice: the requested one, if it is in the actor's `availableSlices`, otherwise the
   default by precedence (FR-021).
2. Build a Prisma `where` from `canSeeWorkItem` (R6) ∧ the slice ∧ the filters. Terminal states are
   included only when `filters.archive`.
3. Load in **≤ 4 queries**: work items + order + customer + assignee; latest transitions per item
   (window over `WorkItemTransition`); rework counts; pricing statuses. No N+1: SC-005 requires
   500 cards in under 2 s, asserted by `tests/performance/board-snapshot.test.ts` with a budget
   of ≤ 600 ms for the server part.
4. Compute `moves` for each card via `EdgeCatalog.offer(actor, card)` (pure, no DB).
5. Compute `hiddenSiblingCounts` (the count only) and `blockedHints`.

Errors: none except `Unauthenticated` (redirect). An empty board is a valid result.

## `getBoardCards(actor, ids: string[]) → BoardCard[]`

The same projection as the snapshot, for ≤ 50 ids. Ids the actor cannot see are **omitted
silently** (no existence oracle).

## `moveWorkItem(actor, req: MoveRequest) → MoveResult`

1. Load the card; if it is not visible → `NOT_OFFERED` (same response as a missing card).
2. `EdgeCatalog.offer` must contain `req.edgeId`, otherwise → `NOT_OFFERED`. If the card's current
   state ≠ the edge's `from` → `STALE_STATE` with the fresh card.
3. Validate `req.input` with the edge's Zod schema → `VALIDATION`.
4. Call the edge's **existing domain action** (research R3 table) with the mapped input.
5. Map exceptions:

   | Exception | Code |
   |---|---|
   | `ForbiddenError` | `FORBIDDEN` |
   | `Domain*Error` / `WorkItemTransitionError` with `INVALID_TRANSITION` | `STALE_STATE` |
   | a guard failure | `GUARD_FAILED` |
   | `ZodError` | `VALIDATION` |
   | a missing 015 registration | `DEPENDENCY_UNAVAILABLE` |
   | anything else | `INTERNAL` (logged, generic Arabic message) |

   `messageAr` comes from a code → Arabic message table plus the domain error's own message when
   it is user-safe.
6. On success, return the refreshed card and the new transition ids.
7. Log `board.move.accepted|refused` with `{clientMoveId, edgeId, code, ms}` (R14).

Guarantee (FR-013): the only side effects are those of the domain action. The board module
writes no audit events of its own for moves.

## `moveOrderGroup(actor, req) → GroupMoveResult`

```text
req { orderId; to: WorkItemState; input?: SheetInput; clientMoveId }
```

- Loads the order's Work Items visible to the actor. Invisible siblings are neither reported by
  id nor attempted.
- For each item: when an offered edge `state → to` exists and `groupable` is true, run the same
  pipeline as `moveWorkItem` (its own transaction). Otherwise mark it `NOT_ELIGIBLE` with the
  Arabic reason.
- If the edge's catalog entry declares a `groupAction` (e.g. 015's per-Order hand-over), call it
  once for all eligible items instead. Its per-item outcome is still reported.
- Items run **sequentially** in `WorkItem.id` order, so locks are taken in a stable order.
- One item's refusal never rolls back another (FR-019).

## `sendToProduction(actor, workItemId)`: new domain action in `src/server/orders/`

- `authorize(actor, "workitem.send_to_production")`
- In one transaction: load; `requiresDesign` must be `false`, else `DomainOrderError("DESIGN_REQUIRED")`;
  `transitionWorkItem(tx, { to: "READY_FOR_PRODUCTION" })`; then
  `audit.record("workitem.sent_to_production")`.
- It is exported from `~/server/orders` and usable by any screen, not only the board.

## `EdgeCatalog` (`src/server/board/edgeCatalog.ts`)

```text
interface EdgeHandler {
  readonly edgeId: `${WorkItemState}->${WorkItemState}`;
  readonly kind: "DIRECT" | "SHEET" | "SCREEN" | "SYSTEM" | "UNAVAILABLE";
  readonly permission?: Permission;
  readonly departmentScoped?: boolean;
  readonly sheet?: SheetId;
  readonly inputSchema?: ZodSchema;
  readonly backward: boolean; readonly destructive: boolean; readonly groupable: boolean;
  readonly labelAr: string;
  precheck?(actor, card): { ok: true } | { ok: false; hintAr: string };   // pure, no I/O
  needsInput?(card): boolean;                                            // conditional sheet
  screenHref?(card): string;
  execute?(actor, card, input): Promise<void>;                           // calls the domain action
  groupAction?(actor, cards, input): Promise<Map<id, Result>>;
}

class EdgeCatalog {
  register(handler: EdgeHandler): void                 // duplicate edgeId → throws at boot
  offer(actor, card): MoveOption[]                     // pure
  get(edgeId): EdgeHandler | undefined
}
```

Contract test (`tests/contract/board/edge-catalog.test.ts`):

- every edge in `ALLOWED_EDGES` has exactly one handler (SYSTEM/UNAVAILABLE count as registered);
- no handler exists for an edge that is not in `ALLOWED_EDGES`;
- for every (edge × role fixture): offered ⇔ `moveWorkItem` succeeds against a seeded Work Item,
  and not offered ⇒ forced `moveWorkItem` is refused (SC-003);
- for each DIRECT/SHEET edge, the audit events of a board move equal those of a direct domain
  call (SC-006).
