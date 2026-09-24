// tests/integration/changes/editSpec.test.ts
// Integration tests for User Story 2: Edits allowed or refused by state.
// tasks.md T032–T035, spec FR-006..010, contracts/change-control.md §editSpec.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../../helpers/seed";
import {
  WORK_ITEM_STATES,
  type WorkItemState,
  type UserId,
} from "~/server/core";
import {
  editSpec,
  createInitialSpecVersionInTx,
  runInTxScope,
} from "~/server/changes";
import {
  registerSpecChangeListener,
  __resetSpecChangeListenersForTests,
} from "~/server/changes/events";
import { editWorkItem, DomainOrderError } from "~/server/orders";
import type { Actor, Permission, RoleKey } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

function makeActor(
  userId: string,
  roles: readonly RoleKey[] = ["RECEPTION"],
  permissions: Permission[] = ["order.create", "order.edit", "order.cancel"],
): Actor {
  return {
    userId,
    roles,
    permissions: new Set(permissions),
    departmentIds: [],
  };
}

async function createTestDepartment(): Promise<string> {
  const dept = await testDb.department.create({
    data: {
      name: `Dept_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    },
  });
  return dept.id;
}

interface FactoryWorkItemOptions {
  requiresDesign?: boolean;
  assigneeId?: string | null;
  departmentId?: string | null;
  defaultDepartmentId?: string | null;
}

async function createFactoryWorkItem(
  state: WorkItemState,
  options: FactoryWorkItemOptions = {},
): Promise<{
  workItemId: string;
  orderId: string;
  creatorId: UserId;
  actor: Actor;
}> {
  const creatorId = await seedUser();
  const customerId = await seedCustomer();
  const orderId = await seedOrder({ customerId, createdById: creatorId });

  let productTypeId: string | null = null;
  if (options.defaultDepartmentId !== undefined) {
    const pt = await testDb.productType.create({
      data: {
        name: `PT_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        defaultDepartmentId: options.defaultDepartmentId,
      },
    });
    productTypeId = pt.id;
  }

  const workItemId = await seedWorkItem({ orderId, state });

  await testDb.workItem.update({
    where: { id: workItemId },
    data: {
      quantity: 500,
      description: "Initial description",
      requiresDesign: options.requiresDesign ?? false,
      assigneeId: options.assigneeId ?? null,
      departmentId: options.departmentId ?? null,
      productTypeId,
    },
  });

  const actor = makeActor(creatorId);

  await runInTxScope(testDb, async (scope) => {
    await createInitialSpecVersionInTx(scope, {
      workItemId,
      actorId: creatorId,
    });
  });

  return { workItemId, orderId, creatorId, actor };
}

describe("016 editSpec - User Story 2 (Integration)", () => {
  // ── T032: Policy by state ──────────────────────────────────────────────────
  describe("T032 - Policy by state", () => {
    const DIRECT_STATES: WorkItemState[] = [
      "NEW",
      "ASSIGNED",
      "IN_DESIGN",
      "DESIGN_COMPLETED",
      "WAITING_REVIEW",
      "REWORK_REQUIRED",
      "APPROVED",
      "WAITING_PRICING",
      "READY_FOR_PRODUCTION",
    ];

    const ADMIN_ONLY_STATES: WorkItemState[] = [
      "PRODUCTION_COMPLETED",
      "READY_FOR_COLLECTION",
      "DELIVERED",
      "COMPLETED",
    ];

    const LOCKED_STATES: WorkItemState[] = ["CANCELLED"];

    it("covers all 15 states in the system", () => {
      const allTested = [
        ...DIRECT_STATES,
        "IN_PRODUCTION",
        ...ADMIN_ONLY_STATES,
        ...LOCKED_STATES,
      ];
      expect(new Set(allTested).size).toBe(15);
      expect(new Set(WORK_ITEM_STATES).size).toBe(15);
      for (const s of WORK_ITEM_STATES) {
        expect(allTested).toContain(s);
      }
    });

    for (const state of DIRECT_STATES) {
      it(`allows direct edit in state ${state} and creates v2 plus spec.edited audit (US2-1)`, async () => {
        const { workItemId, actor } = await createFactoryWorkItem(state, {
          requiresDesign: false, // For general direct edit check without redesign choice
        });

        const result = await editSpec(actor, {
          workItemId,
          expectedVersion: 1,
          patch: { quantity: 800 },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.data.version).toBe(2);
        expect(result.data.redesigned).toBe(false);

        // Assert v1 and v2 exist
        const versions = await testDb.specVersion.findMany({
          where: { workItemId },
          orderBy: { version: "asc" },
        });
        expect(versions).toHaveLength(2);
        expect(versions[0]!.version).toBe(1);
        expect(versions[0]!.quantity).toBe(500);
        expect(versions[1]!.version).toBe(2);
        expect(versions[1]!.quantity).toBe(800);
        expect(versions[1]!.origin).toBe("DIRECT_EDIT");

        // Assert spec.edited audit contains ONLY the changed fields (US2-1)
        const auditEvent = await testDb.auditEvent.findFirst({
          where: {
            entityType: "WorkItem",
            entityId: workItemId,
            action: "spec.edited",
          },
        });
        expect(auditEvent).not.toBeNull();
        expect(auditEvent!.before).toEqual({ quantity: 500 });
        expect(auditEvent!.after).toEqual({ quantity: 800 });
      });
    }

    for (const state of ADMIN_ONLY_STATES) {
      it(`refuses direct edit in state ${state} with ADMIN_OVERRIDE_REQUIRED (US2-4)`, async () => {
        const { workItemId, actor } = await createFactoryWorkItem(state);

        const result = await editSpec(actor, {
          workItemId,
          expectedVersion: 1,
          patch: { quantity: 800 },
        });

        expect(result).toEqual({
          ok: false,
          error: { code: "ADMIN_OVERRIDE_REQUIRED" },
        });

        // Assert no new version created
        const versions = await testDb.specVersion.findMany({ where: { workItemId } });
        expect(versions).toHaveLength(1);
      });
    }

    for (const state of LOCKED_STATES) {
      it(`refuses direct edit in state ${state} with WORK_ITEM_LOCKED`, async () => {
        const { workItemId, actor } = await createFactoryWorkItem(state);

        const result = await editSpec(actor, {
          workItemId,
          expectedVersion: 1,
          patch: { quantity: 800 },
        });

        expect(result).toEqual({
          ok: false,
          error: { code: "WORK_ITEM_LOCKED" },
        });

        const versions = await testDb.specVersion.findMany({ where: { workItemId } });
        expect(versions).toHaveLength(1);
      });
    }
  });

  // ── T033: Permission and concurrency ──────────────────────────────────────
  describe("T033 - Permission and concurrency", () => {
    it("refuses actors without order.edit as FORBIDDEN in DIRECT states and IN_PRODUCTION (US2-5)", async () => {
      const nonEditRoles: Array<{ name: RoleKey; permissions: Permission[] }> = [
        { name: "HEAD_DESIGNER", permissions: ["design.review", "change.approve"] },
        { name: "DESIGNER", permissions: ["design.work"] },
        { name: "PRODUCTION_OPERATOR", permissions: ["production.operate"] },
        { name: "ACCOUNTING", permissions: ["finance.view", "payment.record"] },
      ];

      for (const roleDef of nonEditRoles) {
        // Direct state (NEW)
        const directItem = await createFactoryWorkItem("NEW");
        const directActor = makeActor(directItem.creatorId, [roleDef.name], roleDef.permissions);

        const directResult = await editSpec(directActor, {
          workItemId: directItem.workItemId,
          expectedVersion: 1,
          patch: { quantity: 800 },
        });
        expect(directResult).toEqual({
          ok: false,
          error: { code: "FORBIDDEN" },
        });

        // IN_PRODUCTION state
        const prodItem = await createFactoryWorkItem("IN_PRODUCTION");
        const prodActor = makeActor(prodItem.creatorId, [roleDef.name], roleDef.permissions);

        const prodResult = await editSpec(prodActor, {
          workItemId: prodItem.workItemId,
          expectedVersion: 1,
          patch: { quantity: 800 },
        });
        expect(prodResult).toEqual({
          ok: false,
          error: { code: "FORBIDDEN" },
        });
      }
    });

    it("refuses a stale expectedVersion with STALE_SPEC_VERSION", async () => {
      const { workItemId, actor } = await createFactoryWorkItem("NEW");

      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 99,
        patch: { quantity: 800 },
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "STALE_SPEC_VERSION", currentVersion: 1 },
      });
    });

    it("refuses a no-op patch with NO_CHANGES", async () => {
      const { workItemId, actor } = await createFactoryWorkItem("NEW");

      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 500 }, // same as initial
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "NO_CHANGES" },
      });
    });

    it("two editSpec calls from the same version with Promise.all: exactly one succeeds (US2-6)", async () => {
      const { workItemId, actor } = await createFactoryWorkItem("NEW");

      const [res1, res2] = await Promise.all([
        editSpec(actor, {
          workItemId,
          expectedVersion: 1,
          patch: { quantity: 600 },
        }),
        editSpec(actor, {
          workItemId,
          expectedVersion: 1,
          patch: { quantity: 700 },
        }),
      ]);

      const successes = [res1, res2].filter((r) => r.ok);
      const stales = [res1, res2].filter(
        (r) => !r.ok && r.error.code === "STALE_SPEC_VERSION",
      );

      expect(successes).toHaveLength(1);
      expect(stales).toHaveLength(1);

      // Verify DB has exactly 2 versions (v1 and the single winning v2)
      const versions = await testDb.specVersion.findMany({
        where: { workItemId },
        orderBy: { version: "asc" },
      });
      expect(versions).toHaveLength(2);
      expect(versions[0]!.version).toBe(1);
      expect(versions[1]!.version).toBe(2);
    });
  });

  // ── T034: IN_PRODUCTION refused server-side (Acceptance Criterion 1) ───────
  describe("T034 - IN_PRODUCTION refused server-side", () => {
    it("refuses direct editSpec on IN_PRODUCTION with CHANGE_REQUEST_REQUIRED and leaves all counts and data untouched", async () => {
      const { workItemId, actor } = await createFactoryWorkItem("IN_PRODUCTION");

      // Set up spy listener to ensure no events are emitted
      let listenerCalls = 0;
      registerSpecChangeListener("test-production-spy", async () => {
        listenerCalls += 1;
      });

      // Capture before counts and values
      const specVersionCountBefore = await testDb.specVersion.count({
        where: { workItemId },
      });
      const auditCountBefore = await testDb.auditEvent.count({
        where: { entityId: workItemId },
      });
      const notificationCountBefore = await testDb.notificationEvent.count({
        where: { entityId: workItemId },
      });
      const workItemBefore = await testDb.workItem.findUniqueOrThrow({
        where: { id: workItemId },
      });

      // Public call directly against service function (not UI)
      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 800 },
      });

      // Never throws; returns typed AspectResult refusal
      expect(result).toEqual({
        ok: false,
        error: { code: "CHANGE_REQUEST_REQUIRED" },
      });

      // Assert all counts and values are unchanged
      const specVersionCountAfter = await testDb.specVersion.count({
        where: { workItemId },
      });
      const auditCountAfter = await testDb.auditEvent.count({
        where: { entityId: workItemId },
      });
      const notificationCountAfter = await testDb.notificationEvent.count({
        where: { entityId: workItemId },
      });
      const workItemAfter = await testDb.workItem.findUniqueOrThrow({
        where: { id: workItemId },
      });

      expect(specVersionCountAfter).toBe(specVersionCountBefore);
      expect(auditCountAfter).toBe(auditCountBefore);
      expect(notificationCountAfter).toBe(notificationCountBefore);
      expect(workItemAfter.quantity).toBe(workItemBefore.quantity);
      expect(workItemAfter.currentSpecVersionId).toBe(workItemBefore.currentSpecVersionId);
      expect(listenerCalls).toBe(0);

      // Also assert 011 editWorkItem refuses with PAST_EDIT_WINDOW
      await expect(
        editWorkItem(actor, workItemId, { quantity: 800 }),
      ).rejects.toThrow(DomainOrderError);
    });
  });

  // ── T035: Redesign flow ───────────────────────────────────────────────────
  describe("T035 - Redesign flow", () => {
    const REDESIGN_CHOICE_STATES: WorkItemState[] = [
      "APPROVED",
      "WAITING_PRICING",
      "READY_FOR_PRODUCTION",
    ];

    for (const state of REDESIGN_CHOICE_STATES) {
      it(`in ${state} with requiresDesign=true and no designChoice, refuses with REDESIGN_CHOICE_REQUIRED`, async () => {
        const { workItemId, actor } = await createFactoryWorkItem(state, {
          requiresDesign: true,
        });

        const result = await editSpec(actor, {
          workItemId,
          expectedVersion: 1,
          patch: { quantity: 800 },
        });

        expect(result).toEqual({
          ok: false,
          error: { code: "REDESIGN_CHOICE_REQUIRED" },
        });
      });
    }

    it("choosing REDESIGN transitions to REWORK_REQUIRED with CUSTOMER_CHANGE, creates Return, and notifies designer (US2-2, FR-009)", async () => {
      const designerId = await seedUser();
      const deptId = await createTestDepartment();

      const { workItemId, actor } = await createFactoryWorkItem("APPROVED", {
        requiresDesign: true,
        assigneeId: designerId,
        departmentId: deptId,
      });

      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 800 },
        reason: "Customer requested new dimensions",
        designChoice: "REDESIGN",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.version).toBe(2);
      expect(result.data.redesigned).toBe(true);

      // Verify state is REWORK_REQUIRED
      const updatedItem = await testDb.workItem.findUniqueOrThrow({
        where: { id: workItemId },
      });
      expect(updatedItem.state).toBe("REWORK_REQUIRED");
      expect(updatedItem.quantity).toBe(800);

      // Verify WorkItemTransition record
      const transition = await testDb.workItemTransition.findFirst({
        where: { workItemId, to: "REWORK_REQUIRED" },
        orderBy: { at: "desc" },
      });
      expect(transition).not.toBeNull();
      expect(transition!.rejectionCategory).toBe("CUSTOMER_CHANGE");
      expect(transition!.from).toBe("APPROVED");

      // Verify Return record created with category CUSTOMER_CHANGE and effective department
      const returnRow = await testDb.return.findFirst({
        where: { workItemId },
        orderBy: { createdAt: "desc" },
      });
      expect(returnRow).not.toBeNull();
      expect(returnRow!.category).toBe("CUSTOMER_CHANGE");
      expect(returnRow!.originDepartmentId).toBe(deptId);
      expect(returnRow!.assignedToId).toBe(designerId);
      expect(returnRow!.explanation).toBe("Customer requested new dimensions");

      // Verify notification sent to designer
      const notification = await testDb.notificationEvent.findFirst({
        where: {
          entityId: workItemId,
          type: "work_item.customer_change_returned",
        },
      });
      expect(notification).not.toBeNull();
      expect(notification!.recipientUserIds).toContain(designerId);

      // Verify audit events: spec.edited and workitem.returned_for_customer_change
      const specAudit = await testDb.auditEvent.findFirst({
        where: { entityId: workItemId, action: "spec.edited" },
      });
      expect(specAudit).not.toBeNull();
      expect(specAudit!.reason).toBe("Customer requested new dimensions");

      const returnAudit = await testDb.auditEvent.findFirst({
        where: { entityId: workItemId, action: "workitem.returned_for_customer_change" },
      });
      expect(returnAudit).not.toBeNull();
    });

    it("choosing KEEP_DESIGN creates version with no state change", async () => {
      const designerId = await seedUser();
      const deptId = await createTestDepartment();

      const { workItemId, actor } = await createFactoryWorkItem("APPROVED", {
        requiresDesign: true,
        assigneeId: designerId,
        departmentId: deptId,
      });

      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 800 },
        designChoice: "KEEP_DESIGN",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.version).toBe(2);
      expect(result.data.redesigned).toBe(false);

      const item = await testDb.workItem.findUniqueOrThrow({
        where: { id: workItemId },
      });
      expect(item.state).toBe("APPROVED");
      expect(item.quantity).toBe(800);

      // No Return created
      const returns = await testDb.return.findMany({ where: { workItemId } });
      expect(returns).toHaveLength(0);
    });

    it("refuses REDESIGN when requiresDesign=false with REDESIGN_NOT_ALLOWED", async () => {
      const { workItemId, actor } = await createFactoryWorkItem("APPROVED", {
        requiresDesign: false,
      });

      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 800 },
        designChoice: "REDESIGN",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "REDESIGN_NOT_ALLOWED" },
      });
    });

    it("refuses REDESIGN without originDepartmentId when effective department is null", async () => {
      const designerId = await seedUser();

      // WorkItem with no departmentId and productType without defaultDepartmentId
      const { workItemId, actor } = await createFactoryWorkItem("APPROVED", {
        requiresDesign: true,
        assigneeId: designerId,
        departmentId: null,
        defaultDepartmentId: null,
      });

      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 800 },
        designChoice: "REDESIGN",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "ORIGIN_DEPARTMENT_REQUIRED" },
      });

      // Providing explicit originDepartmentId succeeds
      const explicitDeptId = await createTestDepartment();
      const successResult = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 800 },
        designChoice: "REDESIGN",
        originDepartmentId: explicitDeptId,
      });
      expect(successResult.ok).toBe(true);
    });

    it("editing in WAITING_REVIEW notifies assignee AND every design.review holder (FR-008)", async () => {
      const designerId = await seedUser();
      const reviewerUser1 = await seedUser();
      const reviewerUser2 = await seedUser();
      const adminId = await seedUser();

      // Assign design.review permission to reviewers via userPermission
      await testDb.userPermission.createMany({
        data: [
          { userId: reviewerUser1, permission: "design.review", grantedById: adminId },
          { userId: reviewerUser2, permission: "design.review", grantedById: adminId },
        ],
      });

      const { workItemId, actor } = await createFactoryWorkItem("WAITING_REVIEW", {
        requiresDesign: true,
        assigneeId: designerId,
      });

      const result = await editSpec(actor, {
        workItemId,
        expectedVersion: 1,
        patch: { quantity: 800 },
      });

      expect(result.ok).toBe(true);

      // Verify notifications
      const notifications = await testDb.notificationEvent.findMany({
        where: {
          entityId: workItemId,
          type: "work_item.customer_modification",
        },
      });

      expect(notifications.length).toBeGreaterThanOrEqual(1);
      const recipientIds = notifications.flatMap((n) => n.recipientUserIds);

      // Assignee is notified
      expect(recipientIds).toContain(designerId);

      // Reviewers are notified
      expect(recipientIds).toContain(reviewerUser1);
      expect(recipientIds).toContain(reviewerUser2);
    });
  });
});
