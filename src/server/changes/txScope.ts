// txScope.ts — Transaction runner with TxScope lifecycle for non-aspect callers.
// Collects afterCommit hooks during transaction execution, closes registration
// upon commit/rollback, and runs hooks sequentially after commit.

import type { Prisma } from "../../../generated/prisma";
import { AspectMisuseError, type TxScope } from "~/server/core";

export type TxScopeOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

export type TxScopeDatabase = {
  $transaction<R>(
    fn: (tx: Prisma.TransactionClient) => Promise<R>,
    opts?: TxScopeOptions,
  ): Promise<R>;
};

/**
 * Runs `fn` inside a Prisma transaction, providing a `TxScope` with a safe
 * afterCommit hook runner.
 *
 * - Collects hooks registered via `scope.afterCommit(fn)` while the transaction runs.
 * - Prevents new registrations after the transaction settles (throws AspectMisuseError).
 * - On successful commit, executes collected hooks sequentially.
 * - Logs (does not throw) hook execution errors so a failing hook cannot alter
 *   the outcome of a committed transaction.
 */
export async function runInTxScope<T>(
  db: TxScopeDatabase,
  fn: (scope: TxScope) => Promise<T>,
  opts?: TxScopeOptions,
): Promise<T> {
  const afterCommitHooks: (() => Promise<void>)[] = [];
  let closed = false;

  let result: T;
  try {
    result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const scope: TxScope = {
        tx,
        afterCommit: (hook: () => Promise<void>) => {
          if (closed) {
            throw new AspectMisuseError(
              "Cannot register afterCommit hook after transaction has settled",
            );
          }
          afterCommitHooks.push(hook);
        },
      };
      return await fn(scope);
    }, opts);
  } finally {
    closed = true;
  }

  for (const hook of afterCommitHooks) {
    try {
      await hook();
    } catch (err) {
      console.error("[runInTxScope] afterCommit hook failed", err);
    }
  }

  return result;
}
