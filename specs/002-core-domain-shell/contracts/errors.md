# Contract: Typed Error Model

Owner: 002 (this feature). Consumers: every feature's Server Actions, starting with 011, 010, 050,
051, 053.

## Shape

Every Server Action defined anywhere in the app returns this discriminated union instead of
throwing:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; details?: unknown } };

type ErrorCode =
  | "UNAUTHENTICATED"   // no valid session (001)
  | "FORBIDDEN"         // signed in, not permitted for this action/record (001)
  | "INVALID_TRANSITION" // transitionWorkItem: edge not in the allowed-edges table
  | "GUARD_FAILED"      // transitionWorkItem: a registered guard returned { ok: false }
  | "VALIDATION";       // Zod input validation failed at the action boundary
```

## Rules

- `message` is safe to show a user (Arabic-ready copy lives with the caller, not here).
- `details` is optional, structured, and intended for logging/debugging (e.g. the Zod issue list
  for `VALIDATION`) — never rendered directly to the end user.
- A Server Action MUST NOT throw for any error condition covered by `ErrorCode`; an uncaught
  exception is a bug, not a `VALIDATION`/`GUARD_FAILED` result.
- `GUARD_FAILED`'s `details` MUST include the failing guard's own `code`/`message` (from
  [workflow.md](./workflow.md)) so the UI can distinguish *why* a transition was blocked.

## Non-goals

This contract does not define HTTP status codes or REST semantics — this project has no separate
API layer; Server Actions are the only server entry point (constitution V).
