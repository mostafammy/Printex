// Contract tests for src/server/review/review.ts + returns.ts (US2/US3) —
// specs/013-review-rework/contracts/review-rework.md's `getReviewDetail`,
// `approveDesign`, `rejectDesign` sections.
//
// Filename deliberately NOT `review-rework.test.ts` (per this task's brief)
// to avoid collisions with sibling agents landing US1 (queue)/US4 (timeline)
// contract tests in parallel worktrees against the same feature.
//
// Imports go directly to `~/server/review/review` / `~/server/review/returns`
// rather than the `~/server/review` barrel: the barrel
// (src/server/review/index.ts) is explicitly out of this task's scope (a
// later merge pass adds every user story's exports to it together), and
// `tests/**` is exempted from the module-boundary ESLint rule
// (eslint.config.js), so this is a deliberate, allowed exception — not a
// long-term pattern for application code.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getReviewDetail, approveDesign, rejectDesign } from "~/server/review/review";
import { DomainReviewError } from "~/server/review/errors";
import { ForbiddenError } from "~/server/auth/authorize";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

async function createActor(permissions: Permission[]): Promise<Actor> {
  const actor: Actor = {
    userId: unique("test-review-actor"),
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds: [],
  };
  await testDb.user.create({
    data: {
      id: actor.userId,
      name: actor.userId,
      email: `${actor.userId}@local.invalid`,
      username: actor.userId,
      isActive: true,
      failedLoginAttempts: 0,
    },
  });
  return actor;
}

let customerId: string;
let departmentId: string;

beforeAll(async () => {
  const customer = await testDb.customer.create({ data: { name: unique("Customer") } });
  customerId = customer.id;
  const department = await testDb.department.create({ data: { name: unique("Department") } });
  departmentId = department.id;
});

async function seedWaitingReviewWorkItem(uploaderId: string) {
  const order = await testDb.order.create({
    data: {
      customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: uploaderId,
      dueDate: null,
    },
  });
  const workItem = await testDb.workItem.create({
    data: {
      orderId: order.id,
      state: "WAITING_REVIEW",
      assigneeId: uploaderId,
      quantity: 100,
      material: "Vinyl",
      finishNotes: "Customer wants matte finish",
    },
  });
  await testDb.designVersion.create({
    data: {
      workItemId: workItem.id,
      version: 1,
      storageKey: `test/${workItem.id}/1`,
      fileName: "design.png",
      sizeBytes: 10,
      sha256: "abc",
      uploadedById: uploaderId,
    },
  });
  return { orderId: order.id, workItemId: workItem.id };
}

describe("review contract: getReviewDetail", () => {
  it("requires design.review — FORBIDDEN without it", async () => {
    const actor = await createActor([]);
    const uploader = await createActor(["design.work"]);
    const { workItemId } = await seedWaitingReviewWorkItem(uploader.userId);

    await expect(getReviewDetail(actor, workItemId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns versions ordered with the latest as current, plus order spec and customer notes", async () => {
    const reviewer = await createActor(["design.review"]);
    const uploader = await createActor(["design.work"]);
    const { workItemId } = await seedWaitingReviewWorkItem(uploader.userId);
    await testDb.designVersion.create({
      data: {
        workItemId,
        version: 2,
        storageKey: `test/${workItemId}/2`,
        fileName: "design-v2.png",
        sizeBytes: 20,
        sha256: "def",
        uploadedById: uploader.userId,
      },
    });

    const detail = await getReviewDetail(reviewer, workItemId);

    expect(detail.versions).toHaveLength(2);
    expect(detail.currentVersion?.version).toBe(2);
    expect(detail.order.quantity).toBe(100);
    expect(detail.order.material).toBe("Vinyl");
    expect(detail.order.customerNotes).toBe("Customer wants matte finish");
  });

  it("throws DomainReviewError WORK_ITEM_NOT_FOUND for a missing Work Item", async () => {
    const reviewer = await createActor(["design.review"]);

    await expect(getReviewDetail(reviewer, "does-not-exist")).rejects.toBeInstanceOf(DomainReviewError);
    await expect(getReviewDetail(reviewer, "does-not-exist")).rejects.toMatchObject({
      code: "WORK_ITEM_NOT_FOUND",
    });
  });
});

describe("review contract: approveDesign", () => {
  it("requires design.review — FORBIDDEN without it", async () => {
    const actor = await createActor([]);
    const uploader = await createActor(["design.work"]);
    const { workItemId } = await seedWaitingReviewWorkItem(uploader.userId);

    await expect(approveDesign(actor, workItemId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("sets approvedAt/approvedById on the current version and transitions to APPROVED", async () => {
    const reviewer = await createActor(["design.review"]);
    const uploader = await createActor(["design.work"]);
    const { workItemId } = await seedWaitingReviewWorkItem(uploader.userId);

    await approveDesign(reviewer, workItemId);

    const version = await testDb.designVersion.findFirstOrThrow({ where: { workItemId } });
    expect(version.approvedAt).not.toBeNull();
    expect(version.approvedById).toBe(reviewer.userId);

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("APPROVED");
  });
});

describe("review contract: rejectDesign", () => {
  it("requires design.review — FORBIDDEN without it", async () => {
    const actor = await createActor([]);
    const uploader = await createActor(["design.work"]);
    const { workItemId } = await seedWaitingReviewWorkItem(uploader.userId);

    await expect(
      rejectDesign(actor, workItemId, {
        category: "DESIGN_ISSUE",
        originDepartmentId: departmentId,
        explanation: "needs rework",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a submission missing category/originDepartmentId/explanation with a validation error and no state change", async () => {
    const reviewer = await createActor(["design.review"]);
    const uploader = await createActor(["design.work"]);
    const { workItemId } = await seedWaitingReviewWorkItem(uploader.userId);

    await expect(
      rejectDesign(reviewer, workItemId, {
        category: undefined as unknown as "DESIGN_ISSUE",
        originDepartmentId: departmentId,
        explanation: "needs rework",
      }),
    ).rejects.toThrow();

    await expect(
      rejectDesign(reviewer, workItemId, {
        category: "DESIGN_ISSUE",
        originDepartmentId: departmentId,
        explanation: "   ",
      }),
    ).rejects.toThrow();

    const unchanged = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(unchanged.state).toBe("WAITING_REVIEW");
  });

  it("on valid input returns { returnId }, transitions to REWORK_REQUIRED, creates a Return row", async () => {
    const reviewer = await createActor(["design.review"]);
    const uploader = await createActor(["design.work"]);
    const { workItemId } = await seedWaitingReviewWorkItem(uploader.userId);

    const result = await rejectDesign(reviewer, workItemId, {
      category: "DIMENSION_ISSUE",
      originDepartmentId: departmentId,
      explanation: "Dimensions are off by 2cm",
    });

    expect(typeof result.returnId).toBe("string");

    const workItem = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(workItem.state).toBe("REWORK_REQUIRED");

    const returnRow = await testDb.return.findUniqueOrThrow({ where: { id: result.returnId } });
    expect(returnRow.category).toBe("DIMENSION_ISSUE");
    expect(returnRow.originDepartmentId).toBe(departmentId);
    expect(returnRow.explanation).toBe("Dimensions are off by 2cm");
    expect(returnRow.raisedById).toBe(reviewer.userId);
    expect(returnRow.assignedToId).toBe(uploader.userId);
  });
});
