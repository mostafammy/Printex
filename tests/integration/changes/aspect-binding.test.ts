// tests/integration/changes/aspect-binding.test.ts
// Integration test for 016 changes aspect binding against real database.
// contracts/aspects.md §5, research.md §11 (tasks.md T017).
//
// NOTE: Must NOT be run until T002 schema migration has been applied to the database.
// It also requires prisma/manual-sql/016-change-control-constraints.sql.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedOrder,
  seedUser,
  seedWorkItem,
} from "../../helpers/seed";
import { defineCommand } from "~/server/changes/aspect";
import {
  SPEC_CHANGED,
  emitSpecChangedInTx,
  registerSpecChangeListener,
  __resetSpecChangeListenersForTests,
} from "~/server/changes/events";
import { err, fail, registerGuard } from "~/server/core";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

function makeActor(userId: string): Actor {
  return {
    userId,
    roles: ["ADMIN_OWNER"],
    permissions: new Set([
      "order.edit",
      "order.cancel",
      "change.approve",
      "admin.override",
      "production.operate",
    ]),
    departmentIds: [],
  };
}

describe("016 changes aspect binding (integration, T017)", () => {
  it('maps a guard failure with guardCode "CHANGE_HOLD" to { ok: false, error: { code: "CHANGE_HOLD" } }', async () => {
    // Assumes per-file test isolation; registerGuard mutates the in-memory shared guard registry.
    // Use an edge (ASSIGNED -> IN_DESIGN) that is unguarded anywhere.
    registerGuard({ from: "ASSIGNED", to: "IN_DESIGN" }, async () =>
      err({
        code: "CHANGE_HOLD",
        message: "Item is held for change control",
      }),
    );

    const dummyCommand = defineCommand({
      action: "test.guard_failure",
      input: z.object({ workItemId: z.string() }),
      permission: "order.edit",
      run: async (ctx) => {
        await ctx.transition({
          workItemId: ctx.input.workItemId,
          to: "IN_DESIGN",
          reason: "Testing guard failure mapping",
        });
        return {
          value: null,
          audit: [
            {
              action: "test.succeeded",
              entityType: "WorkItem",
              entityId: ctx.input.workItemId,
            },
          ],
        };
      },
    });

    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "ASSIGNED" });
    const actor = makeActor(userId);

    const result = await dummyCommand(actor, { workItemId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CHANGE_HOLD");
    }
  });

  it("maps a real (workItemId, version) unique violation to STALE_SPEC_VERSION", async () => {
    const dummyCommand = defineCommand({
      action: "test.unique_violation",
      input: z.object({ workItemId: z.string() }),
      permission: "order.edit",
      run: async (ctx) => {
        // First insert of version 1
        await ctx.tx.specVersion.create({
          data: {
            workItemId: ctx.input.workItemId,
            version: 1,
            origin: "INITIAL",
            stateAtCreation: "NEW",
            createdById: ctx.actor.userId,
          },
        });
        // Duplicate insert of version 1 to trigger P2002 @@unique([workItemId, version])
        await ctx.tx.specVersion.create({
          data: {
            workItemId: ctx.input.workItemId,
            version: 1,
            origin: "INITIAL",
            stateAtCreation: "NEW",
            createdById: ctx.actor.userId,
          },
        });
        return {
          value: null,
          audit: [
            {
              action: "test.succeeded",
              entityType: "WorkItem",
              entityId: ctx.input.workItemId,
            },
          ],
        };
      },
    });

    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor = makeActor(userId);

    const result = await dummyCommand(actor, { workItemId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_SPEC_VERSION");
    }
  });

  it("maps a violation of the partial one-PENDING index to CHANGE_REQUEST_PENDING", async () => {
    const dummyCommand = defineCommand({
      action: "test.pending_cr_unique",
      input: z.object({ workItemId: z.string() }),
      permission: "order.edit",
      run: async (ctx) => {
        const v = await ctx.tx.specVersion.create({
          data: {
            workItemId: ctx.input.workItemId,
            version: 1,
            origin: "INITIAL",
            stateAtCreation: "IN_PRODUCTION",
            createdById: ctx.actor.userId,
          },
        });

        // Insert first PENDING ChangeRequest
        await ctx.tx.changeRequest.create({
          data: {
            workItemId: ctx.input.workItemId,
            status: "PENDING",
            baseSpecVersionId: v.id,
            proposedPatch: { quantity: 150 },
            requestReason: "First change request",
            requestedById: ctx.actor.userId,
          },
        });

        // Insert second PENDING ChangeRequest to trigger partial unique index
        await ctx.tx.changeRequest.create({
          data: {
            workItemId: ctx.input.workItemId,
            status: "PENDING",
            baseSpecVersionId: v.id,
            proposedPatch: { quantity: 200 },
            requestReason: "Second change request while first pending",
            requestedById: ctx.actor.userId,
          },
        });

        return {
          value: null,
          audit: [
            {
              action: "test.succeeded",
              entityType: "WorkItem",
              entityId: ctx.input.workItemId,
            },
          ],
        };
      },
    });

    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "IN_PRODUCTION" });
    const actor = makeActor(userId);

    const result = await dummyCommand(actor, { workItemId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CHANGE_REQUEST_PENDING");
    }
  });

  it("maps a listener fail({ code: 'SPEC_CHANGE_VETOED' }) to a typed refusal, and re-throws plain errors while rolling back", async () => {
    const emitCommand = defineCommand({
      action: "test.emit_spec_changed",
      input: z.object({ workItemId: z.string(), orderId: z.string() }),
      permission: "order.edit",
      run: async (ctx) => {
        const v = await ctx.tx.specVersion.create({
          data: {
            workItemId: ctx.input.workItemId,
            version: 2,
            origin: "DIRECT_EDIT",
            stateAtCreation: "NEW",
            createdById: ctx.actor.userId,
          },
        });

        await emitSpecChangedInTx(ctx.tx, {
          type: SPEC_CHANGED,
          workItemId: ctx.input.workItemId,
          orderId: ctx.input.orderId,
          fromVersion: 1,
          toVersion: 2,
          specVersionId: v.id,
          origin: "DIRECT_EDIT",
          changeRequestId: null,
          changedFields: ["quantity"],
          workItemState: "NEW",
          actorId: ctx.actor.userId,
          occurredAt: new Date(),
        });

        return {
          value: null,
          audit: [
            {
              action: "test.succeeded",
              entityType: "WorkItem",
              entityId: ctx.input.workItemId,
            },
          ],
        };
      },
    });

    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor = makeActor(userId);

    // 1. Typed veto
    registerSpecChangeListener("pricing.reset", async () => {
      fail({
        code: "SPEC_CHANGE_VETOED",
        listener: "pricing.reset",
        reason: "Active pricing contract requires lock",
      });
    });

    const typedResult = await emitCommand(actor, { workItemId, orderId });
    expect(typedResult.ok).toBe(false);
    if (!typedResult.ok) {
      expect(typedResult.error.code).toBe("SPEC_CHANGE_VETOED");
      if (typedResult.error.code === "SPEC_CHANGE_VETOED") {
        expect(typedResult.error.listener).toBe("pricing.reset");
        expect(typedResult.error.reason).toBe("Active pricing contract requires lock");
      }
    }

    // Verify rollback
    const versionsAfterVeto = await testDb.specVersion.findMany({
      where: { workItemId, version: 2 },
    });
    expect(versionsAfterVeto).toHaveLength(0);

    // 2. Plain throw
    __resetSpecChangeListenersForTests();
    registerSpecChangeListener("unhandled.error", async () => {
      throw new Error("Simulated infrastructure crash");
    });

    await expect(emitCommand(actor, { workItemId, orderId })).rejects.toThrow(
      "Simulated infrastructure crash",
    );

    // Verify rollback
    const versionsAfterCrash = await testDb.specVersion.findMany({
      where: { workItemId, version: 2 },
    });
    expect(versionsAfterCrash).toHaveLength(0);
  });

  it("rolls back the outer transaction when an in-transaction building block called via .inTx fails", async () => {
    const innerCommand = defineCommand({
      action: "test.inner_command",
      input: z.object({ shouldFail: z.boolean() }),
      permission: "order.edit",
      run: async (ctx) => {
        if (ctx.input.shouldFail) {
          fail({ code: "NO_CHANGES" });
        }
        return {
          value: "inner-ok",
          audit: [
            {
              action: "test.inner_succeeded",
              entityType: "WorkItem",
              entityId: "none",
            },
          ],
        };
      },
    });

    const outerCommand = defineCommand({
      action: "test.outer_command",
      input: z.object({ workItemId: z.string(), shouldFailInner: z.boolean() }),
      permission: "order.edit",
      run: async (ctx) => {
        // Write something in the outer tx
        await ctx.tx.specVersion.create({
          data: {
            workItemId: ctx.input.workItemId,
            version: 99,
            origin: "DIRECT_EDIT",
            stateAtCreation: "NEW",
            createdById: ctx.actor.userId,
          },
        });

        // Call building block via inTx
        await innerCommand.inTx(ctx, ctx.actor, {
          shouldFail: ctx.input.shouldFailInner,
        });

        return {
          value: "outer-ok",
          audit: [
            {
              action: "test.outer_succeeded",
              entityType: "WorkItem",
              entityId: ctx.input.workItemId,
            },
          ],
        };
      },
    });

    const userId = await seedUser();
    const customerId = await seedCustomer();
    const orderId = await seedOrder({ customerId, createdById: userId });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const actor = makeActor(userId);

    const result = await outerCommand(actor, {
      workItemId,
      shouldFailInner: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_CHANGES");
    }

    // Verify outer write rolled back
    const outerWrite = await testDb.specVersion.findMany({
      where: { workItemId, version: 99 },
    });
    expect(outerWrite).toHaveLength(0);

    // Success path (shouldFailInner: false): both outer and inner writes commit
    const successResult = await outerCommand(actor, {
      workItemId,
      shouldFailInner: false,
    });

    expect(successResult.ok).toBe(true);
    if (successResult.ok) {
      expect(successResult.data).toBe("outer-ok");
    }

    const committedWrite = await testDb.specVersion.findMany({
      where: { workItemId, version: 99 },
    });
    expect(committedWrite).toHaveLength(1);
  });
});
