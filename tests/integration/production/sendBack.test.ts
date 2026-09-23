// Integration test for sendBackToDesign — specs/014-production/tasks.md T028 (US5).
// Sends an IN_PRODUCTION Work Item back to design with a reason, asserting state
// transitions to REWORK_REQUIRED, a Return record is created with category PRODUCTION_ISSUE,
// the open active PhaseTiming segment is closed, and a NotificationEvent is created
// for the assigned designer in the same transaction (FR-009, FR-010).
//
// NOTE: requires prisma/schema/core.prisma's 014 columns/model to be pushed
// to the test DB (tasks.md T002) before this file can run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { sendBackToDesign } from "~/server/production/sendBack";
import { startProduction } from "~/server/production/timer";
import type { Actor, Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

let customerId: string;
let department: { id: string };

function actorFor(departmentIds: string[], permissions: Permission[]): Actor {
  return {
    userId: unique("test-integration-sendback-actor"),
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds,
  };
}

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  department = await testDb.department.create({ data: { name: unique("Dept-SendBack-Int") } });
});

async function seedActorUser(actor: Actor, name: string) {
  await testDb.user.create({
    data: {
      id: actor.userId,
      name,
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
}

describe("sendBackToDesign (integration, US5)", () => {
  it("sends an IN_PRODUCTION Work Item back to design, creates Return, closes open timer, and notifies assignee", async () => {
    const operator = actorFor([department.id], ["production.operate"]);
    await seedActorUser(operator, "Production Operator");

    const designer = actorFor([], ["design.work"]);
    await seedActorUser(designer, "Assigned Designer");

    const order = await testDb.order.create({
      data: {
        number: Number(process.hrtime.bigint() % 1_000_000_000n),
        customerId,
        channel: "WALK_IN",
        priority: "NORMAL",
        mode: "SEPARATE",
        createdById: operator.userId,
      },
    });

    const workItem = await testDb.workItem.create({
      data: {
        orderId: order.id,
        state: "READY_FOR_PRODUCTION",
        departmentId: department.id,
        assigneeId: designer.userId,
      },
    });

    // Start production to enter IN_PRODUCTION and open an ACTIVE PhaseTiming segment
    await startProduction(operator, workItem.id);

    const inProduction = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(inProduction?.state).toBe("IN_PRODUCTION");

    const openSegment = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, phase: "IN_PRODUCTION", kind: "ACTIVE", endedAt: null },
    });
    expect(openSegment).not.toBeNull();
    expect(openSegment?.userId).toBe(operator.userId);

    // Send back to design with a reason
    const reason = "Bleed area is missing on top and bottom edges of the supplied artwork";
    const { returnId } = await sendBackToDesign(operator, workItem.id, { reason });
    expect(typeof returnId).toBe("string");
    expect(returnId.length).toBeGreaterThan(0);

    // 1. WorkItem state transitioned to REWORK_REQUIRED
    const reloaded = await testDb.workItem.findUnique({ where: { id: workItem.id } });
    expect(reloaded?.state).toBe("REWORK_REQUIRED");

    // 2. Return record exists with category PRODUCTION_ISSUE and originDepartmentId = workItem department
    const returnRow = await testDb.return.findFirst({ where: { workItemId: workItem.id } });
    expect(returnRow).not.toBeNull();
    expect(returnRow?.id).toBe(returnId);
    expect(returnRow?.category).toBe("PRODUCTION_ISSUE");
    expect(returnRow?.originDepartmentId).toBe(department.id);
    expect(returnRow?.assignedToId).toBe(designer.userId);
    expect(returnRow?.explanation).toBe(reason);
    expect(returnRow?.raisedById).toBe(operator.userId);

    // 3. Previously-open PhaseTiming segment is closed (endedAt non-null)
    const openAfter = await testDb.phaseTiming.findFirst({
      where: { workItemId: workItem.id, kind: "ACTIVE", endedAt: null },
    });
    expect(openAfter).toBeNull();

    const closedSegment = await testDb.phaseTiming.findUnique({ where: { id: openSegment!.id } });
    expect(closedSegment?.endedAt).toBeInstanceOf(Date);

    // 4. NotificationEvent was created for the assignee in the same transaction
    const notification = await testDb.notificationEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, type: "workitem.rejected" },
    });
    expect(notification).not.toBeNull();
    expect(notification?.recipientUserIds).toContain(designer.userId);
    expect(notification?.payload).toMatchObject({
      returnId,
      category: "PRODUCTION_ISSUE",
    });

    // 5. AuditEvent recorded for the send-back action
    const auditEvent = await testDb.auditEvent.findFirst({
      where: { entityType: "WorkItem", entityId: workItem.id, action: "workitem.sent_back_to_design" },
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.actorId).toBe(operator.userId);
    expect(auditEvent?.after).toMatchObject({
      returnId,
      reason,
    });
  });
});
