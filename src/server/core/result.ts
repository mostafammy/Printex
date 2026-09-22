// Result/Either pattern — plan.md §5.2, §5.3.
//
// Every fallible `core` operation returns `Result<T, DomainError>` instead of
// throwing. Callers are forced by the type system to handle failure before
// touching `.value`.

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
