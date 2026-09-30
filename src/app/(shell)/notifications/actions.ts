"use server";

// Server Actions for the notification center — contracts/ui.md §Server Actions.
//
// NO permission key on any of these. A user may only ever change their OWN
// notifications, and the query is `WHERE id = ? AND userId = actor.userId` —
// scope by identity, exactly as 012's own queue is (contract §Permission
// mapping). The server action layer shapes nothing but revalidation; the
// scoping lives in the service, not here, so it cannot be bypassed by calling
// the service directly.

import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import {
  listNotifications,
  markAllRead,
  markRead,
  markUnread,
  unreadCount,
} from "~/server/notifications";
import type { NotificationView } from "~/server/notifications";

/**
 * Invalidates only what a mark action changed — the notifications route
 * itself (092 FR-023, AC-017; 053 contracts/ui.md §Server Actions). The
 * blanket whole-tree invalidation of the root layout is gone: it
 * re-executed every route's RSC cache for a one-row mutation. The bell does
 * not need invalidation here — its re-read (`revalidateBellAction`) is
 * computed fresh on every call and never cached (092 FC-004).
 */
function revalidateNotifications(): void {
  revalidatePath("/notifications");
}

/**
 * The bell's targeted re-read — 092 contract notification-refresh §1.
 *
 * No input: the scope IS the caller. `getActor()` authenticates exactly as
 * the mark actions do, and both reads inherit `unreadCount`/`list`'s
 * `userId = actor.userId` scoping verbatim (SEC-003). A server action is a
 * POST executed per call, so no HTTP cache can ever serve it (FC-004,
 * TR-006) — no `revalidate`, no `cache()`, fresh on every invocation.
 */
export async function revalidateBellAction(): Promise<{
  count: number;
  rows: NotificationView[];
}> {
  const actor = await getActor();
  const [count, firstPage] = await Promise.all([
    unreadCount(actor),
    listNotifications(actor, { page: 1, pageSize: 10 }),
  ]);
  return { count, rows: firstPage.rows };
}

export async function markReadAction(notificationId: string): Promise<void> {
  try {
    const actor = await getActor();
    await markRead(actor, notificationId);
    revalidateNotifications();
  } catch (error) {
    // A refused or missing-row action must not surface as an unhandled
    // rejection from a click handler. The service's error code is what the
    // page would render; a click is not a page.
    console.error("[notifications] markRead failed", error);
  }
}

export async function markUnreadAction(notificationId: string): Promise<void> {
  try {
    const actor = await getActor();
    await markUnread(actor, notificationId);
    revalidateNotifications();
  } catch (error) {
    console.error("[notifications] markUnread failed", error);
  }
}

export async function markAllReadAction(): Promise<void> {
  try {
    const actor = await getActor();
    await markAllRead(actor);
    revalidateNotifications();
  } catch (error) {
    console.error("[notifications] markAllRead failed", error);
  }
}
