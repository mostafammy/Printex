// getActor.ts — resolves a Better Auth session to a typed `Actor`.
//
// Two entry points:
//   - `getActorForSession(session)` — the cookie-independent, directly
//     testable core (T010 integration tests call this with seeded DB rows).
//   - `getActor()` — the Next.js server-component entry point that reads
//     the current request's cookie via the shared cached session read
//     (`getSession`), then delegates to `getActorForSession`.

import { cache } from "react";
import { db } from "~/server/db";
// 092 T015: the shared, cache()-wrapped session read (not auth directly).
import { getSession } from "~/server/better-auth/server";
import type { Permission, RoleKey } from "./permissions";

export interface Actor {
  readonly id?: string;
  readonly userId: string;
  /**
   * Display-only identity (092-performance FR-010 / contract §1): populated
   * from the user row the per-request RBAC load ALREADY returns — never an
   * authorization input. Optional so pre-existing Actor literals (test
   * fixtures, domain callers) stay valid; `getActor()` always fills them.
   */
  readonly name?: string | null;
  readonly username?: string | null;
  readonly roles: readonly RoleKey[];
  readonly permissions: ReadonlySet<Permission>;
  readonly departmentIds: readonly string[];
}

export class UnauthenticatedError extends Error {
  constructor(message = "UNAUTHENTICATED") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Lower-level, cookie-independent core — directly testable (T010 integration
 * test).  Accepts the minimal session shape that Better Auth exposes:
 * `{ userId, expiresAt }`.  Throws `UnauthenticatedError` when:
 *   - `session` is null (no session at all), or
 *   - `session.expiresAt` is in the past, or
 *   - the corresponding User does not exist or is deactivated (`isActive === false`).
 */
export async function getActorForSession(
  session: { userId: string; expiresAt: Date } | null,
): Promise<Actor> {
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw new UnauthenticatedError();
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    // 092 (AC-005/PR-002): one JOINED statement for the whole RBAC graph.
    // The default relation-load strategy fetches roles/extraPermissions/
    // departments as 3 additional queries (measured: 4 total), which blows
    // the shell's ≤4-query budget; "join" collapses it to 1 without any
    // schema or semantic change (read-shape only, FC-001).
    relationLoadStrategy: "join",
    include: {
      // Prisma relation names from identity.prisma:
      //   User.roles       → UserRole[]  (with .role → Role → .permissions → RolePermission[])
      //   User.extraPermissions → UserPermission[]
      //   User.departments → UserDepartment[]
      roles: { include: { role: { include: { permissions: true } } } },
      extraPermissions: true,
      departments: true,
    },
  });

  if (!user?.isActive) {
    throw new UnauthenticatedError();
  }

  const roles = user.roles.map((ur) => ur.role.key as RoleKey);

  const permissions = new Set<Permission>();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission as Permission);
    }
  }
  for (const up of user.extraPermissions) {
    permissions.add(up.permission as Permission);
  }
  if (roles.includes("ACCOUNTING")) {
    permissions.add("pricing.use_fixed");
    permissions.add("pricing.set_variable");
    permissions.add("pricing.override");
    permissions.add("workitem.approve_production");
    permissions.add("customer.manage");
  }
  if (roles.includes("PRODUCTION_OPERATOR")) {
    permissions.add("production.operate");
    permissions.add("files.download_production");
  }

  const departmentIds = user.departments.map((ud) => ud.departmentId);

  // 092 T013: carry the display fields this same query already loaded —
  // the shell layout's duplicate `db.user.findUnique(name, username)` is
  // deleted because of this (FR-008, FR-010). Display-only.
  return {
    id: user.id,
    userId: user.id,
    name: user.name,
    username: user.username,
    roles,
    permissions,
    departmentIds,
  };
}

/**
 * Cookie-reading entry point — what every server action / server component
 * calls in practice. Delegates to `getActorForSession` after extracting the
 * session from the current request's cookies.
 *
 * 092 T015: reads the session through the EXISTING `cache()`-wrapped
 * `getSession` (`src/server/better-auth/server.ts`) instead of calling
 * Better Auth's session API directly, so every consumer in one request
 * (layout, pages, `/`, `/auth/required`) shares ONE session lookup instead
 * of two request caches that could never meet (FR-011, FR-012;
 * investigation §6.3 secondary duplicate).
 */
// Wrapped in React's `cache()` so the layout and the page it wraps — both of
// which call `getActor()` on every request — share one execution per request.
export const getActor = cache(async function getActor(_request?: unknown): Promise<Actor> {
  const result = await getSession();
  if (!result) throw new UnauthenticatedError();
  return getActorForSession({
    userId: result.session.userId,
    expiresAt: result.session.expiresAt,
  });
});
