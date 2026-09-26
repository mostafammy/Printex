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
import { markAllRead, markRead, markUnread } from "~/server/notifications";

/** Re-reads every surface whose content depends on a notification change. */
function revalidateAll(): void {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markReadAction(notificationId: string): Promise<void> {
  try {
    const actor = await getActor();
    await markRead(actor, notificationId);
    revalidateAll();
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
    revalidateAll();
  } catch (error) {
    console.error("[notifications] markUnread failed", error);
  }
}

export async function markAllReadAction(): Promise<void> {
  try {
    const actor = await getActor();
    await markAllRead(actor);
    revalidateAll();
  } catch (error) {
    console.error("[notifications] markAllRead failed", error);
  }
}
