// errors.ts — local error type for src/server/designers/**.
//
// NOT core's DomainError/Result type (this module isn't part of
// src/server/core/** and isn't bound by its "never throw" contract) — this
// follows the same "let it throw, Server Action boundary catches" convention
// src/server/orders/**'s DomainOrderError already establishes
// (contracts/designer-assignment.md).

type DomainDesignerErrorCode =
  | "NOT_ASSIGNABLE"
  | "REASON_REQUIRED"
  | "NOT_ASSIGNEE"
  | "NOT_TIMEABLE"
  | "NOT_IN_DESIGN"
  | "NO_DESIGN_VERSION"
  | "WORK_ITEM_NOT_FOUND";

/**
 * Thrown by src/server/designers/** functions when a domain rule refuses the
 * action. The `code` lets Server Actions pattern-match into a user-facing
 * message without string-matching `message`.
 */
export class DomainDesignerError extends Error {
  readonly code: DomainDesignerErrorCode;

  constructor(code: DomainDesignerErrorCode, message: string) {
    super(message);
    this.name = "DomainDesignerError";
    this.code = code;
  }
}
