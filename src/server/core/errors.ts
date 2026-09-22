// Typed domain error model — plan.md §5.2, §5.3 and contracts/errors.md.

import type { Result } from "./result";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "GUARD_FAILED"
  | "VALIDATION";

export interface DomainError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

// The action-boundary shape published to other features (contracts/errors.md).
// Distinct from, but mapped 1:1 from, `core`'s internal `Result<T, DomainError>`:
// `{ ok: true; value }` -> `{ ok: true; data }`; `{ ok: false; error }` passes
// through unchanged.
export type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: DomainError };

/**
 * Maps `core`'s internal `Result<T, DomainError>` to the `ActionResult<T>`
 * shape Server Actions (the adapter layer) return to callers. This is the
 * one-line translation plan.md §5.3 describes — `core` never imports
 * `ActionResult` itself, so this helper lives in `core` but is only ever
 * invoked from the adapter layer at the Server Action boundary.
 */
export function toActionResult<T>(
  result: Result<T, DomainError>,
): ActionResult<T> {
  if (result.ok) {
    return { ok: true, data: result.value };
  }
  return { ok: false, error: result.error };
}
