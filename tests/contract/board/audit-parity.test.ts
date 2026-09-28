/**
 * Contract test for audit parity: board moves produce identical WorkItemTransition
 * and AuditEvent records to direct domain actions without extra board audit entries.
 * (T055, SC-006, FR-013, contracts/board-server.md §EdgeCatalog)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "~/server/auth";
import { moveWorkItem } from "~/server/board";
import { sendToProduction } from "~/server/orders";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";

describe("Audit parity contract (T055, SC-006, FR-013)", { timeout: 60000 }, () => {
  let actor: Actor;
  let orderId: string;

  beforeAll(async () => {
    const userId = await seedUser();
    const customerId = await seedCustomer();
    orderId = await seedOrder({ customerId, createdById: userId });

    actor = {
      id: userId,
      userId,
      roles: ["RECEPTION"],
      permissions: new Set(["order.create", "workitem.send_to_production", "order.cancel"]),
      departmentIds: [],
    };
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("board move produces identical audit events and transitions to direct domain action", async () => {
    // 1. Direct domain action call
    const itemDirect = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        requiresDesign: false,
      },
    });

    await sendToProduction(actor, itemDirect.id);

    const directTransitions = await testDb.workItemTransition.findMany({
      where: { workItemId: itemDirect.id },
      orderBy: { at: "asc" },
    });
    const directAudits = await testDb.auditEvent.findMany({
      where: { entityId: itemDirect.id },
      orderBy: { createdAt: "asc" },
    });

    // 2. Board move dispatcher call
    const itemBoard = await testDb.workItem.create({
      data: {
        orderId,
        state: "NEW",
        requiresDesign: false,
      },
    });

    const moveRes = await moveWorkItem(actor, {
      workItemId: itemBoard.id,
      edgeId: "NEW->READY_FOR_PRODUCTION",
      clientMoveId: "move-parity-1",
    });

    expect(moveRes.ok).toBe(true);

    const boardTransitions = await testDb.workItemTransition.findMany({
      where: { workItemId: itemBoard.id },
      orderBy: { at: "asc" },
    });
    const boardAudits = await testDb.auditEvent.findMany({
      where: { entityId: itemBoard.id },
      orderBy: { createdAt: "asc" },
    });

    // Parity assertions
    expect(boardTransitions).toHaveLength(directTransitions.length);
    expect(boardTransitions[0]?.to).toBe(directTransitions[0]?.to);

    expect(boardAudits).toHaveLength(directAudits.length);
    expect(boardAudits.map((a) => a.action)).toEqual(directAudits.map((a) => a.action));

    // FR-013: no board-specific audit events created
    const hasBoardAudit = boardAudits.some((a) => a.action.startsWith("board."));
    expect(hasBoardAudit).toBe(false);
  });
});
