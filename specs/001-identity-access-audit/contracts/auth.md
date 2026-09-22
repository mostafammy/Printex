# Contract: Actor, `getActor`, `authorize`

Owner: 001 (this feature). This is the most depended-on contract in the project — 002 already
stubs it (`src/server/auth/index.ts`), and every future feature's server actions call `authorize()`
before mutating anything (constitution V).

## `Actor`

```ts
type Permission =
  | "order.create" | "order.edit" | "order.cancel"
  | "customer.manage"
  | "workitem.assign_designer"
  | "design.work" | "design.review"
  | "production.operate"
  | "collection.receive" | "delivery.record"
  | "pricing.use_fixed" | "pricing.set_variable" | "pricing.override"
  | "payment.record" | "payment.void"
  | "expense.record" | "finance.view"
  | "files.download_production"
  | "audit.view"
  | "admin.users" | "admin.config" | "admin.override";

interface Actor {
  readonly userId: UserId;             // from `~/server/core`'s branded ID
  readonly roles: readonly RoleKey[];   // the 7 keys from data-model.md, informational only
  readonly permissions: ReadonlySet<Permission>;  // union of all roles' + UserPermission's grants
  readonly departmentIds: readonly string[];      // Department IDs this actor is a member of
}
```

This is the shape 002's `Actor` (`src/server/auth/index.ts`, `src/server/core/actor.ts`) is aligned
to — note: 002's original stub used `id` instead of `userId`; that drift was corrected (both files,
plus `transitionWorkItem` and the shell layout's fallback actor) to match this frozen contract before
001's implementation landed, so field names are consistent project-wide. This feature replaces 002's
ambient `declare function getActor(): Promise<Actor>` with a real implementation, same call shape, so
002's `transitionWorkItem` callers and `resolveActor()` in the shell layout keep compiling unchanged.

## `getActor`

```ts
function getActor(): Promise<Actor>;
```

**Behavior**:
1. Read the Better Auth session from the current request (cookie).
2. No session, or `Session.expiresAt` in the past → reject `UNAUTHENTICATED`.
3. Load the session's `User`. `isActive === false` → reject `UNAUTHENTICATED` (re-checked on
   *every* call, not cached from session creation — this is what makes deactivation/force-logout
   instantaneous, per research.md).
4. Compute `permissions` as the union of: every `RolePermission` for the user's `UserRole`s, plus
   every `UserPermission` row directly on the user.
5. Return the assembled `Actor`.

Any of steps 2–3 failing MUST reject/throw so callers can treat "no Actor" and "invalid session" as
the same condition — there is no `Actor | null` return shape (matches 002's stub, which already
declares a rejecting `Promise<Actor>`, never a nullable one).

## `authorize`

```ts
function authorize(
  actor: Actor,
  permission: Permission,
  scope?: { departmentId?: string }
): void;
```

**Behavior**:
1. `!actor.permissions.has(permission)` → throw/reject `FORBIDDEN`.
2. If `scope?.departmentId` is given and `!actor.departmentIds.includes(scope.departmentId)` →
   throw/reject `FORBIDDEN`.
3. Otherwise return normally (void) — this is a guard, not a query; callers call it for its
   throwing side effect at the top of a server action, before any write.

**Callers MUST call this themselves in every server action / route handler** — a disabled or
hidden UI button is UX only and is never sufficient enforcement (constitution V, spec FR-009).
Middleware-only checks are insufficient for the same reason (spec Pitfalls).

## Consuming this contract

`Actor`, `Permission`, `getActor`, `authorize` are exported from `src/server/auth` (the existing
002-created module whose ambient stub this feature replaces) — import from there, never redefine
the `Permission` union in a downstream feature.
