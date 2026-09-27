// Unit tests for shared command/query aspect layer.
// contracts/aspects.md §7 (specs/016-change-control/contracts/aspects.md).
//
// Tests the fixed pipeline order, permission checking, transactions, audit guarantees,
// afterCommit hooks, .inTx composition, error mapping table, and architectural boundary rules
// using in-memory fake dependencies (no database).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { DEFAULT_TX_OPTIONS } from "~/server/core/aspects/txOptions";
import {
  createAspects,
  AspectDomainError,
  AspectMisuseError,
  TransitionFailure,
  fail,
  transitionOrThrow,
  type AspectDeps,
  type AuditEntry,
  type TransitionOrThrowInput,
  type Tx,
} from "~/server/core";
import type { DomainError } from "~/server/core/errors";

interface TestActor {
  readonly userId: string;
  readonly roles?: readonly string[];
  readonly permissions?: ReadonlySet<string>;
  readonly departmentIds?: readonly string[];
}

interface TestModuleError {
  readonly code: "CUSTOM_GUARD_FAILED" | "DUPLICATE_CODE" | "ITEM_LOCKED";
  readonly details?: unknown;
}

function makeActor(overrides: Partial<TestActor> = {}): TestActor {
  return {
    userId: "user-123",
    roles: ["operator"],
    permissions: new Set(["order.edit", "order.view"]),
    departmentIds: ["dept-1"],
    ...overrides,
  };
}

function createFakeDeps() {
  const steps: string[] = [];
  const recordedAudits: Array<{ tx: Tx; entry: AuditEntry & { actorId: string } }> = [];
  const afterCommitErrors: Array<{ error: unknown; meta: { action: string } }> = [];
  const recordedTxOptions: Array<
    { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } | undefined
  > = [];
  let txOpen = false;
  let txCommitted = false;
  let txRolledBack = false;

  const fakeTx = { id: "fake-tx-client" } as unknown as Tx;
  const fakeReader = { id: "fake-reader-client" } as unknown as Tx;

  const deps: AspectDeps<TestActor, string> = {
    transaction: async <T>(
      fn: (tx: Tx) => Promise<T>,
      opts?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
    ): Promise<T> => {
      recordedTxOptions.push(opts);
      steps.push("tx:open");
      txOpen = true;
      try {
        const result = await fn(fakeTx);
        steps.push("tx:commit");
        txCommitted = true;
        return result;
      } catch (caught) {
        steps.push("tx:rollback");
        txRolledBack = true;
        throw caught;
      } finally {
        txOpen = false;
      }
    },
    reader: fakeReader,
    checkPermission: (actor, permission, scope) => checkPermissionFn(actor, permission, scope),
    isForbidden: (e) => e instanceof Error && e.name === "ForbiddenError",
    recordAudit: async (tx, entry) => {
      steps.push(`audit:${entry.action}`);
      recordedAudits.push({ tx, entry });
    },
    onAfterCommitError: (e, meta) => onAfterCommitErrorFn(e, meta),
  };

  let checkPermissionFn = (
    actor: TestActor,
    permission: string,
    scope?: { departmentId?: string },
  ) => {
    steps.push(`perm:check:${permission}`);
    if (!actor.permissions?.has(permission)) {
      const err = new Error("FORBIDDEN");
      err.name = "ForbiddenError";
      throw err;
    }
    if (scope?.departmentId && !actor.departmentIds?.includes(scope.departmentId)) {
      const err = new Error("FORBIDDEN");
      err.name = "ForbiddenError";
      throw err;
    }
  };

  let onAfterCommitErrorFn = (e: unknown, meta: { action: string }) => {
    steps.push(`afterCommitError:${meta.action}`);
    afterCommitErrors.push({ error: e, meta });
  };

  return {
    deps,
    steps,
    recordedAudits,
    afterCommitErrors,
    recordedTxOptions,
    getLastTxOptions: () => recordedTxOptions[recordedTxOptions.length - 1],
    setCheckPermission: (
      fn: (actor: TestActor, permission: string, scope?: { departmentId?: string }) => void,
    ) => {
      checkPermissionFn = fn;
    },
    setOnAfterCommitError: (fn: (e: unknown, meta: { action: string }) => void) => {
      onAfterCommitErrorFn = fn;
    },
    fakeTx,
    fakeReader,
    getTxOpen: () => txOpen,
    getTxCommitted: () => txCommitted,
    getTxRolledBack: () => txRolledBack,
  };
}

describe("Aspect Engine — Pipeline Order and Guarantees (§3.1, §7)", () => {
  it("executes the pipeline in the strict unconfigurable order", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.execute",
      input: z.object({
        val: z.string().min(3),
      }),
      permission: "order.edit",
      prepare: async ({ actor, input }) => {
        fakes.steps.push(`prepare:${input.val}`);
        return { preparedVal: input.val.toUpperCase() };
      },
      authorize: async (ctx) => {
        fakes.steps.push(`authorize:${ctx.prepared.preparedVal}`);
        ctx.check("order.edit", { departmentId: "dept-1" });
      },
      run: async (ctx) => {
        fakes.steps.push(`run:${ctx.prepared.preparedVal}`);
        ctx.afterCommit(async () => {
          fakes.steps.push("afterCommit:hook-1");
        });
        ctx.afterCommit(async () => {
          fakes.steps.push("afterCommit:hook-2");
        });
        return {
          value: { outputText: ctx.prepared.preparedVal },
          audit: [
            {
              action: "test.executed",
              entityType: "Item",
              entityId: "item-1",
            },
          ],
        };
      },
    });

    const actor = makeActor();
    const result = await command(actor, { val: "hello" });

    expect(result).toEqual({
      ok: true,
      data: { outputText: "HELLO" },
    });

    // Verification of fixed order:
    // 1. validation (implicit in Zod parse)
    // 2. static permission
    // 3. prepare
    // 4. tx:open
    // 5. authorize (in tx)
    // 6. run (in tx)
    // 7. audit (in tx)
    // 8. tx:commit
    // 9. afterCommit hooks
    expect(fakes.steps).toEqual([
      "perm:check:order.edit",
      "prepare:hello",
      "tx:open",
      "authorize:HELLO",
      "perm:check:order.edit",
      "run:HELLO",
      "audit:test.executed",
      "tx:commit",
      "afterCommit:hook-1",
      "afterCommit:hook-2",
    ]);

    expect(fakes.getTxCommitted()).toBe(true);
    expect(fakes.getTxRolledBack()).toBe(false);
  });

  it("short-circuits on validation failure before permission, prepare, or transaction", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.validate",
      input: z.object({
        count: z.number().positive(),
      }),
      permission: "order.edit",
      prepare: async () => {
        fakes.steps.push("prepare");
        return undefined;
      },
      run: async () => {
        fakes.steps.push("run");
        return {
          value: 123,
          audit: [{ action: "test.validated", entityType: "X", entityId: "1" }],
        };
      },
    });

    const result = await command(makeActor(), { count: -5 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      if (result.error.code === "VALIDATION") {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0]?.path).toBe("count");
      }
    }

    // Absolutely nothing ran
    expect(fakes.steps).toEqual([]);
    expect(fakes.getTxCommitted()).toBe(false);
  });

  it("denies access at step 2 (static permission) before prepare, tx, or run", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.perm",
      input: z.object({ code: z.string() }),
      permission: "admin.super",
      prepare: async () => {
        fakes.steps.push("prepare");
        return undefined;
      },
      run: async () => {
        fakes.steps.push("run");
        return {
          value: true,
          audit: [{ action: "test.perm", entityType: "X", entityId: "1" }],
        };
      },
    });

    // Actor lacks "admin.super"
    const result = await command(makeActor({ permissions: new Set(["order.edit"]) }), {
      code: "abc",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "FORBIDDEN" },
    });

    // Only static permission check ran; prepare, transaction, and run were NEVER called
    expect(fakes.steps).toEqual(["perm:check:admin.super"]);
    expect(fakes.getTxCommitted()).toBe(false);
    expect(fakes.getTxRolledBack()).toBe(false);
  });

  it("rejects command promise with TypeError when checkPermission throws TypeError, without calling prepare or transaction", async () => {
    const fakes = createFakeDeps();
    const typeError = new TypeError("Unexpected type error in permission check");
    fakes.setCheckPermission(() => {
      fakes.steps.push("perm:check:throw_typeerror");
      throw typeError;
    });

    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.perm_error",
      input: z.object({ code: z.string() }),
      permission: "admin.super",
      prepare: async () => {
        fakes.steps.push("prepare");
        return undefined;
      },
      run: async () => {
        fakes.steps.push("run");
        return {
          value: true,
          audit: [{ action: "test.perm_error", entityType: "X", entityId: "1" }],
        };
      },
    });

    await expect(command(makeActor(), { code: "abc" })).rejects.toThrow(typeError);

    // Prepare and transaction were never called
    expect(fakes.steps).toEqual(["perm:check:throw_typeerror"]);
    expect(fakes.getTxOpen()).toBe(false);
    expect(fakes.getTxCommitted()).toBe(false);
  });
});

describe("Aspect Engine — PermissionSpec Variations (§2, §7)", () => {
  it("supports single permission key", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.single",
      input: z.object({ ok: z.boolean() }),
      permission: "order.edit",
      run: async () => ({
        value: "ok",
        audit: [{ action: "a", entityType: "E", entityId: "1" }],
      }),
    });

    const allowed = await command(makeActor({ permissions: new Set(["order.edit"]) }), {
      ok: true,
    });
    expect(allowed.ok).toBe(true);

    const denied = await command(makeActor({ permissions: new Set(["order.other"]) }), {
      ok: true,
    });
    expect(denied).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("supports any-of list and passes when at least one permission matches", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.anyof",
      input: z.object({}),
      permission: ["admin.all", "order.edit", "designer.all"] as const,
      run: async () => ({
        value: 42,
        audit: [{ action: "a", entityType: "E", entityId: "1" }],
      }),
    });

    // Matches second permission
    const actor = makeActor({ permissions: new Set(["order.edit"]) });
    const res = await command(actor, {});
    expect(res).toEqual({ ok: true, data: 42 });

    // Matches neither
    const actorDenied = makeActor({ permissions: new Set(["other.perm"]) });
    const resDenied = await command(actorDenied, {});
    expect(resDenied).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("supports pure function of parsed input", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.fn",
      input: z.object({ mode: z.enum(["admin", "user"]) }),
      permission: (input) => (input.mode === "admin" ? "admin.full" : "order.view"),
      run: async () => ({
        value: "success",
        audit: [{ action: "a", entityType: "E", entityId: "1" }],
      }),
    });

    const userActor = makeActor({ permissions: new Set(["order.view"]) });

    // Mode "user" requires "order.view" -> passes
    const resUser = await command(userActor, { mode: "user" });
    expect(resUser.ok).toBe(true);

    // Mode "admin" requires "admin.full" -> fails
    const resAdmin = await command(userActor, { mode: "admin" });
    expect(resAdmin).toEqual({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("Aspect Engine — Entity-scoped Authorization in Tx (§3.1, §7)", () => {
  it("runs authorize hook in the same transaction as run and rolls back on denial", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.entity_auth",
      input: z.object({ targetDept: z.string() }),
      permission: "order.edit",
      authorize: (ctx) => {
        // Scoped check inside tx
        ctx.check("order.edit", { departmentId: ctx.input.targetDept });
      },
      run: async () => {
        fakes.steps.push("run");
        return {
          value: true,
          audit: [{ action: "a", entityType: "E", entityId: "1" }],
        };
      },
    });

    // Actor has dept-1, request asks for dept-2
    const actor = makeActor({
      permissions: new Set(["order.edit"]),
      departmentIds: ["dept-1"],
    });

    const result = await command(actor, { targetDept: "dept-2" });

    expect(result).toEqual({
      ok: false,
      error: { code: "FORBIDDEN" },
    });

    // Transaction was opened, authorize failed, and transaction was rolled back. Run never executed.
    expect(fakes.steps).toContain("tx:open");
    expect(fakes.steps).toContain("tx:rollback");
    expect(fakes.steps).not.toContain("run");
    expect(fakes.getTxCommitted()).toBe(false);
    expect(fakes.getTxRolledBack()).toBe(true);
  });

  it("passes the same transaction to authorize, run, and audit recording on success", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    let authorizeTx: Tx | undefined;
    let runTx: Tx | undefined;

    const command = aspects.defineCommand({
      action: "test.entity_auth_success",
      input: z.object({ targetDept: z.string() }),
      permission: "order.edit",
      authorize: (ctx) => {
        authorizeTx = ctx.tx;
        expect(ctx.tx).toBe(fakes.fakeTx);
        ctx.check("order.edit", { departmentId: ctx.input.targetDept });
      },
      run: async (ctx) => {
        runTx = ctx.tx;
        expect(ctx.tx).toBe(fakes.fakeTx);
        return {
          value: "auth-success",
          audit: [{ action: "audit.auth_success", entityType: "Order", entityId: "order-1" }],
        };
      },
    });

    const actor = makeActor({
      permissions: new Set(["order.edit"]),
      departmentIds: ["dept-1"],
    });

    const res = await command(actor, { targetDept: "dept-1" });
    expect(res).toEqual({ ok: true, data: "auth-success" });
    expect(authorizeTx).toBe(fakes.fakeTx);
    expect(runTx).toBe(fakes.fakeTx);
    expect(fakes.recordedAudits).toHaveLength(1);
    expect(fakes.recordedAudits[0]?.tx).toBe(fakes.fakeTx);
  });

  it("constructs CoreActor with branded UserId and attaches to CommandCtx", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    let inspectedCoreActor: unknown;

    const command = aspects.defineCommand({
      action: "test.core_actor",
      input: z.object({}),
      permission: "order.view",
      run: async (ctx) => {
        inspectedCoreActor = ctx.coreActor;
        return {
          value: true,
          audit: [{ action: "a", entityType: "E", entityId: "1" }],
        };
      },
    });

    const actor = makeActor({
      userId: "user-abc",
      roles: ["admin", "super"],
      departmentIds: ["dept-xyz"],
    });

    await command(actor, {});

    expect(inspectedCoreActor).toEqual({
      userId: "user-abc",
      roles: ["admin", "super"],
      departmentIds: ["dept-xyz"],
    });
  });
});

describe("Aspect Engine — Audit Guarantees and allowNoChange (§3.1, §7)", () => {
  it("writes audit entries in tx and forces actorId from the actor", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "order.update",
      input: z.object({}),
      permission: "order.edit",
      run: async () => ({
        value: { updated: true },
        audit: [
          {
            action: "order.field_changed",
            entityType: "Order",
            entityId: "order-1",
            before: { status: "A" },
            after: { status: "B" },
            // Even if an entry claims a forged actorId:
            ...({ actorId: "forged-id" } as unknown as object),
          },
        ],
      }),
    });

    const actor = makeActor({ userId: "real-actor-id" });
    const result = await command(actor, {});

    expect(result.ok).toBe(true);
    expect(fakes.recordedAudits).toHaveLength(1);
    expect(fakes.recordedAudits[0]?.entry.actorId).toBe("real-actor-id");
    expect(fakes.recordedAudits[0]?.tx).toBe(fakes.fakeTx);
  });

  it("raises AspectMisuseError when outcome has empty audit list and allowNoChange is falsy", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "order.bad_audit",
      input: z.object({}),
      permission: "order.edit",
      run: async () =>
        // Cast to bypass compile-time non-empty tuple check to verify runtime enforcement
        ({
          value: 123,
          audit: [] as unknown as readonly [AuditEntry, ...AuditEntry[]],
        }),
    });

    await expect(command(makeActor(), {})).rejects.toThrowError(AspectMisuseError);
    expect(fakes.getTxRolledBack()).toBe(true);
  });

  it("accepts noChange: true only when allowNoChange: true", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    // 1. allowNoChange: true
    const validCommand = aspects.defineCommand({
      action: "order.noop_allowed",
      input: z.object({}),
      permission: "order.edit",
      allowNoChange: true,
      run: async () => ({
        value: "nothing-changed",
        noChange: true,
      }),
    });

    const resValid = await validCommand(makeActor(), {});
    expect(resValid).toEqual({ ok: true, data: "nothing-changed" });
    expect(fakes.recordedAudits).toHaveLength(0);

    // 2. allowNoChange not enabled (falsy)
    const invalidCommand = aspects.defineCommand({
      action: "order.noop_disallowed",
      input: z.object({}),
      permission: "order.edit",
      allowNoChange: false,
      run: async () =>
        // Cast to verify runtime enforcement
        ({
          value: "nothing-changed",
          noChange: true,
        }) as unknown as { value: string; audit: readonly [AuditEntry, ...AuditEntry[]] },
    });

    await expect(invalidCommand(makeActor(), {})).rejects.toThrowError(AspectMisuseError);
    expect(fakes.getTxRolledBack()).toBe(true);
  });
});

describe("Aspect Engine — afterCommit Hooks (§3.1, §7)", () => {
  it("runs afterCommit hooks only after commit, and not at all on rollback", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    let hookExecuted = false;

    const failingCommand = aspects.defineCommand({
      action: "test.fail_rollback",
      input: z.object({}),
      permission: "order.edit",
      run: async (ctx) => {
        ctx.afterCommit(async () => {
          hookExecuted = true;
        });
        return fail<TestModuleError>({ code: "ITEM_LOCKED" });
      },
    });

    const res = await failingCommand(makeActor(), {});
    expect(res.ok).toBe(false);
    expect(hookExecuted).toBe(false);
    expect(fakes.getTxRolledBack()).toBe(true);
  });

  it("still returns ok if an afterCommit hook throws, and logs through onAfterCommitError", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const hookError = new Error("External webhook failed");

    const command = aspects.defineCommand({
      action: "order.with_failing_hook",
      input: z.object({}),
      permission: "order.edit",
      run: async (ctx) => {
        ctx.afterCommit(async () => {
          throw hookError;
        });
        return {
          value: { id: "committed-item" },
          audit: [{ action: "a", entityType: "E", entityId: "1" }],
        };
      },
    });

    const res = await command(makeActor(), {});

    // Command still returns ok because transaction is already committed
    expect(res).toEqual({ ok: true, data: { id: "committed-item" } });
    expect(fakes.afterCommitErrors).toHaveLength(1);
    expect(fakes.afterCommitErrors[0]?.error).toBe(hookError);
    expect(fakes.afterCommitErrors[0]?.meta.action).toBe("order.with_failing_hook");
  });

  it("runs hook 2 when hook 1 throws (in order), and ignores throwing error reporter without turning result into exception", async () => {
    const fakes = createFakeDeps();
    fakes.setOnAfterCommitError(() => {
      fakes.steps.push("reporter:threw");
      throw new Error("Reporter explosion");
    });

    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const executionOrder: string[] = [];

    const command = aspects.defineCommand({
      action: "order.throwing_hooks",
      input: z.object({}),
      permission: "order.edit",
      run: async (ctx) => {
        ctx.afterCommit(async () => {
          executionOrder.push("hook-1");
          throw new Error("Hook 1 failed");
        });
        ctx.afterCommit(async () => {
          executionOrder.push("hook-2");
        });
        return {
          value: { status: "committed" },
          audit: [{ action: "a", entityType: "E", entityId: "1" }],
        };
      },
    });

    const res = await command(makeActor(), {});

    expect(res).toEqual({ ok: true, data: { status: "committed" } });
    expect(executionOrder).toEqual(["hook-1", "hook-2"]);
    expect(fakes.steps).toContain("reporter:threw");
  });

  it("throws AspectMisuseError if ctx.afterCommit is called after transaction has settled", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    let leakedCtx: { afterCommit: (h: () => Promise<void>) => void } | undefined;

    const command = aspects.defineCommand({
      action: "order.leak_ctx",
      input: z.object({}),
      permission: "order.edit",
      run: async (ctx) => {
        leakedCtx = ctx;
        return {
          value: { id: "ok" },
          audit: [{ action: "a", entityType: "E", entityId: "1" }],
        };
      },
    });

    const res = await command(makeActor(), {});
    expect(res.ok).toBe(true);

    expect(() => {
      leakedCtx?.afterCommit(async () => {});
    }).toThrowError(AspectMisuseError);
  });
});

describe("Aspect Engine — .inTx Composition (§3.1, §7)", () => {
  it("composes child command inside outer transaction and forwards afterCommit hooks", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const childCommand = aspects.defineCommand({
      action: "child.action",
      input: z.object({ amount: z.number() }),
      permission: "order.edit",
      run: async (ctx) => {
        fakes.steps.push(`child:run:${ctx.input.amount}`);
        ctx.afterCommit(async () => {
          fakes.steps.push("child:afterCommit");
        });
        return {
          value: ctx.input.amount * 2,
          audit: [{ action: "child.audited", entityType: "Child", entityId: "c1" }],
        };
      },
    });

    const parentCommand = aspects.defineCommand({
      action: "parent.action",
      input: z.object({ base: z.number() }),
      permission: "order.edit",
      run: async (ctx) => {
        fakes.steps.push(`parent:run:${ctx.input.base}`);
        // Compose child inside parent transaction via inTx
        const childOutput = await childCommand.inTx(ctx, ctx.actor, { amount: ctx.input.base + 10 });
        ctx.afterCommit(async () => {
          fakes.steps.push("parent:afterCommit");
        });
        return {
          value: { total: childOutput },
          audit: [{ action: "parent.audited", entityType: "Parent", entityId: "p1" }],
        };
      },
    });

    const actor = makeActor();
    const result = await parentCommand(actor, { base: 5 });

    expect(result).toEqual({
      ok: true,
      data: { total: 30 },
    });

    // Parent opened tx once, both audits recorded in same tx, both afterCommit hooks ran once after outer commit
    expect(fakes.steps).toEqual([
      "perm:check:order.edit",
      "tx:open",
      "parent:run:5",
      "perm:check:order.edit",
      "child:run:15",
      "audit:child.audited",
      "audit:parent.audited",
      "tx:commit",
      "child:afterCommit",
      "parent:afterCommit",
    ]);
  });

  it("throws AspectDomainError inside inTx so outer transaction rolls back", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    let childHookRan = false;
    const childFailing = aspects.defineCommand({
      action: "child.fail",
      input: z.object({}),
      permission: "order.edit",
      run: async (ctx) => {
        ctx.afterCommit(async () => {
          childHookRan = true;
        });
        return fail<TestModuleError>({ code: "ITEM_LOCKED" });
      },
    });

    const parent = aspects.defineCommand({
      action: "parent.calls_failing_child",
      input: z.object({}),
      permission: "order.edit",
      run: async (ctx) => {
        await childFailing.inTx(ctx, ctx.actor, {});
        return {
          value: "never-reached",
          audit: [{ action: "a", entityType: "E", entityId: "1" }],
        };
      },
    });

    const result = await parent(makeActor(), {});

    expect(result).toEqual({
      ok: false,
      error: { code: "ITEM_LOCKED" },
    });
    expect(childHookRan).toBe(false);
    expect(fakes.recordedAudits).toHaveLength(0);
    expect(fakes.getTxRolledBack()).toBe(true);
  });

  it("prevents calling inTx on commands with prepare", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const commandWithPrepare = aspects.defineCommand({
      action: "with.prepare",
      input: z.object({}),
      permission: "order.edit",
      prepare: async () => ({ staged: 123 }),
      run: async (ctx) => ({
        value: ctx.prepared.staged,
        audit: [{ action: "a", entityType: "E", entityId: "1" }],
      }),
    });

    const fakeScope = {
      tx: fakes.fakeTx,
      afterCommit: () => {
        /* noop */
      },
    };

    // TypeScript prevents calling commandWithPrepare.inTx at compile time (typed as `never`).
    // Assert that runtime invocation also throws AspectMisuseError.
    const inTxCallable = (commandWithPrepare as unknown as { inTx: (s: unknown, a: unknown, i: unknown) => Promise<unknown> }).inTx;
    await expect(inTxCallable(fakeScope, makeActor(), {})).rejects.toThrowError(AspectMisuseError);
  });

  it("passes txOptions through to deps.transaction", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.tx_options",
      input: z.object({}),
      permission: "order.edit",
      txOptions: { timeout: 12345, isolationLevel: "Serializable" },
      run: async () => ({
        value: "ok",
        audit: [{ action: "a", entityType: "E", entityId: "1" }],
      }),
    });

    const res = await command(makeActor(), {});
    expect(res).toEqual({ ok: true, data: "ok" });
    expect(fakes.getLastTxOptions()).toEqual({
      ...DEFAULT_TX_OPTIONS,
      timeout: 12345,
      isolationLevel: "Serializable",
    });
  });
});

describe("Aspect Engine — Error Mapping Table (§3.2, §7)", () => {
  it("Row 1: maps ZodError to VALIDATION { issues }", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.zod",
      input: z.object({ email: z.string().email() }),
      permission: "order.view",
      run: async () => ({
        value: true,
        audit: [{ action: "a", entityType: "E", entityId: "1" }],
      }),
    });

    const res = await command(makeActor(), { email: "not-an-email" });
    expect(res).toEqual({
      ok: false,
      error: {
        code: "VALIDATION",
        issues: [{ path: "email", message: "Invalid email" }],
      },
    });
  });

  it("Row 2: maps deps.isForbidden(e) to FORBIDDEN", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.forbid",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const err = new Error("Access Denied");
        err.name = "ForbiddenError";
        throw err;
      },
    });

    const res = await command(makeActor(), {});
    expect(res).toEqual({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("Row 3: maps AspectDomainError (via fail()) to typed domain error", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.fail",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        return fail<TestModuleError>({ code: "ITEM_LOCKED", details: { reason: "maintenance" } });
      },
    });

    const res = await command(makeActor(), {});
    expect(res).toEqual({
      ok: false,
      error: { code: "ITEM_LOCKED", details: { reason: "maintenance" } },
    });
  });

  it("Row 4: maps TransitionFailure with VALIDATION to VALIDATION { issues: [{ path: '', message }] }", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.trans_val",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const domainErr: DomainError = {
          code: "VALIDATION",
          message: "Work Item wi-1 does not exist.",
        };
        throw new TransitionFailure("wi-1", domainErr);
      },
    });

    const res = await command(makeActor(), {});
    expect(res).toEqual({
      ok: false,
      error: {
        code: "VALIDATION",
        issues: [{ path: "", message: "Work Item wi-1 does not exist." }],
      },
    });
  });

  it("Row 5: maps TransitionFailure with INVALID_TRANSITION and expectedFrom to CONFLICT { entity: 'WorkItem', id }", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.trans_conflict",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const domainErr: DomainError = {
          code: "INVALID_TRANSITION",
          message: "Work Item state changed concurrently.",
          details: { expectedFrom: "NEW", to: "IN_PROGRESS" },
        };
        throw new TransitionFailure("wi-99", domainErr);
      },
    });

    const res = await command(makeActor(), {});
    expect(res).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        entity: "WorkItem",
        id: "wi-99",
      },
    });
  });

  it("Row 6: maps TransitionFailure with INVALID_TRANSITION and no expectedFrom to INVALID_STATE", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const command = aspects.defineCommand({
      action: "test.trans_invalid_state",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const domainErr: DomainError = {
          code: "INVALID_TRANSITION",
          message: "Transition not allowed.",
          details: { from: "CANCELLED", to: "COMPLETED" },
        };
        throw new TransitionFailure("wi-88", domainErr);
      },
    });

    const res = await command(makeActor(), {});
    expect(res).toEqual({
      ok: false,
      error: {
        code: "INVALID_STATE",
        workItemIds: ["wi-88"],
        expected: [],
      },
    });
  });

  it("Row 7: maps TransitionFailure with GUARD_FAILED through mapGuardFailure or falls back to base GUARD_FAILED", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
      mapGuardFailure: (guardCode, details) => {
        if (guardCode === "PRICING_UNRESOLVED") {
          return { code: "CUSTOM_GUARD_FAILED", details };
        }
        return undefined;
      },
    });

    // 7a: mapped guard failure
    const cmdMapped = aspects.defineCommand({
      action: "test.guard_mapped",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const domainErr: DomainError = {
          code: "GUARD_FAILED",
          message: "Pricing is required.",
          details: { guardCode: "PRICING_UNRESOLVED", quoteId: "q-1" },
        };
        throw new TransitionFailure("wi-1", domainErr);
      },
    });

    const resMapped = await cmdMapped(makeActor(), {});
    expect(resMapped).toEqual({
      ok: false,
      error: {
        code: "CUSTOM_GUARD_FAILED",
        details: { guardCode: "PRICING_UNRESOLVED", quoteId: "q-1" },
      },
    });

    // 7b: unmapped guard failure falls back to base GUARD_FAILED
    const cmdUnmapped = aspects.defineCommand({
      action: "test.guard_unmapped",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const domainErr: DomainError = {
          code: "GUARD_FAILED",
          message: "Capacity exceeded.",
          details: { guardCode: "CAPACITY_FULL" },
        };
        throw new TransitionFailure("wi-2", domainErr);
      },
    });

    const resUnmapped = await cmdUnmapped(makeActor(), {});
    expect(resUnmapped).toEqual({
      ok: false,
      error: {
        code: "GUARD_FAILED",
        guardCode: "CAPACITY_FULL",
        message: "Capacity exceeded.",
      },
    });
  });

  it("Row 8: maps Prisma P2002 unique violation through mapUniqueViolation or falls back to CONFLICT", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
      mapUniqueViolation: (target) => {
        if (target.includes("code")) {
          return { code: "DUPLICATE_CODE" };
        }
        return undefined;
      },
    });

    // 8a: mapped unique violation
    const cmdMapped = aspects.defineCommand({
      action: "test.p2002_mapped",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const p2002 = {
          code: "P2002",
          meta: { target: ["code"], modelName: "Product" },
        };
        throw p2002;
      },
    });

    const resMapped = await cmdMapped(makeActor(), {});
    expect(resMapped).toEqual({
      ok: false,
      error: { code: "DUPLICATE_CODE" },
    });

    // 8b: unmapped unique violation falls back to CONFLICT
    const cmdUnmapped = aspects.defineCommand({
      action: "test.p2002_unmapped",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        const p2002 = {
          code: "P2002",
          meta: { target: ["phone"], modelName: "Customer" },
        };
        throw p2002;
      },
    });

    const resUnmapped = await cmdUnmapped(makeActor(), {});
    expect(resUnmapped).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        entity: "Customer",
        id: "",
      },
    });
  });

  it("Row 8c: passes modelName to mapUniqueViolation", async () => {
    let capturedTarget: readonly string[] | undefined;
    let capturedModel: string | undefined;

    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
      mapUniqueViolation: (target, modelName) => {
        capturedTarget = target;
        capturedModel = modelName;
        if (modelName === "SpecialModel" && target.includes("code")) {
          return { code: "DUPLICATE_CODE" };
        }
        return undefined;
      },
    });

    const cmd = aspects.defineCommand({
      action: "test.p2002_model_name",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw {
          code: "P2002",
          meta: { target: ["code"], modelName: "SpecialModel" },
        };
      },
    });

    const res = await cmd(makeActor(), {});
    expect(capturedTarget).toEqual(["code"]);
    expect(capturedModel).toBe("SpecialModel");
    expect(res).toEqual({
      ok: false,
      error: { code: "DUPLICATE_CODE" },
    });
  });

  it("Row 9: re-throws unknown errors and rolls back transaction", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const fatalError = new TypeError("Cannot read property of undefined");

    const command = aspects.defineCommand({
      action: "test.fatal",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw fatalError;
      },
    });

    await expect(command(makeActor(), {})).rejects.toThrowError(fatalError);
    expect(fakes.getTxRolledBack()).toBe(true);
  });
});

describe("Aspect Engine — Query Pipeline (§3.1, §7)", () => {
  it("runs query on reader without transaction and writes no audit", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const query = aspects.defineQuery({
      input: z.object({ id: z.string() }),
      permission: "order.view",
      authorize: (c) => {
        expect(c.client).toBe(fakes.fakeReader);
        c.check("order.view", { departmentId: "dept-1" });
      },
      run: async (c) => {
        expect(c.client).toBe(fakes.fakeReader);
        expect(c.coreActor.userId).toBe("user-123");
        return { item: c.input.id, found: true };
      },
    });

    const res = await query(makeActor(), { id: "item-42" });

    expect(res).toEqual({
      ok: true,
      data: { item: "item-42", found: true },
    });

    // Reader was used; no transaction opened, no audit written
    expect(fakes.steps).toEqual(["perm:check:order.view", "perm:check:order.view"]);
    expect(fakes.recordedAudits).toHaveLength(0);
    expect(fakes.getTxCommitted()).toBe(false);
  });

  it("runs consistent query inside transaction when consistent: true", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const consistentQuery = aspects.defineQuery({
      input: z.object({}),
      permission: "order.view",
      consistent: true,
      run: async (c) => {
        expect(c.client).toBe(fakes.fakeTx);
        return "consistent-read";
      },
    });

    const res = await consistentQuery(makeActor(), {});

    expect(res).toEqual({ ok: true, data: "consistent-read" });
    expect(fakes.steps).toEqual(["perm:check:order.view", "tx:open", "tx:commit"]);
    expect(fakes.getLastTxOptions()).toEqual({
      ...DEFAULT_TX_OPTIONS,
      isolationLevel: "RepeatableRead",
    });
  });

  it("maps query domain errors via fail() and re-throws unknown errors", async () => {
    const fakes = createFakeDeps();
    const aspects = createAspects<TestActor, string>(fakes.deps).forModule<TestModuleError>({
      module: "test-module",
    });

    const notFoundQuery = aspects.defineQuery({
      input: z.object({ id: z.string() }),
      permission: "order.view",
      run: async (c) => {
        fail({ code: "NOT_FOUND", entity: "Order", id: c.input.id });
      },
    });

    const res = await notFoundQuery(makeActor(), { id: "ord-99" });
    expect(res).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", entity: "Order", id: "ord-99" },
    });
  });
});

describe("transitionOrThrow (§3.3)", () => {
  it("converts actor to coreActor, calls transitionWorkItem, and returns TransitionOutcome on success", async () => {
    const fakeTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ state: "NEW" }]),
      workItem: {
        findUnique: vi.fn().mockResolvedValue({ id: "wi-10", state: "NEW" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "wi-10",
          orderId: "ord-1",
          productTypeId: null,
          departmentId: null,
          state: "ASSIGNED",
          requiresDesign: false,
          requiresReview: false,
          assigneeId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      phaseTiming: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      workItemTransition: {
        create: vi.fn().mockResolvedValue({}),
      },
      notificationEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Tx;

    const outcome = await transitionOrThrow(fakeTx, {
      workItemId: "wi-10",
      to: "ASSIGNED",
      actor: { userId: "user-trans" },
    });

    expect(outcome).toEqual({
      from: "NEW",
      to: "ASSIGNED",
    });
  });

  it("proves from comes from the locked $queryRaw read", async () => {
    const queryRawMock = vi.fn().mockResolvedValue([{ state: "IN_DESIGN" }]);
    const fakeTx = {
      $queryRaw: queryRawMock,
      workItem: {
        findUnique: vi.fn().mockResolvedValue({ id: "wi-10", state: "ASSIGNED" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "wi-10",
          orderId: "ord-1",
          productTypeId: null,
          departmentId: null,
          state: "IN_DESIGN",
          requiresDesign: false,
          requiresReview: false,
          assigneeId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      phaseTiming: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      workItemTransition: {
        create: vi.fn().mockResolvedValue({}),
      },
      notificationEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Tx;

    const outcome = await transitionOrThrow(fakeTx, {
      workItemId: "wi-10",
      to: "IN_DESIGN",
      actor: { userId: "user-trans" },
    });

    expect(queryRawMock).toHaveBeenCalled();
    const [strings] = queryRawMock.mock.calls[0] ?? [];
    expect(String(strings)).toContain('SELECT "state" FROM "WorkItem" WHERE "id" =');
    expect(String(strings)).toContain("FOR UPDATE");
    expect(outcome.from).toBe("IN_DESIGN");
    expect(outcome.to).toBe("IN_DESIGN");
  });

  it("throws TransitionFailure when transitionWorkItem returns domain error", async () => {
    const fakeTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workItem: {
        findUnique: vi.fn().mockResolvedValue(null), // WorkItem does not exist
      },
    } as unknown as Tx;

    await expect(
      transitionOrThrow(fakeTx, {
        workItemId: "wi-nonexistent",
        to: "ASSIGNED",
        actor: { userId: "user-trans" },
      }),
    ).rejects.toThrowError(TransitionFailure);
  });

  it("throws AspectMisuseError when meta is not a plain object", async () => {
    const fakeTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ state: "NEW" }]),
    } as unknown as Tx;

    await expect(
      transitionOrThrow(fakeTx, {
        workItemId: "wi-10",
        to: "ASSIGNED",
        actor: { userId: "user-trans" },
        // Deliberate invalid runtime value for negative test
        meta: "not-an-object" as unknown as TransitionOrThrowInput["meta"],
      }),
    ).rejects.toThrowError(AspectMisuseError);

    await expect(
      transitionOrThrow(fakeTx, {
        workItemId: "wi-10",
        to: "ASSIGNED",
        actor: { userId: "user-trans" },
        // Deliberate invalid runtime value for negative test
        meta: [1, 2, 3] as unknown as TransitionOrThrowInput["meta"],
      }),
    ).rejects.toThrowError(AspectMisuseError);
  });
});

describe("Architectural Rule (a) — Module Boundary Verification (§1, §7)", () => {
  it("guarantees src/server/core/aspects/** contains no import from ~/server/* outside core", () => {
    const aspectsDir = path.resolve(process.cwd(), "src/server/core/aspects");
    const files = fs.readdirSync(aspectsDir);

    expect(files.length).toBeGreaterThanOrEqual(4);

    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const content = fs.readFileSync(path.join(aspectsDir, file), "utf-8");

      // Verify no import of ~/server/auth, ~/server/db, or any other non-core feature
      const restrictedAliasImports = content.match(/from\s+["'](~\/server\/(?!core)[^"']+)["']/g);
      expect(
        restrictedAliasImports,
        `File ${file} must not import from outside core via ~/server/ (Rule (a))`,
      ).toBeNull();

      // Verify no relative imports reaching outside core into other server modules (e.g. ../../auth, ../../db)
      const relativeFeatureImports = content.match(
        /from\s+["'](?:\.\.\/)+(?:auth|db|orders|review|production|customers|better-auth|admin)[^"']*["']/g,
      );
      expect(
        relativeFeatureImports,
        `File ${file} must not deep-import outside core via relative paths`,
      ).toBeNull();
    }
  });
});
