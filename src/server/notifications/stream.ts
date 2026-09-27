// The in-process connection registry — contracts/notification-stream.md.
//
// A hint channel, not a delivery channel. Every notification is persisted the
// moment it is created; this only says "your data changed, go re-read it".
// That is what makes the polling fallback a COMPLETE delivery path rather than
// a degraded twin (research.md §2, SC-009) — a user who never once has a
// working stream still receives everything, only less promptly.
//
// Three properties are load-bearing:
//   - No cross-user delivery. The registry is keyed by user id and `publish`
//     takes the id from the notification's own `userId`, never from a
//     client-supplied value (FR-032).
//   - A congested connection loses the SIGNAL, never the notification. A full
//     buffer drops the frame; the row is already committed and the client's
//     next poll finds it (FR-033, FR-034).
//   - Bounded. A cap exists so a bug cannot exhaust file descriptors; the shop
//     is tens of users with a few tabs each, so the cap is never the binding
//     constraint in normal operation.

import { getNotificationConfig } from "./config";

export interface StreamSignal {
  readonly id: string;
  readonly type: string;
  readonly severity: "INFO" | "ACTION" | "URGENT";
}

/** The payload shape on the wire. Identifiers and severity ONLY. */
export function serializeSignal(signal: StreamSignal): string {
  // Hand-built rather than `JSON.stringify` of a wider object: this is the
  // wire format, and a title or link added to the signal object must not be
  // able to ride along by accident. A title sent over the stream could leak a
  // Work Item the recipient may no longer view; a type string cannot (FR-010).
  return JSON.stringify({ id: signal.id, type: signal.type, severity: signal.severity });
}

interface Connection {
  readonly userId: string;
  write: (chunk: string) => void;
  /** At most one write in flight; a frame arriving while busy is dropped. */
  inFlight: boolean;
  dead: boolean;
}

const connections = new Set<Connection>();
/** userId → that user's live connections. A user may hold several (tabs). */
const byUser = new Map<string, Set<Connection>>();

function track(connection: Connection): void {
  connections.add(connection);
  let set = byUser.get(connection.userId);
  if (!set) {
    set = new Set();
    byUser.set(connection.userId, set);
  }
  set.add(connection);
}

function untrack(connection: Connection): void {
  connections.delete(connection);
  const set = byUser.get(connection.userId);
  if (set) {
    set.delete(connection);
    if (set.size === 0) byUser.delete(connection.userId);
  }
}

/** Registers a connection. Returns the handle the route closes over. */
export function registerConnection(
  userId: string,
  write: (chunk: string) => void,
): Connection {
  const connection: Connection = { userId, write, inFlight: false, dead: false };
  track(connection);
  return connection;
}

/** Removes a connection. Idempotent — a double close is not an error. */
export function unregisterConnection(connection: Connection): void {
  connection.dead = true;
  untrack(connection);
}

/** True when at capacity; the route answers 503 with `STREAM_CAPACITY`. */
export function atCapacity(): boolean {
  return connections.size >= getNotificationConfig().stream.maxConnections;
}

/** Live connection count, for the Admin screen and tests. */
export function connectionCount(): number {
  return connections.size;
}

/** Live connections for one user, for tests. */
export function connectionsFor(userId: string): number {
  return byUser.get(userId)?.size ?? 0;
}

/**
 * Sends one `notification` event to every live connection of `userId`.
 *
 * Returns the number of connections signalled — a value lower than the
 * user's connection count means some were congested and dropped the signal,
 * which is expected and harmless (the row is persisted either way).
 */
export function publish(userId: string, signal: StreamSignal): number {
  const set = byUser.get(userId);
  if (!set || set.size === 0) return 0;

  const frame = `event: notification\ndata: ${serializeSignal(signal)}\n\n`;
  let delivered = 0;

  for (const connection of [...set]) {
    if (connection.dead) {
      untrack(connection);
      continue;
    }
    // One write in flight per connection. A socket whose buffer is full gets
    // the frame DROPPED rather than queued without bound — a lagging client
    // must not be able to grow the server's heap, and the notification it
    // missed is waiting in the database regardless (FR-033).
    if (connection.inFlight) continue;

    connection.inFlight = true;
    try {
      connection.write(frame);
      delivered += 1;
    } catch {
      // A dead socket throws on write; reclaim it here so a connection whose
      // peer vanished without a clean close does not hold a registry slot
      // until the next tick.
      connection.dead = true;
      untrack(connection);
    } finally {
      connection.inFlight = false;
    }
  }

  return delivered;
}

/** Sends the `count` event so the bell updates without the client counting. */
export function publishCount(userId: string, count: number): void {
  const set = byUser.get(userId);
  if (!set) return;
  const frame = `event: count\ndata: ${JSON.stringify({ count })}\n\n`;
  for (const connection of [...set]) {
    if (connection.dead) {
      untrack(connection);
      continue;
    }
    if (connection.inFlight) continue;
    connection.inFlight = true;
    try {
      connection.write(frame);
    } catch {
      connection.dead = true;
      untrack(connection);
    } finally {
      connection.inFlight = false;
    }
  }
}

/** Test seam: drops every connection without touching any database. */
export function resetRegistry(): void {
  connections.clear();
  byUser.clear();
}
