import { getActor } from "~/server/auth";
import type { Actor as CoreActor } from "~/server/core";
import { asUserId } from "~/server/core";
import {
  listNotifications,
  startDelayScheduler,
  startOutboxProcessor,
  unreadCount,
} from "~/server/notifications";
import { NotificationBell } from "~/components/notifications/NotificationBell";
import { markAllReadAction, markReadAction } from "./notifications/actions";

import { SidebarNav } from "./_components/sidebar-nav";

// `getActor()` now has a real implementation (001-identity-access-audit,
// Phase 3) — any error it throws (no session, expired session, deactivated
// user, DB error) is left to propagate to the Next.js error boundary rather
// than being swallowed; there is no dedicated login-redirect middleware yet
// (out of this phase's scope), so an unauthenticated request to a shell page
// surfaces as an error page until that lands.
//
// `~/server/auth`'s `Actor` (plain `userId: string`, includes `permissions`)
// and `~/server/core`'s `Actor` (branded `userId: UserId`, no `permissions`)
// are intentionally separate types (module boundary rule) — this is the one
// call site that bridges them, via `asUserId(...)` (src/server/auth/index.ts
// T015 comment).
export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getActor();
  const coreActor: CoreActor = {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };

  // Both intervals start with the server process, not with a request — and
  // both are idempotent, so a render (or dev's hot reload) never stacks a
  // second one:
  //
  //  - the OUTBOX processor delivers notifications every ~500ms. Without it,
  //    an outbox row would sit PENDING until the delay tick, and SC-001's
  //    "visible within 2 seconds" would depend on luck (FR-028, T024).
  //  - the DELAY scheduler detects breaches every 5 minutes — a report, so a
  //    slower cadence is fine — and an alert nobody can see running is a
  //    support incident (plan.md §Delivery and sequencing).
  startOutboxProcessor();
  startDelayScheduler();

  // Two reads for the header: the bell's exact unread count (a single indexed
  // count, no join) and the dropdown's first page. Parallel because they are
  // independent, and the header renders on EVERY authenticated page — so this
  // is the most-executed query in the app and must stay constant-cost
  // (research.md §2).
  const [unread, firstPage] = await Promise.all([
    unreadCount(actor),
    listNotifications(actor, { page: 1, pageSize: 10 }),
  ]);

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-e border-border bg-card ps-2 pe-2 py-4">
        <SidebarNav actor={coreActor} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The header row, not a floating overlay: a fixed overlay would
            collide with the sidebar's own positioning and the logical-property
            lint (contracts/ui.md §NotificationBell). The bell is present on
            every authenticated page for every role, with no permission check
            of its own (FR-020). */}
        <header className="flex items-center justify-end gap-2 border-b border-border px-6 py-2">
          <NotificationBell
            initialCount={unread}
            initialRows={firstPage.rows}
            markReadAction={markReadAction}
            markAllReadAction={markAllReadAction}
          />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
