/**
 * Review Edge Handlers.
 * (research.md R3, constitution II, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import { REJECTION_CATEGORIES } from "~/server/core";
import { approveDesign, rejectDesign } from "~/server/review";
import type { EdgeHandler } from "../edgeCatalog";

const rejectDesignSchema = z.object({
  category: z.enum(REJECTION_CATEGORIES),
  originDepartmentId: z.string().trim().optional(),
  explanation: z.string().trim().min(1, "يجب إدخال سبب الرفض"),
  note: z.string().trim().optional(),
});

export class SelfReviewForbiddenError extends Error {
  readonly code = "GUARD_FAILED";
  constructor() {
    super("لا يمكنك مراجعة تصميمك بنفسك");
    this.name = "SelfReviewForbiddenError";
  }
}

export const waitingReviewToApproved: EdgeHandler = {
  edgeId: "WAITING_REVIEW->APPROVED",
  kind: "DIRECT",
  permission: "design.review",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "اعتماد التصميم",
  precheck(actor, card) {
    const isAdmin = actor.permissions.has("admin.override") || actor.roles.includes("ADMIN_OWNER");
    if (!isAdmin && card.assignee?.id === actor.userId) {
      return { ok: false, hintAr: "لا يمكنك مراجعة تصميمك بنفسك" };
    }
    return { ok: true };
  },
  async execute(actor, card) {
    const isAdmin = actor.permissions.has("admin.override") || actor.roles.includes("ADMIN_OWNER");
    if (!isAdmin && card.assignee?.id === actor.userId) {
      throw new SelfReviewForbiddenError();
    }
    await approveDesign(actor, card.id);
  },
};

export const waitingReviewToReworkRequired: EdgeHandler = {
  edgeId: "WAITING_REVIEW->REWORK_REQUIRED",
  kind: "SHEET",
  sheet: "reject-design",
  permission: "design.review",
  inputSchema: rejectDesignSchema,
  backward: true,
  destructive: false,
  groupable: false,
  labelAr: "طلب تعديل",
  async execute(actor, card, input) {
    const data = rejectDesignSchema.parse(input);
    const originDepartmentId =
      data.originDepartmentId ?? card.departmentId ?? actor.departmentIds[0] ?? "general";
    await rejectDesign(actor, card.id, {
      category: data.category,
      originDepartmentId,
      explanation: data.explanation,
      note: data.note,
    });
  },
};

export const reviewEdges: readonly EdgeHandler[] = [
  waitingReviewToApproved,
  waitingReviewToReworkRequired,
];
