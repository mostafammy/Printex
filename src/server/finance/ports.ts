// 052-owned 015 seams (contracts/finance-ports.md): safe defaults so 015's
// absence blocks nothing (constitution VII). 015's instrumentation boot hook
// binds the real implementations at module load. 052 NEVER imports
// `~/server/collection` at compile time (research.md).

import type { Actor } from "~/server/auth";

export type FinancialClosureFn = (
  actor: Actor,
  orderId: string,
) => Promise<{ readonly closed: boolean; readonly unmet?: readonly string[] }>;

export type CreditCompensation = {
  readonly id: string;
  readonly amount: string;
  readonly orderId: string;
};

export type CompensationReadFn = (orderId: string) => Promise<readonly CreditCompensation[]>;

let closureFn: FinancialClosureFn | null = null;
let compensationFn: CompensationReadFn | null = null;
let closureBound = false;
let compensationBound = false;

export class PortAlreadyBoundError extends Error {
  constructor(name: string) {
    super(`${name} already bound`);
    this.name = "PORT_ALREADY_BOUND";
  }
}

export function bindFinancialClosurePort(fn: FinancialClosureFn): void {
  if (closureBound) throw new PortAlreadyBoundError("FinancialClosurePort");
  closureFn = fn;
  closureBound = true;
}

export function bindCompensationReadPort(fn: CompensationReadFn): void {
  if (compensationBound) throw new PortAlreadyBoundError("CompensationReadPort");
  compensationFn = fn;
  compensationBound = true;
}

/**
 * Invoke financial closure AFTER a payment/void transaction commits
 * (FR-023 — never inside the tx; 015 research.md §5). The result is
 * informational only: `closed: false` is NOT an error and this call never
 * throws into the caller — a failed closure evaluator must not fail an
 * already-valid payment (contracts/finance-ports.md).
 */
export async function invokeFinancialClosure(
  actor: Actor,
  orderId: string,
): Promise<{ readonly closed: boolean; readonly unmet?: readonly string[] }> {
  if (!closureFn) {
    // Unbound default: log once; not an error (015 not connected yet).
    if (!invokeFinancialClosure.warned) {
      invokeFinancialClosure.warned = true;
      console.info("[finance] FinancialClosurePort not connected — closure re-evaluation deferred to 015.");
    }
    return { closed: false, unmet: ["FINANCE_NOT_CONNECTED"] };
  }
  try {
    return await closureFn(actor, orderId);
  } catch (error) {
    console.error("[finance] closure port invocation failed (informational only)", error);
    return { closed: false, unmet: ["CLOSURE_PORT_ERROR"] };
  }
}
invokeFinancialClosure.warned = false;

/** CREDIT compensations applied to Remaining; empty until 015 binds (conservative). */
export async function readCreditCompensations(orderId: string): Promise<readonly CreditCompensation[]> {
  if (!compensationFn) return [];
  try {
    return await compensationFn(orderId);
  } catch (error) {
    console.error("[finance] compensation port read failed — treating as no credits", error);
    return [];
  }
}
