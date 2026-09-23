// errors.ts — local error type for src/server/orders/**.
//
// NOT core's DomainError/Result type (this module isn't part of
// src/server/core/** and isn't bound by its "never throw" contract) — this
// follows the same "let it throw, Server Action boundary catches" convention
// ForbiddenError/UnauthenticatedError already establish in src/server/auth/**
// (plan.md §5.3).

/**
 * Thrown by src/server/orders/** functions when a domain rule refuses the
 * action. The `code` lets Server Actions pattern-match into a user-facing
 * message without string-matching `message`.
 */
export class DomainOrderError extends Error {
  readonly code: "ORDER_FINISHED" | "PAST_EDIT_WINDOW" | "TERMINAL_WORK_ITEM" | "DUPLICATE_NAME";

  constructor(
    code: "ORDER_FINISHED" | "PAST_EDIT_WINDOW" | "TERMINAL_WORK_ITEM" | "DUPLICATE_NAME",
    message: string,
  ) {
    super(message);
    this.name = "DomainOrderError";
    this.code = code;
  }
}
