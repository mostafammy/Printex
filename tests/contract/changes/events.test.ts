// tests/contract/changes/events.test.ts
// SPEC_CHANGED: exactly one event per new version, none otherwise, and the
// frozen payload shape. tasks.md T059, contracts/events-and-ports.md §1.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedUser,
  seedOrder,
  seedWorkItem,
} from "../../helpers/seed";
import {
  SPEC_CHANGED,
  SPEC_FIELDS,
  adminOverrideSpec,
  approveChangeRequest,
  createChangeRequest,
  editSpec,
  ensureCurrentSpecVersionInTx,
  rejectChangeRequest,
  runInTxScope,
  withdrawChangeRequest,
  type SpecChangedEvent,
} from "~/server/changes";
import {
  __resetSpecChangeListenersForTests,
  registerSpecChangeListener,
} from "~/server/changes/events";
import { editWorkItem, quickCreateOrder } from "~/server/orders";
import {
  adminActor,
  approverActor,
  createProductionItem,
  receptionActor,
  type ProductionItem,
} from "../../integration/changes/productionFactory";

afterAll(async () => {
  await testDb.$disconnect();
});

let emitted: SpecChangedEvent[];

beforeEach(() => {
  __resetSpecChangeListenersForTests();
  emitted = [];
  registerSpecChangeListener("test.spy", async (_tx, event) => {
    emitted.push(event);
  });
});

const outboxCount = (workItemId: string) =>
  testDb.notificationEvent.count({
    where: { type: SPEC_CHANGED, entityId: workItemId },
  });

async function expectNoEvent(workItemId: string): Promise<void> {
  expect(emitted.filter((e) => e.workItemId === workItemId)).toEqual([]);
  expect(await outboxCount(workItemId)).toBe(0);
}

async function pendingRequest(
  item: ProductionItem,
  quantity = 800,
): Promise<string> {
  const res = await createChangeRequest(receptionActor(await seedUser()), {
    workItemId: item.workItemId,
    patch: { quantity },
    reason: "customer called",
  });
  if (!res.ok) throw new Error(`create failed: ${res.error.code}`);
  return res.data.changeRequestId;
}

describe("T059 — exactly one event per new version", () => {
  it("editSpec emits one event whose payload matches SpecChangedEvent exactly (US5-2)", async () => {
    const item = await createProductionItem({ state: "NEW" });
    const actor = receptionActor(await seedUser());
    const res = await editSpec(actor, {
      workItemId: item.workItemId,
      expectedVersion: 1,
      // Deliberately out of SPEC_FIELDS order: the event must normalise it.
      patch: { material: "Paper", quantity: 700 },
    });
    if (!res.ok) throw new Error(res.error.code);

    const v2 = await testDb.specVersion.findFirstOrThrow({
      where: { workItemId: item.workItemId, version: 2 },
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      type: SPEC_CHANGED,
      workItemId: item.workItemId,
      orderId: item.orderId,
      fromVersion: 1,
      toVersion: 2,
      specVersionId: v2.id,
      origin: "DIRECT_EDIT",
      changeRequestId: null,
      changedFields: SPEC_FIELDS.filter(
        (f) => f === "quantity" || f === "material",
      ),
      workItemState: "NEW",
      actorId: actor.userId,
      occurredAt: expect.any(Date) as Date,
    });
    expect(Object.keys(emitted[0] ?? {}).sort()).toEqual(
      [
        "type",
        "workItemId",
        "orderId",
        "fromVersion",
        "toVersion",
        "specVersionId",
        "origin",
        "changeRequestId",
        "changedFields",
        "workItemState",
        "actorId",
        "occurredAt",
      ].sort(),
    );

    const outbox = await testDb.notificationEvent.findMany({
      where: { type: SPEC_CHANGED, entityId: item.workItemId },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.recipientUserIds).toEqual(
      item.assigneeId ? [item.assigneeId] : [],
    );
    expect(outbox[0]?.recipientDepartmentIds).toEqual([item.departmentId]);
  });

  it("approval emits one CHANGE_REQUEST event carrying the request id and the pre-transition state", async () => {
    const item = await createProductionItem();
    const crId = await pendingRequest(item);
    expect(emitted).toEqual([]);

    const res = await approveChangeRequest(approverActor(await seedUser()), {
      changeRequestId: crId,
      outcome: "REDESIGN",
    });
    if (!res.ok) throw new Error(res.error.code);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      origin: "CHANGE_REQUEST",
      changeRequestId: crId,
      fromVersion: 1,
      toVersion: 2,
      changedFields: ["quantity"],
      // Captured before the redesign transition to REWORK_REQUIRED.
      workItemState: "IN_PRODUCTION",
    });
    expect(await outboxCount(item.workItemId)).toBe(1);
  });
});

describe("T059 — admin override", () => {
  it("an override emits one ADMIN_OVERRIDE event; in production it carries the request id", async () => {
    const after = await createProductionItem({ state: "PRODUCTION_COMPLETED" });
    const res1 = await adminOverrideSpec(adminActor(await seedUser()), {
      workItemId: after.workItemId,
      expectedVersion: 1,
      patch: { quantity: 480 },
      reason: "counted wrong",
    });
    if (!res1.ok) throw new Error(res1.error.code);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ origin: "ADMIN_OVERRIDE", changeRequestId: null });
    expect(await outboxCount(after.workItemId)).toBe(1);

    const inProduction = await createProductionItem();
    const res2 = await adminOverrideSpec(adminActor(await seedUser()), {
      workItemId: inProduction.workItemId,
      expectedVersion: 1,
      patch: { quantity: 520 },
      reason: "customer called the owner",
      outcome: "CONTINUE_PRODUCTION",
    });
    if (!res2.ok) throw new Error(res2.error.code);
    const cr = await testDb.changeRequest.findFirstOrThrow({
      where: { workItemId: inProduction.workItemId, isAdminOverride: true },
    });
    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({ origin: "ADMIN_OVERRIDE", changeRequestId: cr.id });
    expect(await outboxCount(inProduction.workItemId)).toBe(1);
  });
});

describe("T059 — zero events", () => {
  it("v1 INITIAL", async () => {
    const item = await createProductionItem({ state: "NEW" });
    await expectNoEvent(item.workItemId);
  });

  it("runtime BACKFILL", async () => {
    const userId = await seedUser();
    const orderId = await seedOrder({
      customerId: await seedCustomer(),
      createdById: userId,
    });
    const workItemId = await seedWorkItem({ orderId, state: "NEW" });
    const v1 = await runInTxScope(testDb, (scope) =>
      ensureCurrentSpecVersionInTx(scope, workItemId),
    );
    expect(v1.origin).toBe("BACKFILL");
    await expectNoEvent(workItemId);
  });

  it("a refused command (stale expectedVersion)", async () => {
    const item = await createProductionItem({ state: "NEW" });
    const res = await editSpec(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      expectedVersion: 7,
      patch: { quantity: 700 },
    });
    expect(!res.ok && res.error.code).toBe("STALE_SPEC_VERSION");
    await expectNoEvent(item.workItemId);
  });

  it("creating, rejecting, and withdrawing change requests", async () => {
    const rejected = await createProductionItem();
    const rejectRes = await rejectChangeRequest(
      approverActor(await seedUser()),
      {
        changeRequestId: await pendingRequest(rejected),
        reason: "no",
      },
    );
    expect(rejectRes.ok).toBe(true);
    await expectNoEvent(rejected.workItemId);

    const withdrawn = await createProductionItem();
    const withdrawRes = await withdrawChangeRequest(
      receptionActor(await seedUser()),
      {
        changeRequestId: await pendingRequest(withdrawn),
        reason: "never mind",
      },
    );
    expect(withdrawRes.ok).toBe(true);
    await expectNoEvent(withdrawn.workItemId);
  });

  it("a dueDate-only editWorkItem", async () => {
    const actor = receptionActor(await seedUser());
    const { workItemId } = await quickCreateOrder(actor, {
      customerId: await seedCustomer(),
      description: "Due date only",
      priority: "NORMAL",
      channel: "WALK_IN",
    });
    await editWorkItem(actor, workItemId, {
      dueDate: new Date("2026-12-01T12:00:00.000Z"),
    });
    await expectNoEvent(workItemId);
  });
});

describe("T059 — registry", () => {
  it("registering the same name twice replaces the first listener", async () => {
    const calls: string[] = [];
    registerSpecChangeListener("test.dup", async () => {
      calls.push("first");
    });
    registerSpecChangeListener("test.dup", async () => {
      calls.push("second");
    });

    const item = await createProductionItem({ state: "NEW" });
    const res = await editSpec(receptionActor(await seedUser()), {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 650 },
    });
    expect(res.ok).toBe(true);
    expect(calls).toEqual(["second"]);
  });
});
