// Actor shape — plan.md §5.3, contracts/workflow.md ("actor: Actor — from
// 001's getActor(); { id, roles, departmentIds }").
//
// `src/server/core/**` must not import from `~/server/auth/**` (module
// boundary rule, eslint.config.js: core may only import from itself — two
// features talk to each other only via a frozen contract, plan.md §5.1).
// `001-identity-access-audit` owns the *implementation* of `getActor()`
// (src/server/auth/index.ts today only stubs its declared shape); `core`
// defines its own structurally-identical `Actor` type here so it has zero
// import-time dependency on the auth feature. Because both shapes are
// structural (not nominal) TypeScript types, a real `Actor` value produced
// by 001's `getActor()` is assignable here without a cast.
import type { UserId } from "./ids";

export interface Actor {
  readonly id: UserId;
  readonly roles: readonly string[];
  readonly departmentIds: readonly string[];
}
