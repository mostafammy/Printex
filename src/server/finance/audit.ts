// Audit action vocabulary for 052-finance (contracts/authorization-audit.md).
// Actual writes always go through 001's `audit.record(tx, …)` inside the
// mutation's transaction — this module only names the actions and holds the
// pre-audit reason policy (001 audit.md: the calling feature validates
// reason-required actions BEFORE calling audit.record).

import { DomainFinanceError } from "./errors";

export const FINANCE_AUDIT_ACTIONS = {
  paymentRecorded: "payment.recorded",
  paymentVoided: "payment.voided",
  expenseRecorded: "expense.recorded",
  expenseVoided: "expense.voided",
  expenseApproved: "expense.approved",
  directCostRecorded: "direct_cost.recorded",
  directCostVoided: "direct_cost.voided",
  creditUpdated: "credit.updated",
  configUpdated: "config.updated",
} as const;

export type FinanceAuditAction =
  (typeof FINANCE_AUDIT_ACTIONS)[keyof typeof FINANCE_AUDIT_ACTIONS];

/**
 * Validate a required reason before any mutation/audit write.
 * Used by voids (payment/expense/cost) and credit updates (052-local policy).
 */
export function requireReason(reason: string | null | undefined, what: string): string {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length === 0) {
    throw new DomainFinanceError("VALIDATION", `A reason is required to ${what}`);
  }
  return trimmed;
}
