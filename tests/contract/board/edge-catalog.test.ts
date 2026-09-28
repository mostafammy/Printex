/**
 * Contract test for EdgeCatalog and role-permission matrix.
 * (T054, SC-003, contracts/board-server.md §EdgeCatalog)
 */

import { describe, expect, it } from "vitest";
import type { BoardCard } from "~/lib/board/types";
import type { Actor } from "~/server/auth";
import { edgeCatalog, moveWorkItem } from "~/server/board";
import { ALLOWED_EDGES, type WorkItemState } from "~/server/core";

function makeCard(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    id: "wi-test-1",
    orderId: "ord-test-1",
    orderNumber: 1001,
    orderTagHue: 120,
    customerName: "عميل تجريبي",
    title: "مطبوعات تجريبية",
    quantity: 500,
    state: "NEW",
    priority: "NORMAL",
    pricing: "NOT_REQUIRED",
    enteredStationAt: new Date().toISOString(),
    targetMinutes: 120,
    dueAt: null,
    reworkCount: 0,
    assignee: null,
    departmentId: "dept-offset",
    moves: [],
    lastTransitionId: null,
    lastTransitionAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("EdgeCatalog contract (T054, SC-003, contracts/board-server.md §EdgeCatalog)", () => {
  it("registers a handler for every single transition defined in ALLOWED_EDGES", () => {
    for (const [from, targets] of Object.entries(ALLOWED_EDGES) as [WorkItemState, readonly WorkItemState[]][]) {
      for (const to of targets) {
        const edgeId = `${from}->${to}`;
        const handler = edgeCatalog.get(edgeId);
        expect(handler, `Expected handler registered for ${edgeId}`).toBeDefined();
      }
    }
  });

  it("contains no handlers for edges that do not exist in ALLOWED_EDGES", () => {
    for (const handler of edgeCatalog.getAll()) {
      const [from, to] = handler.edgeId.split("->") as [WorkItemState, WorkItemState];
      expect(ALLOWED_EDGES[from]).toContain(to);
    }
  });

  it("offers appropriate moves to RECEPTION role", () => {
    const actor: Actor = {
      id: "u-reception",
      userId: "u-reception",
      roles: ["RECEPTION"],
      permissions: new Set(["workitem.send_to_production", "workitem.assign_designer", "order.cancel"]),
      departmentIds: [],
    };
    const card = makeCard({ state: "NEW" });
    const moves = edgeCatalog.offer(actor, card);
    const edgeIds = moves.map((m) => m.edgeId);

    expect(edgeIds).toContain("NEW->READY_FOR_PRODUCTION");
    expect(edgeIds).toContain("NEW->ASSIGNED");
    expect(edgeIds).toContain("NEW->CANCELLED");
  });

  it("does not offer reception moves to DESIGNER without permissions", () => {
    const actor: Actor = {
      id: "u-designer",
      userId: "u-designer",
      roles: ["DESIGNER"],
      permissions: new Set(["design.work"]),
      departmentIds: [],
    };
    const card = makeCard({ state: "NEW" });
    const moves = edgeCatalog.offer(actor, card);

    expect(moves).toHaveLength(0);
  });

  it("respects department scoping for production operator", () => {
    const operatorDept1: Actor = {
      id: "u-op1",
      userId: "u-op1",
      roles: ["PRODUCTION_OPERATOR"],
      permissions: new Set(["production.operate"]),
      departmentIds: ["dept-1"],
    };
    const operatorDept2: Actor = {
      id: "u-op2",
      userId: "u-op2",
      roles: ["PRODUCTION_OPERATOR"],
      permissions: new Set(["production.operate"]),
      departmentIds: ["dept-2"],
    };

    const cardInDept1 = makeCard({ state: "READY_FOR_PRODUCTION", departmentId: "dept-1" });

    const moves1 = edgeCatalog.offer(operatorDept1, cardInDept1);
    expect(moves1.map((m) => m.edgeId)).toContain("READY_FOR_PRODUCTION->IN_PRODUCTION");

    const moves2 = edgeCatalog.offer(operatorDept2, cardInDept1);
    expect(moves2.map((m) => m.edgeId)).not.toContain("READY_FOR_PRODUCTION->IN_PRODUCTION");
  });

  it("refuses forced illegal moves with NOT_OFFERED or FORBIDDEN", async () => {
    const unauthorizedActor: Actor = {
      id: "u-unauth",
      userId: "u-unauth",
      roles: ["DESIGNER"],
      permissions: new Set(["design.work"]),
      departmentIds: [],
    };

    const res = await moveWorkItem(unauthorizedActor, {
      workItemId: "non-existent-id",
      edgeId: "NEW->READY_FOR_PRODUCTION",
      clientMoveId: "move-test-1",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("NOT_OFFERED");
    }
  });
});
