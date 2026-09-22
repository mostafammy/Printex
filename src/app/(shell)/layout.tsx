import { getActor } from "~/server/auth";
import type { Actor as CoreActor } from "~/server/core";
import { asUserId } from "~/server/core";

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

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-e border-border bg-card ps-2 pe-2 py-4">
        <SidebarNav actor={coreActor} />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
