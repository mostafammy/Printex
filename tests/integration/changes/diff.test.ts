// tests/integration/changes/diff.test.ts
// User Story 4: see exactly what changed. tasks.md T054, T055,
// contracts/change-control.md §getSpecVersionDiff, §getProductionStartSpecDiff.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedUser } from "../../helpers/seed";
import {
  approveChangeRequest,
  applySpecChangeInTx,
  createChangeRequest,
  editSpec,
  getChangeRequestDetail,
  getProductionStartSpecDiff,
  getSpecHistory,
  getSpecVersionDiff,
  runInTxScope,
} from "~/server/changes";
import { __resetSpecChangeListenersForTests } from "~/server/changes/events";
import { getJobCard } from "~/server/production";
import {
  approverActor,
  createProductionItem,
  makeActor,
  operatorActor,
  receptionActor,
} from "./productionFactory";

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

const QUANTITY_500_TO_800 = [
  { field: "quantity", kind: "CHANGED", before: 500, after: 800 },
];

/** v1 = { quantity: 500, material: "Vinyl" }, v2 = { quantity: 800, material: "Vinyl" }. */
async function itemWithTwoVersions(state: "NEW" | "IN_PRODUCTION" = "NEW") {
  const item = await createProductionItem({ state });
  await runInTxScope(testDb, (scope) =>
    applySpecChangeInTx(scope, {
      workItemId: item.workItemId,
      actorId: item.creatorId,
      origin: "DIRECT_EDIT",
      patch: { quantity: 800 },
      expected: { version: 1 },
      reason: null,
      ifUnchanged: "fail",
    }),
  );
  return item;
}

describe("T054 — getSpecVersionDiff", () => {
  it("v1 vs v2 shows exactly the quantity change; v2 vs v2 is empty (US4-1)", async () => {
    const item = await itemWithTwoVersions();
    const reception = receptionActor(await seedUser());

    const diff = await getSpecVersionDiff(reception, {
      workItemId: item.workItemId,
      fromVersion: 1,
      toVersion: 2,
    });
    expect(diff).toEqual({ ok: true, data: QUANTITY_500_TO_800 });

    const same = await getSpecVersionDiff(reception, {
      workItemId: item.workItemId,
      fromVersion: 2,
      toVersion: 2,
    });
    expect(same).toEqual({ ok: true, data: [] });
  });

  it("refuses versions that do not belong to the Work Item with VERSION_MISMATCH (US4-5)", async () => {
    const item = await createProductionItem({ state: "NEW" });
    await itemWithTwoVersions(); // another Work Item that does have a v2
    const reception = receptionActor(await seedUser());

    const res = await getSpecVersionDiff(reception, {
      workItemId: item.workItemId,
      fromVersion: 1,
      toVersion: 2,
    });
    expect(res).toEqual({ ok: false, error: { code: "VERSION_MISMATCH" } });
  });
});

describe("T054 — change request detail diff (US4-4)", () => {
  it("getChangeRequestDetail returns base vs base + proposed patch", async () => {
    const item = await createProductionItem();
    const created = await createChangeRequest(
      receptionActor(await seedUser()),
      {
        workItemId: item.workItemId,
        patch: { quantity: 800 },
        reason: "customer called",
      },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const detail = await getChangeRequestDetail(
      approverActor(await seedUser()),
      {
        changeRequestId: created.data.changeRequestId,
      },
    );
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.data.base.version).toBe(1);
    expect(detail.data.changes).toEqual(QUANTITY_500_TO_800);
  });
});

describe("T054 — getProductionStartSpecDiff (FR-020)", () => {
  it("after a mid-production approval: start v1, current v2, quantity changed", async () => {
    const item = await createProductionItem();
    const v1 = await testDb.specVersion.findFirstOrThrow({
      where: { workItemId: item.workItemId, version: 1 },
    });
    // The factory seeds IN_PRODUCTION directly; record the entry after v1.
    await testDb.workItemTransition.create({
      data: {
        workItemId: item.workItemId,
        from: "READY_FOR_PRODUCTION",
        to: "IN_PRODUCTION",
        actorId: item.creatorId,
        at: new Date(v1.createdAt.getTime() + 1),
      },
    });

    expect(await getProductionStartSpecDiff(testDb, item.workItemId)).toEqual({
      startVersion: 1,
      currentVersion: 1,
      changes: [],
    });

    const created = await createChangeRequest(
      receptionActor(await seedUser()),
      {
        workItemId: item.workItemId,
        patch: { quantity: 800 },
        reason: "customer called",
      },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const approved = await approveChangeRequest(
      approverActor(await seedUser()),
      {
        changeRequestId: created.data.changeRequestId,
        outcome: "CONTINUE_PRODUCTION",
      },
    );
    expect(approved.ok).toBe(true);

    expect(await getProductionStartSpecDiff(testDb, item.workItemId)).toEqual({
      startVersion: 1,
      currentVersion: 2,
      changes: QUANTITY_500_TO_800,
    });

    const card = await getJobCard(
      operatorActor(await seedUser(), item.departmentId),
      item.workItemId,
    );
    expect(card.productionStartDiff).toEqual(QUANTITY_500_TO_800);
    expect(card.productionStartProductTypeNames).toEqual({});
  });

  it("is empty for a Work Item that never entered production", async () => {
    const item = await itemWithTwoVersions();
    expect(await getProductionStartSpecDiff(testDb, item.workItemId)).toEqual({
      startVersion: null,
      currentVersion: 2,
      changes: [],
    });
  });
});

describe("T054 — who may read spec history and diffs (US4)", () => {
  const diffInput = (workItemId: string) => ({
    workItemId,
    fromVersion: 1,
    toVersion: 2,
  });
  const forbidden = { ok: false, error: { code: "FORBIDDEN" } };

  it("refuses a user with no roles and an operator of another department", async () => {
    const item = await itemWithTwoVersions("IN_PRODUCTION");
    const otherDept = await testDb.department.create({
      data: {
        name: `OtherDept_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    const noRoles = makeActor(await seedUser(), [], []);
    const otherOperator = operatorActor(await seedUser(), otherDept.id);

    for (const actor of [noRoles, otherOperator]) {
      expect(
        await getSpecHistory(actor, { workItemId: item.workItemId }),
      ).toEqual(forbidden);
      expect(
        await getSpecVersionDiff(actor, diffInput(item.workItemId)),
      ).toEqual(forbidden);
    }
  });

  it("allows RECEPTION, ACCOUNTING and an operator of the item's department", async () => {
    const item = await itemWithTwoVersions("IN_PRODUCTION");
    const reception = receptionActor(await seedUser());
    const accounting = makeActor(
      await seedUser(),
      ["ACCOUNTING"],
      ["payment.record", "payment.void", "expense.record", "finance.view"],
    );
    const operator = operatorActor(await seedUser(), item.departmentId);

    for (const actor of [reception, accounting, operator]) {
      const history = await getSpecHistory(actor, {
        workItemId: item.workItemId,
      });
      expect(history.ok).toBe(true);
      expect(
        await getSpecVersionDiff(actor, diffInput(item.workItemId)),
      ).toEqual({
        ok: true,
        data: QUANTITY_500_TO_800,
      });
    }
  });
});

describe("T055 — acceptance criterion 2 (UI path)", () => {
  it("editSpec in NEW 500 → 800: history has both versions and diffs[0] is the quantity change", async () => {
    const item = await createProductionItem({
      state: "NEW",
      requiresDesign: false,
    });
    const reception = receptionActor(await seedUser());

    const edited = await editSpec(reception, {
      workItemId: item.workItemId,
      expectedVersion: 1,
      patch: { quantity: 800 },
    });
    expect(edited.ok).toBe(true);

    const history = await getSpecHistory(reception, {
      workItemId: item.workItemId,
    });
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.data.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(history.data.diffs).toHaveLength(1);
    expect(history.data.diffs[0]).toEqual({
      from: 1,
      to: 2,
      changes: QUANTITY_500_TO_800,
    });
  });
});
