// errors.ts — DomainReviewError (Foundational, T005).
// contracts/review-rework.md's Errors section. Mirrors 012's
// DomainDesignerError / src/server/orders/**'s DomainOrderError — a local
// throw-based error class, NOT core's Result/DomainError "never throw"
// contract (eslint.config.js rule (c) only applies inside src/server/core/**).

export type DomainReviewErrorCode = "WORK_ITEM_NOT_FOUND" | "NOT_REVIEWABLE" | "NO_DESIGN_VERSION";

export class DomainReviewError extends Error {
  readonly code: DomainReviewErrorCode;
  constructor(code: DomainReviewErrorCode, message: string) {
    super(message);
    this.name = "DomainReviewError";
    this.code = code;
  }
}
