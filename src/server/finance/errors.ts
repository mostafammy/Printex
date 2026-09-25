export type FinanceErrorCode =
  | "VALIDATION"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "ORDER_NOT_FOUND"
  | "CUSTOMER_NOT_FOUND"
  | "PAYMENT_NOT_FOUND"
  | "EXPENSE_NOT_FOUND"
  | "DIRECT_COST_NOT_FOUND"
  | "METHOD_NOT_CONFIGURED"
  | "SOURCE_NOT_CONFIGURED"
  | "CATEGORY_NOT_CONFIGURED"
  | "ALREADY_VOIDED"
  | "ALREADY_APPROVED"
  | "APPROVAL_NOT_REQUIRED"
  | "ATTACHMENT_UNAVAILABLE";

export class DomainFinanceError extends Error {
  readonly code: FinanceErrorCode;

  constructor(code: FinanceErrorCode, message: string) {
    super(message);
    this.name = "DomainFinanceError";
    this.code = code;
  }
}
