/** @vitest-environment jsdom */
// tests/integration/bellRefresh.test.ts — T027 + T028 (092-performance, US5).
//
// AC-014 (tick never re-executes the route), AC-016 (error + retry, polling
// continues), AC-017 (no whole-tree invalidation), SEC-003 (the targeted
// re-read is scoped to its caller), FR-019..FR-023 and contract
// notification-refresh §1–§7. Tests-first for T029/T030/T031.
//
// Two kinds of assertion live in this one file on purpose:
//   - component: the bell applies `{count, rows}` from the re-read seam and
//     NEVER touches the router (mocked `useRouter().refresh` + a source
//     assertion on NotificationBell.tsx);
//   - server: `revalidateBellAction` against the real test database with two
//     seeded actors. The action reads the session through `getActor()`, which
//     needs Next request headers we do not harness here — so the session seam
//     is the only mocked part and the SCOPING under test (unreadCount +
//     listNotifications with B's seeded actor) is the real one, same pattern
//     as streamRoute.test.ts faking only the cookie lookup.
//
// JSX is avoided because tasks.md pins this file to `.ts` — `createElement`
// renders the component tree without a JSX transform.

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import type { ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { testDb } from "../helpers/testDb";
import { getActor } from "~/server/auth";
import { UnauthenticatedError } from "~/server/auth/getActor";
import {
  listNotifications,
  markRead,
  processOutboxBatch,
  unreadCount,
} from "~/server/notifications";
import type { NotificationView } from "~/server/notifications";
import { markReadAction, revalidateBellAction } from "~/app/(shell)/notifications/actions";
import { recordOutboxEvent, seedNotificationUser } from "../helpers/notificationSeed";
import { revalidatePath } from "next/cache";
import { toArabicDigits } from "~/lib/ar-format";
import ar from "~/messages/ar.json";
import { NotificationBell } from "~/components/notifications/NotificationBell";

const N = ar.notifications;

// `src/env.js` throws when a server key is READ under jsdom (`window` is
// defined, so t3-env treats the run as client-side). SKIP_ENV_VALIDATION is
// the codebase's own documented escape hatch (env.js §skipValidation); it is
// set only while this file's imports evaluate and removed right after, so no
// other test file in the same worker inherits it.
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});
delete process.env.SKIP_ENV_VALIDATION;

// Captured for the NEVER-called assertion: the bell used to call
// `router.refresh()` on every re-read (pre-T030).
const routerRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: (props: { href?: string; children?: ReactNode }) =>
      h("a", { href: props.href ?? "#" }, props.children),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// getActor reads request headers we do not harness; tests below set its
// result per case. Everything else (audit, authorize, ALL_*) stays real.
// getActor reads request headers we do not harness; tests below set its
// result per case. Everything else (audit, authorize, ALL_*) stays real.
vi.mock("~/server/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth")>();
  return { ...actual, getActor: vi.fn() };
});

type Payload = { count: number; rows: NotificationView[] };

afterAll(async () => {
  await testDb.$disconnect();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

let alice: Awaited<ReturnType<typeof seedNotificationUser>>;
let bob: Awaited<ReturnType<typeof seedNotificationUser>>;

beforeAll(async () => {
  alice = await seedNotificationUser({ prefix: "bell-alice" });
  bob = await seedNotificationUser({ prefix: "bell-bob" });
});

let counter = 0;
/** Seeds one delivered notification for `userId` (center.test.ts pattern). */
async function give(userId: string): Promise<string> {
  counter += 1;
  const eventId = await recordOutboxEvent({
    type: "workitem.assigned",
    entityId: `bell-${userId}-${counter}`,
    recipientUserIds: [userId],
  });
  await processOutboxBatch();
  return eventId;
}

function unreadLabel(count: number): string {
  return N.unreadBadgeAria.replace("{count}", toArabicDigits(count));
}

function view(id: string, title: string): NotificationView {
  return {
    id,
    type: "workitem.assigned",
    title,
    body: null,
    severity: "INFO",
    entityType: "WorkItem",
    entityId: `wi-${id}`,
    linkHref: "/orders",
    readAt: null,
    createdAt: "2026-09-30T00:00:00.000Z",
  };
}

function renderBell(revalidate: () => Promise<Payload>) {
  return render(
    createElement(NotificationBell, {
      initialCount: 0,
      initialRows: [],
      markReadAction: async () => undefined,
      markAllReadAction: async () => undefined,
      revalidate,
    }),
  );
}

/** The stream's invalidation entry — what a poll tick / SSE signal calls. */
function tick(): void {
  document.dispatchEvent(new Event("visibilitychange"));
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("T027(a) bell refresh applies the targeted payload — no route refresh (AC-014, FR-019)", () => {
  it("applies {count, rows} from the re-read source and never calls router.refresh", async () => {
    const row = view("n-a-1", "إشعار الاختبار");
    const revalidate = vi.fn<() => Promise<Payload>>(
      async () => ({ count: 3, rows: [row] }),
    );
    renderBell(revalidate);

    // The seam is NO-INPUT: the source is called with zero arguments (T029).
    await actTick();
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenCalledWith();

    // Count state came from the payload, not from a route re-render.
    expect(screen.getByRole("button", { name: unreadLabel(3) })).toBeInTheDocument();

    // Rows too: open the dropdown and the payload's row is what renders.
    fireEvent.click(screen.getByRole("button", { name: unreadLabel(3) }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("إشعار الاختبار")).toBeInTheDocument();

    expect(routerRefresh).not.toHaveBeenCalled();

    const bellSource = readFileSync(
      resolve(process.cwd(), "src/components/notifications/NotificationBell.tsx"),
      "utf8",
    );
    expect(bellSource).not.toContain("router.refresh");
    expect(bellSource).not.toContain("useRouter");
  });
});

describe("T027(b) targeted source is scoped to its caller (SEC-003)", () => {
  it("with user B's actor the source returns only B's rows", async () => {
    const aliceEvent = await give(alice.userId);
    await give(bob.userId);
    const aliceRow = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: aliceEvent, userId: alice.userId },
    });
    expect(await testDb.notification.count({ where: { userId: bob.userId } })).toBeGreaterThan(0);

    // The action's session seam, faked; its SCOPING (unreadCount +
    // listNotifications with this actor) runs for real against the DB.
    vi.mocked(getActor).mockReset();
    vi.mocked(getActor).mockResolvedValue(bob);

    const result = await revalidateBellAction();

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThanOrEqual(10);
    expect(result.count).toBeGreaterThan(0);
    expect(result.count).toBe(await unreadCount(bob));

    // Every returned row physically belongs to B; A's row is not among them.
    const owned = await testDb.notification.findMany({
      where: { id: { in: result.rows.map((r) => r.id) } },
      select: { userId: true },
    });
    expect(owned).toHaveLength(result.rows.length);
    expect(owned.every((r) => r.userId === bob.userId)).toBe(true);
    expect(result.rows.some((r) => r.id === aliceRow.id)).toBe(false);

    // And the payload is exactly the same scoped read listNotifications does.
    const direct = await listNotifications(bob, { page: 1, pageSize: 10 });
    expect(result.rows).toEqual(direct.rows);
  }, 60_000);
});

describe("T027(c) failing source → error surface, retry re-calls, polling continues (AC-016, FR-022)", () => {
  it("shows the existing error + retry, retries the targeted read only, and the 15s poll keeps ticking", async () => {
    vi.useFakeTimers();
    let failing = true;
    const revalidate = vi.fn<() => Promise<Payload>>(async () => {
      if (failing) throw new Error("re-read failed");
      return { count: 2, rows: [view("n-c-1", "تعافى")] };
    });
    renderBell(revalidate);

    // A failing re-read surfaces the EXISTING inline error (FR-022).
    await actTick();
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(N.loadError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: N.retry })).toBeInTheDocument();

    // Polling continues while the error is shown: one 15 s tick re-enters
    // the same targeted source (053 contract — poll interval unchanged).
    await actTick(15_000);
    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Retry re-attempts the targeted read — and only that.
    failing = false;
    fireEvent.click(screen.getByRole("button", { name: N.retry }));
    await flush();
    expect(revalidate).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: unreadLabel(2) })).toBeInTheDocument();

    expect(routerRefresh).not.toHaveBeenCalled();
  });
});

describe("T027(d) mark-read keeps its audit + authorization semantics (FR-021, AC-015)", () => {
  it("writes the audit event for the owner, refuses without a session, refuses another user's row, and invalidates only /notifications (T028)", async () => {
    const eventId = await give(alice.userId);
    const row = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: eventId, userId: alice.userId },
    });

    // 1) No session → refused at the action boundary, zero side effects.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getActor).mockReset();
    vi.mocked(getActor).mockRejectedValueOnce(new UnauthenticatedError());
    vi.mocked(revalidatePath).mockClear();
    await markReadAction(row.id);
    expect(errSpy).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(
      await testDb.auditEvent.count({
        where: { action: "notification.read", entityId: row.id },
      }),
    ).toBe(0);

    // 2) Authenticated owner → ONE audit row, scoped invalidation only.
    vi.mocked(getActor).mockResolvedValue(alice);
    await markReadAction(row.id);
    const audits = await testDb.auditEvent.findMany({
      where: { action: "notification.read", entityId: row.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorId).toBe(alice.userId);
    expect(revalidatePath).toHaveBeenCalledWith("/notifications");
    expect(revalidatePath).not.toHaveBeenCalledWith("/", "layout");
    errSpy.mockRestore();

    // 3) Another user's row → NOT_FOUND, never a silent success (FR-025):
    //    identity is the permission for reading one's own notifications.
    const otherEvent = await give(alice.userId);
    const otherRow = await testDb.notification.findFirstOrThrow({
      where: { sourceEventId: otherEvent, userId: alice.userId },
    });
    await expect(markRead(bob, otherRow.id)).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
    });
    const untouched = await testDb.notification.findUniqueOrThrow({
      where: { id: otherRow.id },
    });
    expect(untouched.readAt).toBeNull();
    expect(
      await testDb.auditEvent.count({
        where: { action: "notification.read", entityId: otherRow.id },
      }),
    ).toBe(0);
  }, 60_000);
});

describe("T027(e) latest-response-wins across out-of-order re-reads (contract notification-refresh §3)", () => {
  it("discards the older response and applies only the latest issued payload, silently", async () => {
    const first = deferred<Payload>();
    const second = deferred<Payload>();
    const revalidate = vi
      .fn<() => Promise<Payload>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    renderBell(revalidate);

    // Two back-to-back issued re-reads; the SECOND is the latest issued.
    await actTick();
    await actTick();
    expect(revalidate).toHaveBeenCalledTimes(2);

    // The latest issued response resolves FIRST and applies.
    await actResolve(second, { count: 5, rows: [view("n-latest", "الأحدث")] });
    expect(screen.getByRole("button", { name: unreadLabel(5) })).toBeInTheDocument();

    // The older response lands later — discarded: no state overwrite,
    // no error surfaced (§3.1, §3.2).
    await actResolve(first, { count: 99, rows: [view("n-stale", "قديم")] });
    expect(screen.getByRole("button", { name: unreadLabel(5) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: unreadLabel(99) })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});

describe("T028 actions.ts invalidation scope (AC-017, FR-023)", () => {
  it('no longer calls revalidatePath("/", "layout") — scoped to /notifications only', () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/notifications/actions.ts"),
      "utf8",
    );
    expect(source).not.toContain('revalidatePath("/", "layout")');
    expect(source).toContain('revalidatePath("/notifications")');
  });
});

/** Dispatches the stream's invalidation entry (optionally after `advanceMs`). */
async function actTick(advanceMs?: number): Promise<void> {
  await act(async () => {
    if (advanceMs !== undefined) vi.advanceTimersByTime(advanceMs);
    else tick();
    await Promise.resolve();
  });
}

/** Flushes pending microtask-driven state updates. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function actResolve(d: Deferred<Payload>, payload: Payload): Promise<void> {
  await act(async () => {
    d.resolve(payload);
    await Promise.resolve();
  });
}
