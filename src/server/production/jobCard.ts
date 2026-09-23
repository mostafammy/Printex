// jobCard.ts — getJobCard (US2). contracts/production.md.
//
// Read-only — no `db.$transaction`, no audit event. Offers only the
// Head-Designer-approved DesignVersion pointer, never a draft (FR-004).
// Actual file bytes are served by 050's download route (plan.md "Consumes");
// this module only resolves which version is downloadable and its pointer.

import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { DomainProductionError } from "./errors";
import { effectiveDepartmentId } from "./department";

export interface JobCardSpec {
  description: string | null;
  quantity: number | null;
  widthValue: string | null;
  heightValue: string | null;
  dimensionUnit: string | null;
  material: string | null;
  finishNotes: string | null;
}

export interface JobCardApprovedFile {
  versionId: string;
  fileName: string;
  /** 050's download route — this module only resolves the pointer, not bytes. */
  downloadUrl: string;
}

export interface JobCard {
  workItemId: string;
  state: string;
  order: { id: string; number: number; customerName: string };
  spec: JobCardSpec;
  approvedFile: JobCardApprovedFile | null;
  pendingFileRevisionAt: Date | null;
}

export async function getJobCard(actor: Actor, workItemId: string): Promise<JobCard> {
  const workItem = await db.workItem.findUnique({
    where: { id: workItemId },
    include: {
      order: { include: { customer: { select: { name: true } } } },
      productType: { select: { defaultDepartmentId: true } },
    },
  });
  if (!workItem) {
    throw new DomainProductionError("WORK_ITEM_NOT_FOUND", "Work Item not found");
  }

  authorize(actor, "production.operate", {
    departmentId: effectiveDepartmentId(workItem) ?? undefined,
  });

  const approvedVersion = await db.designVersion.findFirst({
    where: { workItemId, approvedAt: { not: null } },
    orderBy: { version: "desc" },
  });

  return {
    workItemId: workItem.id,
    state: workItem.state,
    order: {
      id: workItem.order.id,
      number: workItem.order.number,
      customerName: workItem.order.customer.name,
    },
    spec: {
      description: workItem.description,
      quantity: workItem.quantity,
      widthValue: workItem.widthValue?.toString() ?? null,
      heightValue: workItem.heightValue?.toString() ?? null,
      dimensionUnit: workItem.dimensionUnit,
      material: workItem.material,
      finishNotes: workItem.finishNotes,
    },
    approvedFile: approvedVersion
      ? {
          versionId: approvedVersion.id,
          fileName: approvedVersion.fileName,
          downloadUrl: `/api/design-versions/${approvedVersion.id}/download`,
        }
      : null,
    pendingFileRevisionAt: workItem.pendingFileRevisionAt,
  };
}
