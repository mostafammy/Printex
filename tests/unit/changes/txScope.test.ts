// tests/unit/changes/txScope.test.ts
// Unit tests for runInTxScope helper with fake db.

import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../generated/prisma";
import { AspectMisuseError, DEFAULT_TX_OPTIONS, type TxScope } from "~/server/core";
import { runInTxScope, type TxScopeOptions } from "~/server/changes";

function createFakeDb() {
  const steps: string[] = [];
  const fakeTx = { id: "fake-tx" } as unknown as Prisma.TransactionClient;
  let lastOpts: TxScopeOptions | undefined;

  const db = {
    async $transaction<T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
      opts?: TxScopeOptions,
    ): Promise<T> {
      lastOpts = opts;
      steps.push("tx:start");
      try {
        const result = await fn(fakeTx);
        steps.push("tx:commit");
        return result;
      } catch (err) {
        steps.push("tx:rollback");
        throw err;
      }
    },
  };

  return { db, steps, fakeTx, getLastOpts: () => lastOpts };
}

describe("runInTxScope pure unit tests", () => {
  it("applies DEFAULT_TX_OPTIONS when no opts are passed", async () => {
    const { db, getLastOpts } = createFakeDb();
    await runInTxScope(db, async () => null);
    expect(getLastOpts()).toEqual(DEFAULT_TX_OPTIONS);
  });

  it("executes fn inside db.$transaction, passes opts, and returns result", async () => {
    const { db, steps, getLastOpts } = createFakeDb();

    const result = await runInTxScope(
      db,
      async (scope) => {
        expect(scope.tx).toBeDefined();
        steps.push("fn:run");
        return { data: 42 };
      },
      { timeout: 20000 },
    );

    expect(result).toEqual({ data: 42 });
    // Caller options win; unspecified fields fall back to DEFAULT_TX_OPTIONS.
    expect(getLastOpts()).toEqual({ ...DEFAULT_TX_OPTIONS, timeout: 20000 });
    expect(steps).toEqual(["tx:start", "fn:run", "tx:commit"]);
  });

  it("runs afterCommit hooks sequentially after transaction commits", async () => {
    const { db, steps } = createFakeDb();

    await runInTxScope(db, async (scope) => {
      scope.afterCommit(async () => {
        steps.push("hook:1");
      });
      scope.afterCommit(async () => {
        steps.push("hook:2");
      });
      steps.push("fn:done");
    });

    expect(steps).toEqual([
      "tx:start",
      "fn:done",
      "tx:commit",
      "hook:1",
      "hook:2",
    ]);
  });

  it("throws AspectMisuseError if afterCommit is called after transaction settles (commit)", async () => {
    const { db } = createFakeDb();
    let leakedScope!: TxScope;

    await runInTxScope(db, async (scope) => {
      leakedScope = scope;
    });

    expect(() => {
      leakedScope.afterCommit(async () => {});
    }).toThrowError(AspectMisuseError);
    expect(() => {
      leakedScope.afterCommit(async () => {});
    }).toThrow(/Cannot register afterCommit hook after transaction has settled/);
  });

  it("does not run hooks and throws AspectMisuseError after rollback", async () => {
    const { db, steps } = createFakeDb();
    let leakedScope!: TxScope;
    let hookRan = false;

    await expect(
      runInTxScope(db, async (scope) => {
        leakedScope = scope;
        scope.afterCommit(async () => {
          hookRan = true;
        });
        throw new Error("DB_WRITE_FAILED");
      }),
    ).rejects.toThrow("DB_WRITE_FAILED");

    expect(steps).toEqual(["tx:start", "tx:rollback"]);
    expect(hookRan).toBe(false);

    expect(() => {
      leakedScope.afterCommit(async () => {});
    }).toThrowError(AspectMisuseError);
  });

  it("logs (does not throw) hook errors and runs remaining hooks", async () => {
    const { db, steps } = createFakeDb();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await runInTxScope(db, async (scope) => {
        scope.afterCommit(async () => {
          steps.push("hook:1");
          throw new Error("Hook 1 failed");
        });
        scope.afterCommit(async () => {
          steps.push("hook:2");
        });
        return "success";
      });

      expect(res).toBe("success");
      expect(steps).toEqual([
        "tx:start",
        "tx:commit",
        "hook:1",
        "hook:2",
      ]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[runInTxScope] afterCommit hook failed",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
