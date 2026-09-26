// T045 / FR-032: the SSE route's own boundaries.
//
// The registry-level isolation (one user's signal never reaches another's
// connection) is asserted in stream.test.ts. This file covers what only the
// ROUTE can assert: the 401 before any connection exists, the capacity
// refusal, and the disconnect path that must reclaim the registry slot —
// otherwise a machine that sleeps holds a connection entry forever (FR-033).
//
// The route reaches the session through `next/headers` + better-auth, which
// need a running Next.js request scope. Those two modules are mocked; the
// route's own logic — status codes, headers, registration, abort cleanup —
// stays real. Only the cookie lookup is faked, because in a test process
// there is no cookie.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  connectionsFor,
  getNotificationConfig,
  registerConnection,
  resetRegistry,
} from "~/server/notifications";
import { seedNotificationUser } from "../../helpers/notificationSeed";

// Controlled by each test: `null` = no session (401), a value = signed in.
let session: { userId: string; expiresAt: Date } | null = null;

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("~/server/better-auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () =>
        session
          ? { session, user: { id: session.userId } }
          : null,
      ),
    },
  },
}));

const { GET } = await import("~/app/api/notifications/stream/route");

afterAll(async () => {
  await testDb.$disconnect();
});

afterEach(() => {
  resetRegistry();
  session = null;
});

let alice: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  alice = await seedNotificationUser({ prefix: "stream-route" });
});

function streamRequest(controller?: AbortController): Request {
  return new Request("http://localhost/api/notifications/stream", {
    signal: controller?.signal,
  });
}

describe("SSE route boundaries (T045 / FR-032 / FR-033)", () => {
  it("answers 401 for an unauthenticated request, registering nothing", async () => {
    session = null;

    const response = await GET(streamRequest());

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("UNAUTHENTICATED");
    // The refusal happened BEFORE the registry: an unauthenticated caller
    // never gets a slot, so it can neither read nor block anyone.
    expect(connectionsFor(alice.userId)).toBe(0);
  });

  it("streams with the contract headers for an authenticated request", async () => {
    session = { userId: alice.userId, expiresAt: new Date(Date.now() + 3_600_000) };

    const controller = new AbortController();
    const response = await GET(streamRequest(controller));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-cache");
    // The connection is live for this user only.
    expect(connectionsFor(alice.userId)).toBe(1);

    // Cleanup: cancel the stream and abort the request, both of which the
    // route treats as disconnect.
    await response.body?.cancel();
    controller.abort();
  });

  it("reclaims the connection when the client disconnects (FR-033)", async () => {
    session = { userId: alice.userId, expiresAt: new Date(Date.now() + 3_600_000) };

    const controller = new AbortController();
    const response = await GET(streamRequest(controller));
    expect(connectionsFor(alice.userId)).toBe(1);

    // A closing tab / sleeping laptop aborts its request. The registry slot
    // must go with it — this is the whole reclaim path, since a route-level
    // ping failure would otherwise never be observed in a test.
    controller.abort();
    expect(connectionsFor(alice.userId)).toBe(0);

    await response.body?.cancel();
  });

  it("refuses new connections at capacity with STREAM_CAPACITY (FR-033)", async () => {
    const { maxConnections } = getNotificationConfig().stream;
    // A runaway guard, never a ration: a shop has tens of users. Filling it
    // in a test is a loop over objects — the cap exists so a bug cannot
    // exhaust file descriptors, and this asserts the refusal is distinct
    // (503 + STREAM_CAPACITY) so the client can tell "retry later" from
    // "broken" and fall back to polling.
    for (let i = 0; i < maxConnections; i += 1) {
      // Slot fillers; afterEach resets the registry so nothing lingers.
      registerConnection(`capacity-filler-${i}`, () => undefined);
    }

    session = { userId: alice.userId, expiresAt: new Date(Date.now() + 3_600_000) };
    const response = await GET(streamRequest());

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("STREAM_CAPACITY");
    // The refusal adds no slot of its own.
    expect(connectionsFor(alice.userId)).toBe(0);
  });
});
