// tests/integration/changes/productionFactory.ts
// Shared factory for 016 change-request tests (US3/US6/US7): a Work Item in
// IN_PRODUCTION with v1, a department, and optionally a running timer.

import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../../helpers/seed";
import type { WorkItemState } from "~/server/core";
import { createInitialSpecVersionInTx, runInTxScope } from "~/server/changes";
import type { Actor, Permission, RoleKey } from "~/server/auth";

export function makeActor(
  userId: string,
  roles: readonly RoleKey[],
  permissions: readonly Permission[],
  departmentIds: readonly string[] = [],
): Actor {
  return { userId, roles, permissions: new Set(permissions), departmentIds: [...departmentIds] };
}

export const receptionActor = (userId: string): Actor =>
  makeActor(userId, ["RECEPTION"], ["order.create", "order.edit", "order.cancel"]);

export const approverActor = (userId: string): Actor =>
  makeActor(userId, ["HEAD_DESIGNER"], ["design.review", "change.approve"]);

export const operatorActor = (userId: string, departmentId: string): Actor =>
  makeActor(userId, ["PRODUCTION_OPERATOR"], ["production.operate"], [departmentId]);

export const adminActor = (userId: string): Actor =>
  makeActor(userId, ["ADMIN_OWNER"], [
    "order.create",
    "order.edit",
    "order.cancel",
    "change.approve",
    "admin.override",
    "production.operate",
  ]);

export interface ProductionItemOptions {
  readonly state?: WorkItemState;
  readonly requiresDesign?: boolean;
  readonly withAssignee?: boolean;
  readonly timerRunning?: boolean;
  readonly priority?: "NORMAL" | "URGENT";
}

export interface ProductionItem {
  readonly workItemId: string;
  readonly orderId: string;
  readonly departmentId: string;
  readonly creatorId: string;
  readonly assigneeId: string | null;
}

/** v1 = { quantity: 500, material: "Vinyl" }. */
export async function createProductionItem(
  options: ProductionItemOptions = {},
): Promise<ProductionItem> {
  const creatorId = await seedUser();
  const assigneeId = options.withAssignee === false ? null : await seedUser();
  const customerId = await seedCustomer();
  const orderId = await seedOrder({ customerId, createdById: creatorId });
  if (options.priority) {
    await testDb.order.update({ where: { id: orderId }, data: { priority: options.priority } });
  }
  const department = await testDb.department.create({
    data: { name: `ProdDept_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
  });

  const workItemId = await seedWorkItem({ orderId, state: options.state ?? "IN_PRODUCTION" });
  await testDb.workItem.update({
    where: { id: workItemId },
    data: {
      description: "Flyer",
      quantity: 500,
      material: "Vinyl",
      requiresDesign: options.requiresDesign ?? true,
      assigneeId,
      departmentId: department.id,
    },
  });

  await runInTxScope(testDb, (scope) =>
    createInitialSpecVersionInTx(scope, { workItemId, actorId: creatorId }),
  );

  if (options.timerRunning) {
    await testDb.phaseTiming.create({
      data: { workItemId, phase: "IN_PRODUCTION", kind: "ACTIVE", startedAt: new Date() },
    });
  }

  return { workItemId, orderId, departmentId: department.id, creatorId, assigneeId };
}

export async function openActiveSegments(workItemId: string): Promise<number> {
  return testDb.phaseTiming.count({ where: { workItemId, kind: "ACTIVE", endedAt: null } });
}
