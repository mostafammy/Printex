// getActor.ts — resolves a Better Auth session to a typed `Actor`.
//
// Two entry points:
//   - `getActorForSession(session)` — the cookie-independent, directly
//     testable core (T010 integration tests call this with seeded DB rows).
//   - `getActor()` — the Next.js server-component entry point that reads the
//     current request's cookie via `auth.api.getSession`, then delegates to
//     `getActorForSession`.

import { headers } from "next/headers";
import { db } from "~/server/db";
import { auth } from "~/server/better-auth";
import type { Permission, RoleKey } from "./permissions";

export interface Actor {
  readonly userId: string;
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

  const departmentIds = user.departments.map((ud) => ud.departmentId);

  return { userId: user.id, roles, permissions, departmentIds };
}

/**
 * Cookie-reading entry point — what every server action / server component
 * calls in practice.  Delegates to `getActorForSession` after extracting the
 * session from the current request's cookies via Better Auth's `getSession`.
 *
 * `auth.api.getSession` returns `{ session: Session, user: User } | null`
 * (confirmed by reading src/server/better-auth/server.ts which calls the
 * exact same API without further destructuring).
 */
export async function getActor(): Promise<Actor> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) throw new UnauthenticatedError();
  return getActorForSession({
    userId: result.session.userId,
    expiresAt: result.session.expiresAt,
  });
}
