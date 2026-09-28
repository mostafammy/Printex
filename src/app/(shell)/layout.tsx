import { redirect } from "next/navigation";
import { getActor } from "~/server/auth";
import type { Actor as CoreActor } from "~/server/core";
import { asUserId } from "~/server/core";
import { db } from "~/server/db";
import {
  listNotifications,
  startDelayScheduler,
  startOutboxProcessor,
  unreadCount,
} from "~/server/notifications";

import { SidebarNav } from "./_components/sidebar-nav";
import { ShellHeader } from "./_components/shell-header";
import { SidebarUserCard } from "./_components/sidebar-user-card";
import { NotificationBell } from "~/components/notifications/NotificationBell";
import { markAllReadAction, markReadAction } from "./notifications/actions";

function getRoleLabel(roles: readonly string[]): string {
  if (roles.includes("ADMIN_OWNER")) return "مدير النظام";
  if (roles.includes("HEAD_DESIGNER")) return "رئيس قسم التصميم";
  if (roles.includes("DESIGNER")) return "مصمم";
  if (roles.includes("RECEPTION")) return "موظف استقبال";
  if (roles.includes("PRODUCTION_OPERATOR")) return "عامل إنتاج";
  if (roles.includes("ACCOUNTING")) return "محاسب مالي";
  if (roles.includes("PRINT_RECEPTION_DELIVERY")) return "مندوب توصيل";
  return "عضو فريق";
}

export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let actor;
  let isUnauthenticated = false;

  try {
    actor = await getActor();
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      err.name === "UnauthenticatedError"
    ) {
      isUnauthenticated = true;
    } else {
      throw err;
    }
  }

  if (isUnauthenticated || !actor) {
    redirect("/auth/required");
  }

  const coreActor: CoreActor = {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };

  // 053 (T024/T035/T087): both loops are already started at process boot by
  // `src/instrumentation.ts`. These calls are IDEMPOTENT backstops — both read
  // the process-wide timer slot, so whichever runs second is a no-op and no
  // combination of boot + render + dev hot reload can stack an interval.
  startOutboxProcessor();
  startDelayScheduler();

  const user = await db.user.findUnique({
    where: { id: actor.userId },
    select: { name: true, username: true },
  });

  const roleLabel = getRoleLabel(actor.roles);

  // The bell's two reads, in parallel: the exact unread count (a single
  // indexed count, no join) and the dropdown's first page. This layout
  // renders on EVERY authenticated page, so it is the most-executed query
  // path in the app and has to stay constant-cost (research.md §2).
  const [unread, firstPage] = await Promise.all([
    unreadCount(actor),
    listNotifications(actor, { page: 1, pageSize: 10 }),
  ]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background selection:bg-primary/20 selection:text-primary">
      {/* The bell lives in the shell header, on every authenticated page for
          every role (FR-020), with no permission check of its own. */}
      <ShellHeader
        userName={user?.name ?? "مستخدم برينتكس"}
        roleLabel={roleLabel}
        bell={
          <NotificationBell
            initialCount={unread}
            initialRows={firstPage.rows}
            markReadAction={markReadAction}
            markAllReadAction={markAllReadAction}
          />
        }
      />
      {/* h-dvh (not min-h-screen) on the shell: a bounded height is what makes
          the two panes below independently scrollable. With a min-height the
          flex container grows with its content, `flex-1` resolves against an
          unbounded box, and BOTH overflow-y-auto panes are dead — the document
          scrolls and the sidebar leaves with it. */}
      <div className="flex min-h-0 flex-1">
        <aside className="scrollbar-none flex w-64 shrink-0 flex-col justify-between overflow-y-auto border-e border-border/60 bg-card/60 px-3 py-4">
          <SidebarNav actor={coreActor} />
          <SidebarUserCard
            userName={user?.name ?? "مستخدم برينتكس"}
            username={user?.username ?? "user"}
            roleLabel={roleLabel}
          />
        </aside>
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto p-6 sm:p-8 md:p-10">
          <div className="mx-auto max-w-7xl animate-shell-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
