// Auth barrel export — 001-identity-access-audit (Phase 3).
//
// Exports exactly 6 items (T015):
//   - Actor (type)
//   - getActor, getActorForSession, UnauthenticatedError (from getActor.ts)
//   - authorize, ForbiddenError (from authorize.ts)
//   - Permission, RoleKey (types from permissions.ts)
//   - ALL_PERMISSIONS, ALL_ROLE_KEYS (runtime arrays from permissions.ts)
//
// NOTE: `audit` (audit.record) is intentionally NOT exported here — it does
// not exist until Phase 5 (T031) and will be added to this barrel then.
//
// Compatibility note: `Actor.userId` here is a plain `string`.
// `src/server/core/actor.ts` defines its own structural `Actor` with
// `userId: UserId` (a branded string).  These types are separate by design
// (core must not import from auth — module boundary rule).  Callers that need
// to pass a real Actor to core APIs construct the branded UserId via
// `asUserId(actor.userId)` at the call site; they do NOT cast here.

export type { Actor } from "./getActor";
export { getActor, getActorForSession, UnauthenticatedError } from "./getActor";
export { authorize, ForbiddenError } from "./authorize";
export type { Permission, RoleKey } from "./permissions";
export { ALL_PERMISSIONS, ALL_ROLE_KEYS } from "./permissions";
