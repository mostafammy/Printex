import { getActor, type Actor } from "~/server/auth";
import { asUserId } from "~/server/core";

import { SidebarNav } from "./_components/sidebar-nav";

// TEMPORARY, pending 001-identity-access-audit: `getActor()` has no
// implementation yet — it's an ambient `declare function` (see
// src/server/auth/index.ts) with no function body, so TypeScript emits no
// JavaScript for it and the imported `getActor` binding is `undefined` at
// runtime. Detect that directly with `typeof getActor === "function"`
// rather than calling it and inferring "unimplemented" from a thrown
// error's message — that text is bundler-generated and varies across
// Vitest's SSR transform, Next.js dev (webpack), and minified production
// builds. When `getActor` isn't callable yet, fall back to a
// zero-permission actor rather than letting the shell crash or block local
// dev entirely — this actor sees only the roleless nav entries (e.g. "My
// queue"). Once 001 lands a real, exported `getActor()`, `typeof` sees a
// function, this fallback stops firing on its own, and this whole
// typeof-guarded block can be removed.
async function resolveActor(): Promise<Actor> {
  if (typeof getActor !== "function") {
    return { id: asUserId("dev-fallback"), roles: [], departmentIds: [] };
  }

  // `getActor` is a real implementation here, so let any error it throws
  // (session store timeout, DB error, expired token, etc.) propagate to the
  // Next.js error boundary instead of being swallowed.
  return getActor();
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
