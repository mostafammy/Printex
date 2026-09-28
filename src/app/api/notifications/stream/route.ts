// SSE endpoint — contracts/notification-stream.md §GET /api/notifications/stream.
//
// Server-Sent Events, not WebSockets: the connection is one-directional
// (server → client), which is exactly the shape of the requirement, and SSE
// needs no extra library, protocol, or proxy configuration on a shop LAN.
//
// THE STREAM IS A HINT CHANNEL, NOT A DELIVERY CHANNEL. Every notification
// was persisted before this route was ever reached; the stream only says
// "your data changed, re-read it". That is what makes the client's polling
// fallback a COMPLETE delivery path rather than a degraded twin — a user who
// never once has a working stream still receives everything, only less
// promptly (FR-034, SC-009).
//
// The payload carries identifiers and severity ONLY — never a title, body, or
// link. A title sent over the stream could leak a Work Item the recipient is
// no longer permitted to view; a type string cannot (FR-010, constitution V).

import { getActor } from "~/server/auth";
import {
  atCapacity,
  getNotificationConfig,
  registerConnection,
  unregisterConnection,
} from "~/server/notifications";

export const dynamic = "force-dynamic";

/** Node.js runtime: streaming and SSE need no Edge-specific configuration. */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  // FR-032: unauthenticated → 401. A stream with no authenticated user has
  // no recipients and would be a hole in the shop's LAN.
  // `getActor()` throws `UnauthenticatedError` for a missing, expired, or
  // deactivated session. It is internal to `~/server/auth` by design, so the
  // check is on the error's stable `name` rather than the class — the class is
  // not part of that module's public surface (src/server/auth/index.ts).
  let userId: string;
  try {
    const actor = await getActor();
    userId = actor.userId;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthenticatedError") {
      return new Response("UNAUTHENTICATED", { status: 401 });
    }
    throw error;
  }

  // A distinct code so the client can tell "at capacity, retry later" from
  // "broken" — the first is expected and transient, the second is not.
  if (atCapacity()) {
    return new Response("STREAM_CAPACITY", { status: 503 });
  }

  const { pingSeconds } = getNotificationConfig().stream;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let connection: ReturnType<typeof registerConnection> | null = null;

  const stream: ReadableStream<Uint8Array> = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The consumer went away between the check and the enqueue. The
          // abort handler does the cleanup; nothing to do here.
        }
      };

      connection = registerConnection(userId, write);

      // `ready` so the client knows the channel is live, then `retry` so the
      // browser uses the server's reconnect interval rather than its own
      // default.
      write(`event: ready\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
      write(`retry: 5000\n\n`);

      // FR-033: a ping whose only job is to keep intermediaries from reaping
      // an idle connection. Not a keep-alive for the client — the client has
      // its own polling fallback if this stops.
      heartbeat = setInterval(() => write(`: ping\n\n`), pingSeconds * 1000);
    },

    cancel() {
      // FR-033: release the registry entry. Without this, a laptop that
      // sleeps holds a slot until the process restarts.
      if (heartbeat) clearInterval(heartbeat);
      if (connection) unregisterConnection(connection);
    },
  });

  // The request's own abort is the reliable disconnect signal for a browser
  // tab closing or navigating away; `cancel` alone is not reliable on Node.
  const onAbort = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (connection) unregisterConnection(connection);
  };
  request.signal.addEventListener("abort", onAbort, { once: true });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Harmless on a direct LAN; defeats a buffering reverse proxy.
      "X-Accel-Buffering": "no",
    },
  });
}
