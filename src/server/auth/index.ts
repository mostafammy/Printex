// Auth barrel export — 001-identity-access-audit (Phase 3 + Phase 5).
//
// Public surface, matching contracts/auth.md and contracts/audit.md exactly:
//   - Actor, Permission, RoleKey (types)
//   - getActor, authorize (functions)
//   - audit (audit.record — FR-019, FR-020, added Phase 5 / T031)
//   - ALL_PERMISSIONS (runtime companion array to Permission, consumed by
//     the admin UI to enumerate all permission keys — not itself part of
//     the frozen contract shape, but legitimately needed downstream)
//   - recordFailedLogin, recordSuccessfulLogin (FR-004 lockout bookkeeping,
//     consumed by src/server/better-auth/config.ts's sign-in hooks — not
//     part of the frozen contract shape, but legitimately needed downstream)
//
// getActorForSession, UnauthenticatedError, ForbiddenError, and
// ALL_ROLE_KEYS are intentionally NOT re-exported here — they are internal
// to this module's own files and are imported directly from
// `./getActor` / `./authorize` / `./permissions` only by this module's own
// tests, never by downstream application code (enforced by the
// src/server/auth/** module-boundary ESLint rule).
//
// Compatibility note: `Actor.userId` here is a plain `string`.
// `src/server/core/actor.ts` defines its own structural `Actor` with
// `userId: UserId` (a branded string).  These types are separate by design
// (core must not import from auth — module boundary rule).  Callers that need
// to pass a real Actor to core APIs construct the branded UserId via
// `asUserId(actor.userId)` at the call site; they do NOT cast here.

export type { Actor } from "./getActor";
export { getActor } from "./getActor";
export { authorize } from "./authorize";
export type { Permission, RoleKey } from "./permissions";
export { ALL_PERMISSIONS } from "./permissions";
export { audit } from "./audit";
export { recordFailedLogin, recordSuccessfulLogin } from "./lockout";
