// 052-finance public surface — the only import path consumers use
// (plan.md module boundary; src/server/pricing/index.ts precedent).

export { DomainFinanceError } from "./errors";
export type { FinanceErrorCode } from "./errors";

export { FINANCE_AUDIT_ACTIONS, requireReason } from "./audit";
export type { FinanceAuditAction } from "./audit";

export {
  getFinanceConfig,
  isActiveCategory,
  isActiveMethod,
  isActiveSource,
  getApprovalThreshold,
  getShopTimezone,
  updateFinanceConfig,
  resetFinanceConfigCache,
} from "./config";
export type { FinanceConfigData } from "./config";

export { parsePositiveDecimal, parseNonNegativeDecimal, sumDecimalStrings, toDecimalString } from "./money";

export { shopLocalDate, shopLocalDayBoundsUtc, calendarDateToUtcMidnight } from "./time";

export {
  PortAlreadyBoundError,
  bindCompensationReadPort,
  bindFinancialClosurePort,
  invokeFinancialClosure,
  readCreditCompensations,
} from "./ports";
export type { CompensationReadFn, CreditCompensation, FinancialClosureFn } from "./ports";

export { financeSummaryProvider } from "./summary-port";
export type { FinanceSummaryPort, OrderFinanceSummary } from "./summary-port";

export { computeOrderSummary, customerBalance, listCustomerBalances, orderSummary } from "./summaries";
export type {
  CustomerBalance,
  CustomerBalanceOrderRow,
  OrderFinancePanelData,
  OrderFinanceResult,
} from "./summaries";

export { isPaymentVoided, listPayments, recordPayment, voidPayment } from "./payments";
export type {
  ListPaymentsFilter,
  PaymentRow,
  PaymentSnapshot,
  RecordPaymentInput,
  VoidPaymentInput,
  VoidResult,
} from "./payments";

export { approveExpense, listExpenses, recordExpense, voidExpense } from "./expenses";
export type {
  ExpenseRow,
  ExpenseSnapshot,
  ListExpensesFilter,
  RecordExpenseInput,
} from "./expenses";

export { listDirectCosts, recordDirectCost, voidDirectCost } from "./costs";
export type {
  DirectCostRow,
  DirectCostSnapshot,
  ListDirectCostsFilter,
  RecordDirectCostInput,
} from "./costs";

export { getCreditStanding, updateCredit } from "./credit";
export type { CreditStanding, UpdateCreditInput } from "./credit";

export { orderProfitability } from "./profitability";
export type { OrderProfitability, ProfitabilityTerm } from "./profitability";

export { dailyCashSummary, todayShopLocalDate } from "./daily-cash";
export type { DailyCashLine, DailyCashSummary } from "./daily-cash";

export { getReceipt } from "./receipt";
export type { ReceiptProjection } from "./receipt";
