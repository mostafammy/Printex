// tests/integration/changes/pricingReset.test.ts
// Acceptance criterion 3: an approved change resets pricing, atomically.
// tasks.md T060, spec US5-1/3/4, FR-022/023, contracts/events-and-ports.md §1.
//
// 051's model does not exist yet, so a stand-in "pricing.reset" listener
// writes an audit_event marker through the provided tx for "priced" items.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "../../../generated/prisma";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import { fail } from "~/server/core";
import { approveChangeRequest, createChangeRequest } from "~/server/changes";
import {
  __resetSpecChangeListenersForTests,
  registerSpecChangeListener,
} from "~/server/changes/events";
import {
  approverActor,
  createProductionItem,
  receptionActor,
  type ProductionItem,
} from "./productionFactory";

afterAll(async () => {
  await testDb.$disconnect();
});

const priced = new Set<string>();
const seenTx: Prisma.TransactionClient[] = [];

function registerStandInPricing(): void {
  registerSpecChangeListener("pricing.reset", async (tx, event) => {
    seenTx.push(tx);
    if (!priced.has(event.workItemId)) return;
    await tx.auditEvent.create({
      data: {
        action: "test.pricing_pending",
        entityType: "WorkItem",
        entityId: event.workItemId,
        actorId: event.actorId,
      },
    });
  });
}

beforeEach(() => {
  __resetSpecChangeListenersForTests();
  priced.clear();
  seenTx.length = 0;
});

async function pendingItem(): Promise<{ item: ProductionItem; crId: string }> {
  const item = await createProductionItem();
  const res = await createChangeRequest(receptionActor(await seedUser()), {
    workItemId: item.workItemId,
    patch: { quantity: 900 },
    reason: "customer called",
  });
  if (!res.ok) throw new Error(`create failed: ${res.error.code}`);
  return { item, crId: res.data.changeRequestId };
}

const approve = async (crId: string) =>
  approveChangeRequest(approverActor(await seedUser()), {
    changeRequestId: crId,
    outcome: "CONTINUE_PRODUCTION",
  });

async function snapshot(item: ProductionItem, crId: string) {
  const [versions, cr, wi, audits, notifications] = await Promise.all([
    testDb.specVersion.count({ where: { workItemId: item.workItemId } }),
    testDb.changeRequest.findUniqueOrThrow({ where: { id: crId } }),
    testDb.workItem.findUniqueOrThrow({ where: { id: item.workItemId } }),
    testDb.auditEvent.count({
      where: { entityId: { in: [item.workItemId, crId] } },
    }),
    testDb.notificationEvent.count({
      where: { entityId: { in: [item.workItemId, crId] } },
    }),
  ]);
  return {
    versions,
    status: cr.status,
    state: wi.state,
    quantity: wi.quantity,
    audits,
    notifications,
  };
}

describe("T060 — pricing reset hook", () => {
  it("a priced item gets the marker and v2 committed together, through the same tx (US5-1)", async () => {
    registerStandInPricing();
    const { item, crId } = await pendingItem();
    priced.add(item.workItemId);

    const res = await approve(crId);
    expect(res.ok).toBe(true);

    expect(
      await testDb.specVersion.count({
        where: { workItemId: item.workItemId },
      }),
    ).toBe(2);
    const marker = await testDb.auditEvent.findMany({
      where: { action: "test.pricing_pending", entityId: item.workItemId },
    });
    expect(marker).toHaveLength(1);

    // The listener got a transaction client, not the global client, and the
    // version write happened on it: the marker exists iff v2 does.
    expect(seenTx).toHaveLength(1);
    expect(seenTx[0]).not.toBe(testDb);
    expect(
      typeof (seenTx[0] as unknown as { $transaction?: unknown }).$transaction,
    ).toBe("undefined");
  });

  it("an unpriced item is left alone", async () => {
    registerStandInPricing();
    const { item, crId } = await pendingItem();
    expect((await approve(crId)).ok).toBe(true);
    expect(
      await testDb.auditEvent.count({
        where: { action: "test.pricing_pending", entityId: item.workItemId },
      }),
    ).toBe(0);
  });

  it("a typed veto rolls everything back and reaches the caller as SPEC_CHANGE_VETOED (US5-3)", async () => {
    const { item, crId } = await pendingItem();
    const before = await snapshot(item, crId);
    registerSpecChangeListener("pricing.reset", async () => {
      fail({
        code: "SPEC_CHANGE_VETOED",
        listener: "pricing.reset",
        reason: "inconsistent",
      });
    });

    const res = await approve(crId);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("SPEC_CHANGE_VETOED");

    expect(await snapshot(item, crId)).toEqual({
      ...before,
      status: "PENDING",
    });
  });

  it("a plain throw rolls everything back and is re-thrown (FR-022)", async () => {
    const { item, crId } = await pendingItem();
    const before = await snapshot(item, crId);
    registerSpecChangeListener("pricing.reset", async () => {
      throw new Error("pricing exploded");
    });

    await expect(approve(crId)).rejects.toThrow("pricing exploded");
    expect(await snapshot(item, crId)).toEqual({
      ...before,
      status: "PENDING",
    });
  });

  it("with no listener registered, approval succeeds (US5-4, FR-023)", async () => {
    const { item, crId } = await pendingItem();
    expect((await approve(crId)).ok).toBe(true);
    expect(
      await testDb.specVersion.count({
        where: { workItemId: item.workItemId },
      }),
    ).toBe(2);
  });
});
