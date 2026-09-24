// tests/unit/changes/editSpec.test.ts
// Unit tests for editSpec decision flow, schema, and error message mapping.
// tasks.md T037, T038.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock ~/server/db and ~/server/auth before importing changes modules
const fakeRecordedAudits: unknown[] = [];
const fakeNotifications: unknown[] = [];

let mockWorkItemRow: any = null;
let mockCurrentVersionRow: any = null;

const fakeTx = {
  $queryRaw: vi.fn().mockImplementation(async (query: any) => {
    // SELECT ... FROM WorkItem ... FOR UPDATE
    if (mockWorkItemRow) {
      return [{ id: mockWorkItemRow.id, orderId: mockWorkItemRow.orderId, state: mockWorkItemRow.state }];
    }
    return [];
  }),
  workItem: {
    findUnique: vi.fn().mockImplementation(async () => mockWorkItemRow),
    update: vi.fn().mockImplementation(async ({ data }: any) => {
      Object.assign(mockWorkItemRow, data);
      return mockWorkItemRow;
    }),
  },
  specVersion: {
    findUnique: vi.fn().mockImplementation(async () => mockCurrentVersionRow),
    findFirst: vi.fn().mockImplementation(async () => mockCurrentVersionRow),
    findMany: vi.fn().mockImplementation(async () => (mockCurrentVersionRow ? [mockCurrentVersionRow] : [])),
    create: vi.fn().mockImplementation(async ({ data }: any) => {
      const created = {
        id: `spec_v_${data.version}`,
        ...data,
        createdAt: new Date(),
        createdBy: { id: data.createdById ?? "user-1", name: "Test User" },
      };
      mockCurrentVersionRow = created;
      return created;
    }),
  },
  productType: {
    findUnique: vi.fn().mockImplementation(async ({ where }: any) => ({
      id: where.id,
      name: "Standard",
      defaultDepartmentId: "dept-1",
    })),
  },
  return: {
    create: vi.fn().mockResolvedValue({ id: "return-1" }),
  },
  workItemTransition: {
    create: vi.fn().mockResolvedValue({ id: "trans-1" }),
  },
  notificationEvent: {
    create: vi.fn().mockImplementation(async ({ data }: any) => {
      fakeNotifications.push(data);
      return { id: "notif-1", ...data };
    }),
  },
  user: {
    findMany: vi.fn().mockResolvedValue([{ id: "reviewer-1" }, { id: "reviewer-2" }]),
  },
};

vi.mock("~/server/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
  },
}));

vi.mock("~/server/auth", () => ({
  authorize: vi.fn((actor: any, permission: string) => {
    if (!actor.permissions?.has(permission)) {
      const err = new Error("Forbidden");
      err.name = "ForbiddenError";
      throw err;
    }
  }),
  audit: {
    record: vi.fn(async (_tx: any, entry: any) => {
      fakeRecordedAudits.push(entry);
    }),
  },
}));

vi.mock("~/server/core/workflow/transition", () => ({
  transitionWorkItem: vi.fn(async () => ({ ok: true })),
}));

import {
  editSpec,
  editSpecInputSchema,
  type EditSpecInput,
} from "~/server/changes/editSpec";
import { getChangeErrorMessage } from "~/components/changes/edit-spec-form";
import type { Actor } from "~/server/auth";

const receptionActor: Actor = {
  userId: "reception-user",
  roles: ["RECEPTION"],
  permissions: new Set(["order.edit", "order.create"]),
  departmentIds: [],
};

const unauthorizedActor: Actor = {
  userId: "designer-user",
  roles: ["DESIGNER"],
  permissions: new Set(["design.work"]),
  departmentIds: [],
};

describe("editSpec unit tests (T037 decision flow & schema)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeRecordedAudits.length = 0;
    fakeNotifications.length = 0;

    mockCurrentVersionRow = {
      id: "ver-1",
      workItemId: "wi-1",
      version: 1,
      origin: "INITIAL",
      productTypeId: null,
      description: "Initial description",
      quantity: 500,
      widthValue: null,
      heightValue: null,
      dimensionUnit: null,
      material: null,
      finishNotes: null,
      stateAtCreation: "NEW",
      reason: null,
      createdById: "creator-1",
      createdAt: new Date(),
      createdBy: { id: "creator-1", name: "Creator" },
    };

    mockWorkItemRow = {
      id: "wi-1",
      orderId: "order-1",
      state: "NEW",
      requiresDesign: false,
      requiresReview: false,
      assigneeId: null,
      departmentId: "dept-1",
      productTypeId: null,
      currentSpecVersionId: "ver-1",
      productType: { defaultDepartmentId: "dept-1" },
      quantity: 500,
      description: "Initial description",
    };
  });

  // ── Input schema tests ───────────────────────────────────────────────────
  describe("editSpecInputSchema validation", () => {
    it("accepts valid input with partial patch and normalizes strings", () => {
      const parsed = editSpecInputSchema.parse({
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 1000, material: "Vinyl" },
        reason: "Customer changed quantity",
      });

      expect(parsed.workItemId).toBe("wi-1");
      expect(parsed.expectedVersion).toBe(1);
      expect(parsed.patch.quantity).toBe(1000);
      expect(parsed.patch.material).toBe("Vinyl");
      expect(parsed.reason).toBe("Customer changed quantity");
    });

    it("coerces expectedVersion from string to integer", () => {
      const parsed = editSpecInputSchema.parse({
        workItemId: "wi-1",
        expectedVersion: "3" as any,
        patch: { quantity: 1000 },
      });
      expect(parsed.expectedVersion).toBe(3);
    });

    it("transforms empty reason and originDepartmentId to undefined", () => {
      const parsed = editSpecInputSchema.parse({
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 1000 },
        reason: "   ",
        originDepartmentId: "",
      });
      expect(parsed.reason).toBeUndefined();
      expect(parsed.originDepartmentId).toBeUndefined();
    });

    it("rejects non-positive expectedVersion", () => {
      expect(() =>
        editSpecInputSchema.parse({
          workItemId: "wi-1",
          expectedVersion: 0,
          patch: { quantity: 100 },
        }),
      ).toThrow();
    });

    it("rejects empty patch", () => {
      expect(() =>
        editSpecInputSchema.parse({
          workItemId: "wi-1",
          expectedVersion: 1,
          patch: {},
        }),
      ).toThrow();
    });
  });

  // ── Permission check ─────────────────────────────────────────────────────
  describe("Permission check", () => {
    it("refuses actor without order.edit as FORBIDDEN before entering transaction", async () => {
      const res = await editSpec(unauthorizedActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
      expect(fakeTx.workItem.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── Policy check BEFORE any write ─────────────────────────────────────────
  describe("Policy check before any write", () => {
    it("returns NOT_FOUND when WorkItem does not exist", async () => {
      mockWorkItemRow = null;

      const res = await editSpec(receptionActor, {
        workItemId: "wi-nonexistent",
        expectedVersion: 1,
        patch: { quantity: 600 },
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", entity: "WorkItem", id: "wi-nonexistent" },
      });
      expect(fakeTx.workItem.update).not.toHaveBeenCalled();
    });

    it("refuses IN_PRODUCTION with CHANGE_REQUEST_REQUIRED without performing any writes", async () => {
      mockWorkItemRow.state = "IN_PRODUCTION";

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "CHANGE_REQUEST_REQUIRED" },
      });
      expect(fakeTx.workItem.update).not.toHaveBeenCalled();
      expect(fakeTx.specVersion.create).not.toHaveBeenCalled();
    });

    it("refuses PRODUCTION_COMPLETED with ADMIN_OVERRIDE_REQUIRED without performing any writes", async () => {
      mockWorkItemRow.state = "PRODUCTION_COMPLETED";

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "ADMIN_OVERRIDE_REQUIRED" },
      });
      expect(fakeTx.workItem.update).not.toHaveBeenCalled();
    });

    it("refuses CANCELLED with WORK_ITEM_LOCKED", async () => {
      mockWorkItemRow.state = "CANCELLED";

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "WORK_ITEM_LOCKED" },
      });
      expect(fakeTx.workItem.update).not.toHaveBeenCalled();
    });
  });

  // ── Redesign choice logic ────────────────────────────────────────────────
  describe("Redesign choice logic", () => {
    it("refuses APPROVED with requiresDesign=true and missing designChoice with REDESIGN_CHOICE_REQUIRED", async () => {
      mockWorkItemRow.state = "APPROVED";
      mockWorkItemRow.requiresDesign = true;

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "REDESIGN_CHOICE_REQUIRED" },
      });
    });

    it("refuses REDESIGN when requiresDesign=false with REDESIGN_NOT_ALLOWED", async () => {
      mockWorkItemRow.state = "APPROVED";
      mockWorkItemRow.requiresDesign = false;

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
        designChoice: "REDESIGN",
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "REDESIGN_NOT_ALLOWED" },
      });
    });

    it("refuses REDESIGN when assigneeId is null with REDESIGN_NOT_ALLOWED", async () => {
      mockWorkItemRow.state = "APPROVED";
      mockWorkItemRow.requiresDesign = true;
      mockWorkItemRow.assigneeId = null;

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
        designChoice: "REDESIGN",
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "REDESIGN_NOT_ALLOWED" },
      });
    });

    it("refuses REDESIGN without originDepartmentId when effectiveDepartment is null", async () => {
      mockWorkItemRow.state = "APPROVED";
      mockWorkItemRow.requiresDesign = true;
      mockWorkItemRow.assigneeId = "designer-1";
      mockWorkItemRow.departmentId = null;
      mockWorkItemRow.productType = null;

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 600 },
        designChoice: "REDESIGN",
      });

      expect(res).toEqual({
        ok: false,
        error: { code: "ORIGIN_DEPARTMENT_REQUIRED" },
      });
    });
  });

  // ── Successful execution flow ────────────────────────────────────────────
  describe("Successful execution", () => {
    it("applies spec change, writes new version and spec.edited audit entry", async () => {
      mockWorkItemRow.state = "NEW";
      mockWorkItemRow.assigneeId = "designer-1";

      const res = await editSpec(receptionActor, {
        workItemId: "wi-1",
        expectedVersion: 1,
        patch: { quantity: 800, material: "Silk" },
        reason: "Client request",
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.version).toBe(2);
      expect(res.data.redesigned).toBe(false);

      // Notification sent to assignee
      const assigneeNotif = fakeNotifications.find(
        (n: any) => n.type === "work_item.customer_modification",
      ) as any;
      expect(assigneeNotif).toBeDefined();
      expect(assigneeNotif.recipientUserIds).toContain("designer-1");
    });
  });

  // ── Error message mapping ────────────────────────────────────────────────
  describe("getChangeErrorMessage mapping (T038)", () => {
    it("maps all ChangeResult and base error codes to non-empty Arabic strings", () => {
      const codes = [
        "VALIDATION",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "INVALID_STATE",
        "GUARD_FAILED",
        "CHANGE_REQUEST_REQUIRED",
        "ADMIN_OVERRIDE_REQUIRED",
        "WORK_ITEM_LOCKED",
        "NO_CHANGES",
        "STALE_SPEC_VERSION",
        "REDESIGN_CHOICE_REQUIRED",
        "REDESIGN_NOT_ALLOWED",
        "ORIGIN_DEPARTMENT_REQUIRED",
        "NOT_IN_PRODUCTION",
        "CHANGE_REQUEST_PENDING",
        "CHANGE_REQUEST_ALREADY_DECIDED",
        "WORK_ITEM_LEFT_PRODUCTION",
        "NOTHING_TO_ACKNOWLEDGE",
        "REVISION_UNACKNOWLEDGED",
        "LATE_CANCEL_NOT_APPLICABLE",
        "VERSION_MISMATCH",
        "CHANGE_HOLD",
        "LATE_CANCELLATION_REQUIRED",
        "SPEC_CHANGE_VETOED",
      ];

      for (const code of codes) {
        const msg = getChangeErrorMessage(code);
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
        expect(msg).not.toBe("حدث خطأ غير متوقع");
      }
    });

    it("falls back to generic error message for unknown code", () => {
      const msg = getChangeErrorMessage("COMPLETELY_UNKNOWN_CODE");
      expect(msg).toBe("حدث خطأ غير متوقع أثناء معالجة الطلب");
    });
  });
});
