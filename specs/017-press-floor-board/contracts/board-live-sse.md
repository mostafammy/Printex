# Contract: Live board stream

## Endpoint

`GET /api/board/stream` (route handler, `runtime = "nodejs"`, `dynamic = "force-dynamic"`)

| Aspect | Contract |
|---|---|
| Auth | `getActor()`. If unauthenticated → `401` and the stream is not opened. Re-checked every 5 minutes; a revoked session closes the stream. |
| Response headers | `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`, `X-Accel-Buffering: no` |
| First frame | `retry: 3000` then `event: hello` with `data: {"serverTime": ISO}` |
| Heartbeat | the comment `: hb` every 20 s |
| Update | `id: <transitionId>`, `event: transition`, `data: BoardUpdate` (data-model §3.3) |
| Filtering | only if `canSeeWorkItem(actor, workItem)` as of now (the hub caches visibility inputs per Work Item for 5 s) |
| Back-pressure | if a client's buffer exceeds 256 queued events, the server sends `event: resync` and drops the queue |
| Close | on client abort, the handler unsubscribes from the hub (no leaked listeners, asserted by test) |

There is no `Last-Event-ID` replay. A reconnecting client always resyncs by snapshot (FR-025).

## `BoardLiveHub` (`src/server/board/live/hub.ts`)

```text
class BoardLiveHub {
  static instance(): BoardLiveHub            // globalThis singleton
  subscribe(filter: (u) => boolean, send: (u) => void): () => void
  status(): { listening: boolean; subscribers: number; lastEventAt: Date | null }
}
```

- Owns one `pg.Client` on `DATABASE_URL`, runs `LISTEN board_transition`, and reconnects with
  exponential backoff (1 s → 30 s). After each reconnect it emits `resync` to every subscriber,
  because notifications during the outage are lost.
- Parses and validates the payload with Zod. Malformed payloads are logged and dropped.
- Enriches events with `actor.name` through a 60 s LRU cache over `User`.
- `status()` feeds the `/admin/health` check (R14).

## Client `LiveChannel` (`src/lib/board/live/LiveChannel.ts`)

| State | Enter when | Exit |
|---|---|---|
| `connecting` | constructed / `EventSource` error | `hello` → `open` |
| `open` | `hello` received | error → `connecting`; no frame for 45 s → `stale` |
| `stale` | heartbeat missed | frame arrives → `resyncing` |
| `resyncing` | reconnect after a drop, `event: resync`, or `stale` recovered | snapshot applied → `open` |
| `closed` | `dispose()` | — |

`LiveStatusChanged` feedback: `open` hides the offline indicator. `connecting` and `stale` for more
than 3 s show "غير متصل — يتم إعادة الاتصال". `resyncing → open` shows the brief "تم التحديث"
notice (US4-4).

## Tests

- Integration: commit a transition in transaction A → a subscriber receives it. Roll back
  transaction B → nothing is received.
- Integration: two subscribers with different actors → only the permitted one receives the event
  (US4-3).
- Unit: the `LiveChannel` state table, with fake timers and a fake `EventSource`.
- Integration: the listener is killed (`pg_terminate_backend`) → the hub reconnects and emits
  `resync`.
