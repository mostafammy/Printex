// Auth barrel export — 001-identity-access-audit (Phase 3 + Phase 5).
//
// Exports:
//   - Actor (type)
//   - getActor, getActorForSession, UnauthenticatedError (from getActor.ts)
//   - authorize, ForbiddenError (from authorize.ts)
//   - Permission, RoleKey (types from permissions.ts)
//   - ALL_PERMISSIONS, ALL_ROLE_KEYS (runtime arrays from permissions.ts)
//   - audit (audit.record — FR-019, FR-020, added Phase 5 / T031)
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
export { audit } from "./audit";
