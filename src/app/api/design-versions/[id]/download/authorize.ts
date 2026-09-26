// Download authorization for design-version files (050 FR-004).
// Colocated OUTSIDE route.ts on purpose: Next's generated route types
// reject extra exports from route modules, so `authorizeDownload` lives
// here and is imported by both the route and its contract test.

import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";

export function authorizeDownload(
  actor: Actor,
  designVersion: {
    approvedAt: Date | null;
    workItem: {
      departmentId: string | null;
      assigneeId: string | null;
      productType: { defaultDepartmentId: string | null } | null;
    };
  },
): void {
  const departmentId =
    designVersion.workItem.departmentId ??
    designVersion.workItem.productType?.defaultDepartmentId ??
    undefined;

  // 1. Admin override
  if (actor.permissions.has("admin.override")) {
    authorize(actor, "admin.override");
    return;
  }

  // 2. Head Designer / Reviewer
  if (actor.permissions.has("design.review")) {
    authorize(actor, "design.review");
    return;
  }

  // 3. Assigned Designer
  if (
    actor.permissions.has("design.work") &&
    actor.userId === designVersion.workItem.assigneeId
  ) {
    authorize(actor, "design.work");
    return;
  }

  // Production operators can only download approved files (FR-004)
  if (!designVersion.approvedAt) {
    throw new Error("FORBIDDEN");
  }

  // 4. Production Operator with files.download_production (scoped to department)
  if (actor.permissions.has("files.download_production")) {
    authorize(actor, "files.download_production", { departmentId });
    return;
  }

  // 5. Production Operator with production.operate (scoped to department)
  if (actor.permissions.has("production.operate")) {
    authorize(actor, "production.operate", { departmentId });
    return;
  }

  // Fallback: will throw ForbiddenError
  authorize(actor, "files.download_production", { departmentId });
}
