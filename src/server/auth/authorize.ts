// authorize.ts — thin permission gate called at the top of every server
// action that requires access control (FR-013, spec constitution V).
//
// Usage:
//   authorize(actor, "order.create");
//   authorize(actor, "production.operate", { departmentId: workItem.departmentId });

import type { Actor } from "./getActor";
import type { Permission } from "./permissions";

/**
 * Thrown when `authorize()` denies the request.  The `name` is "ForbiddenError"
 * and the default message is "FORBIDDEN" — both are stable, recognisable markers
 * that callers (and tests) can assert on without coupling to HTTP status codes.
 */
export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Assert that `actor` holds `permission`, optionally scoped to a department.
 *
 * - Throws `ForbiddenError` if the actor does not hold the permission at all.
 * - Throws `ForbiddenError` if `scope.departmentId` is provided but the actor
 *   is not a member of that department (`actor.departmentIds` does not include
 *   it).
 * - Returns `void` (does NOT return a boolean) when access is granted, so
 *   callers know a missing `return` or `await` means "access granted", not
 *   "forgot to check the result".
 */
export function authorize(
  actor: Actor,
  permission: Permission,
  scope?: { departmentId?: string },
): void {
  if (!actor.permissions.has(permission)) {
    throw new ForbiddenError();
  }
  if (scope?.departmentId && !actor.departmentIds.includes(scope.departmentId)) {
    throw new ForbiddenError();
  }
}
