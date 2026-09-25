# Contract: Real-Time Delivery (LAN)

Owner: 053. Public surface: the SSE route under `src/app/api/notifications/stream/` plus the client hook in
`src/components/notifications/`. Server Actions and route handlers in the same feature own the fallback.

The requirement is **delivery, not transport**. A notification is persisted server-side the moment it is
created; the live channel only signals "your data changed — re-read it". That is what makes the fallback
path correct by construction rather than a degraded twin (research.md §2, spec FR-034).

## Transport decision: Server-Sent Events

Server-Sent Events over plain HTTP, not WebSockets. The connection is one-directional (server → client),
which is exactly the shape of the requirement, and SSE reconnects on its own, carries a plain-text body over
ordinary HTTP, and needs no additional library, protocol, or proxy configuration on a shop LAN.

## `GET /api/notifications/stream`

```ts
// Authenticated as the signed-in user. No permission key.
function stream(request: Request, signal: AbortSignal): Promise<Response>
// 200, Content-Type: text/event-stream
// Cache-Control: no-cache, no-transform
// Connection: keep-alive
// X-Accel-Buffering: no   (harmless on a direct LAN; defeats a buffering reverse proxy)
```

Behavior:
1. `getActor()` — unauthenticated → `UNAUTHENTICATED` (401). A session that expires mid-stream → the
   stream is closed by the server (FR-032).
2. Send an initial `ready` event so the client knows the channel is live, then `retry: <ms>` so the browser
   uses the server's chosen reconnect interval rather than its default.
3. On each new notification for this user, send one event:
   ```text
   event: notification
   data: {"id":"...","type":"workitem.rejected","severity":"ACTION"}
   ```
   The payload carries identifiers and severity only — **not** title, body, or link. The client re-reads
   through `notificationCenter.list`/`unreadCount`, so the read path stays the single authority for content
   and scope (FR-010, constitution V). A title sent over the stream could leak a Work Item the recipient is
   no longer permitted to view; a type string cannot.
4. Send a `ping` comment every 25 seconds. Its only job is to keep intermediaries from reaping an idle
   connection.
5. Send a `count` event carrying the new unread total, so the bell updates without the client computing it.
6. On `signal` abort (client disconnect), unregister the connection and release its resources (FR-033).
7. Errors: `UNAUTHENTICATED` on connect. Once streaming, a mid-stream failure closes the connection; the
   client falls back to polling automatically.

## Connection registry

One in-process registry mapping user id → set of live connections. A user may hold several (multiple tabs);
each is an independent entry. Requirements:

- **Bounded per connection.** At most one concurrent write in flight per connection; if the socket's buffer
  is full, the notification is dropped from the *stream* and the client's next poll or reconnect picks it up.
  Delivery is never lost because a stream was congested — only its immediacy is (FR-033, FR-034).
- **Reclaim dead connections.** A connection that errors, aborts, or fails its ping write is removed within
  one tick. A machine that slept does not hold a registry entry forever.
- **Bounded total.** A configurable cap on concurrent connections; beyond it, new connections are refused
  with `503` and the client falls back to polling. A shop has tens of users, so the cap is set well above
  expected peak (multiple tabs per user) and exists only as a runaway guard.
- **No cross-user delivery.** `publish(userId, notification)` writes only to that user's connections
  (FR-032). The registry is keyed by user id and the publish path takes the id from the notification's own
  `userId` — never from a client-supplied value.
- **Multi-process note.** The registry is in-process, so with more than one Next.js instance a notification
  created on instance A reaches only A's connections. Clients on B are not signalled — but they are not
  *wrong*, because the fallback poll finds the notification. The single-server topology (PRD §52) makes this
  moot in V1; the fallback is what keeps it correct if that ever changes.

## Client contract

```ts
// src/components/notifications/use-notification-stream.ts
function useNotificationStream(opts: {
  onNotification: () => void;   // re-read list + count through the server
  onCountChange?: (count: number) => void;
}): { connected: boolean; transport: "live" | "polling" };
```

Behavior:
1. On mount, open the stream. While it is open, `transport` is `"live"`.
2. On any stream error, close, or `transport` change to a browser that does not support SSE, switch to
   `transport: "polling"` and poll `notificationCenter.unreadCount` every **15 seconds** (FR-029, FR-030).
3. Poll interval is a constant, not configuration — a shop LAN does not need it tuned, and one more knob is
   one more thing to get wrong.
4. On the browser tab becoming visible again, re-read immediately regardless of transport, so a laptop
   waking from sleep shows current data without waiting for the next poll.
5. `connected` is display-only — the UI shows which path is active (FR-030) and nothing more. A user on the
   fallback path is fully functional; the indicator is not a warning state.
6. Cleanup on unmount closes the stream and stops polling.

## Why the fallback must exist even when SSE works

The browser is not the only client, and the shop's machines are not new: a locked-down terminal, an old
browser, or a proxy that buffers `text/event-stream` will all silently break a live channel. Because
delivery is persisted and the stream only signals invalidation, the fallback is a **complete** delivery
path — it differs in latency, never in content. This is why the spec's "no notification is lost because the
user was offline" criterion (SC-009) holds for a user who never once had a working stream (FR-034).

## Guarantees

- No outbound network I/O, no third-party push provider, no internet dependency (FR-031, constitution VII,
  PRD §52). The stream is served by the same local server as the app.
- The stream is a hint channel. A correct client with a permanently broken stream still receives every
  notification, only less promptly.
- The stream never carries notification content, only identifiers and severity.
- The stream never carries one user's notifications to another, and is closed when the session ends.
