import { getActor, type Actor } from "~/server/auth";
import { asUserId } from "~/server/core";

import { SidebarNav } from "./_components/sidebar-nav";

// TEMPORARY, pending 001-identity-access-audit: `getActor()` has no
// implementation yet (it's an ambient `declare function` — see
// src/server/auth/index.ts), so calling it today throws
// "is not implemented" at runtime. Until 001 lands, fall back to a
// zero-permission actor rather than letting the shell crash or block local
// dev entirely — this actor sees only the roleless nav entries (e.g. "My
// queue"). Remove this try/catch once 001 provides a real session-backed
// getActor().
async function resolveActor(): Promise<Actor> {
  try {
    return await getActor();
  } catch {
    return { id: asUserId("dev-fallback"), roles: [], departmentIds: [] };
  }
}

export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await resolveActor();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-e border-border bg-card ps-2 pe-2 py-4">
        <SidebarNav actor={actor} />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
