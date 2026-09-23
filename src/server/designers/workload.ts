// workload.ts — getDesignerWorkload (Polish, T039).
// contracts/designer-assignment.md: no authorize() beyond authenticated
// actor, whole-shop scope (not per-Work-Item) — same active-count query as
// assignment.ts's findActiveDesignWorkHolders/getEligibleDesigners.

import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import type { WorkItemState } from "~/server/core";

// Mirrors assignment.ts's TERMINAL_STATES — kept as a separate copy since
// each file owns its own query shape, not a shared abstraction.
const TERMINAL_STATES = new Set<WorkItemState>(["DELIVERED", "COMPLETED", "CANCELLED"]);

export interface DesignerWorkload {
  readonly userId: string;
  readonly name: string;
  readonly activeWorkItemCount: number;
}

export async function getDesignerWorkload(_actor: Actor): Promise<DesignerWorkload[]> {
  const designers = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { roles: { some: { role: { permissions: { some: { permission: "design.work" } } } } } },
        { extraPermissions: { some: { permission: "design.work" } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    designers.map(async (designer) => ({
      userId: designer.id,
      name: designer.name,
      activeWorkItemCount: await db.workItem.count({
        where: { assigneeId: designer.id, state: { notIn: [...TERMINAL_STATES] } },
      }),
    })),
  );
}
