# Contract: `audit.record`

Owner: 001 (this feature). Primary consumer: every feature that mutates state 002's
`WorkItemTransition` row doesn't already cover, plus this feature's own admin actions
(user/role/department changes) and auth events (login/logout).

## `audit.record`

```ts
const audit = {
  record(
    tx: Prisma.TransactionClient,
    event: {
      action: string;               // e.g. "user.created", "login.failure" — conventionally "entity.verb"
      entityType: string;           // e.g. "User", "Department"
      entityId: string;
      actorId?: UserId;             // omit only for pre-authentication events (e.g. login.failure on an unknown username)
      before?: unknown;
      after?: unknown;
      reason?: string;
      attachmentIds?: string[];
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void>;
};
```

**Behavior**:
1. Insert one `AuditEvent` row via the caller-supplied `tx`, so the audit write commits or rolls
   back atomically with whatever change it documents (constitution V: "a state transition and its
   audit event MUST commit in the same database transaction").
2. No validation beyond Prisma's own JSON-serializability of `before`/`after` — callers are
   responsible for excluding secrets (spec Edge Cases: never pass a password/hash).
3. This function never throws a `DomainError`-shaped rejection for "bad input" the way `core`'s
   functions do — a Prisma write failure here propagates as a rejection like any other `tx` write,
   which is exactly what should abort the caller's transaction.

**This is the only code path allowed to write `AuditEvent` rows.** No migration, admin tool, or
other function may insert directly — always call `audit.record()` inside the same `tx` as the
change being documented.

## Callers MUST supply a `reason` for override-class actions

Spec FR-024: any use of `admin.override`, `pricing.override`, or a `payment.void` used to reverse
another user's entry MUST include `reason` — the calling feature's server action validates this
*before* calling `audit.record()` (reject the whole action with `VALIDATION` if missing), since
`audit.record()` itself has no opinion on which actions require a reason — that policy lives with
each calling feature, not with the shared audit primitive.

## Database-level append-only guarantee

Independent of this function: `AuditEvent` has `UPDATE`/`DELETE` revoked at the Postgres role level
(see research.md and data-model.md) — this holds even against a direct SQL client, not just this
TypeScript function. `audit.record()` only ever `INSERT`s.

## Consuming this contract

Exported as `audit` (with a `.record` method, matching the frozen Linear PRI-5 contract shape) from
`src/server/auth` alongside `getActor`/`authorize` (see contracts/auth.md) — not a separate module,
since callers already import from `~/server/auth` for the other two functions.
