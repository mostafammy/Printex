// Interactive transaction budget shared by every command and TxScope runner.
// contracts/aspects.md §3.1 step 4 (specs/016-change-control/contracts/aspects.md).

import type { Prisma } from "../../../../generated/prisma";

export type TxOptions = {
  readonly maxWait?: number;
  readonly timeout?: number;
  readonly isolationLevel?: Prisma.TransactionIsolationLevel;
};

/**
 * Explicit budget instead of Prisma's implicit 5 s default. The database sits
 * behind a remote pooler (~100–250 ms per round trip), so a command with a
 * dozen sequential statements can brush 5 s under load. Commands must still
 * stay well under this — it is a ceiling, not a target.
 */
export const DEFAULT_TX_OPTIONS = {
  maxWait: 5_000,
  timeout: 15_000,
} as const satisfies TxOptions;

/** Caller-supplied options win over the defaults, field by field. */
export function withDefaultTxOptions(opts?: TxOptions): TxOptions {
  return { ...DEFAULT_TX_OPTIONS, ...opts };
}
