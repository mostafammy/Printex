// errors.ts — DomainProductionError (Foundational, T006).
// contracts/production.md's Errors section. Mirrors 013's DomainReviewError /
// 012's DomainDesignerError — a local throw-based error class, NOT core's
// Result/DomainError "never throw" contract (eslint.config.js rule (c) only
// applies inside src/server/core/**).

export type DomainProductionErrorCode =
  | "WORK_ITEM_NOT_FOUND"
  | "NOT_READY_FOR_PRODUCTION"
  | "PENDING_FILE_REVISION"
  | "MISSING_PRODUCED_QUANTITY"
  | "VENDOR_RECEIPT_REQUIRED"
  | "NOT_EXTERNAL_DEPARTMENT"
  | "ALREADY_RECEIVED"
  | "PRODUCTION_ALREADY_STARTED";

export class DomainProductionError extends Error {
  readonly code: DomainProductionErrorCode;
  constructor(code: DomainProductionErrorCode, message: string) {
    super(message);
    this.name = "DomainProductionError";
    this.code = code;
  }
}
