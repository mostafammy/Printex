// workload.ts — getDepartmentWorkload (Polish, T042). contracts/production.md.
// Cross-department summary for 090's dashboard — no per-department scoping
// (contracts/production.md's Authorization table: "No (cross-department
// summary)").

import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";

export interface DepartmentWorkload {
  departmentId: string;
  departmentName: string;
  readyCount: number;
  inProductionCount: number;
}

export async function getDepartmentWorkload(actor: Actor): Promise<DepartmentWorkload[]> {
  authorize(actor, "production.operate");

  const departments = await db.department.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          workItems: { where: { state: "READY_FOR_PRODUCTION" } },
        },
      },
    },
  });

  const inProductionCounts = await db.workItem.groupBy({
    by: ["departmentId"],
    where: { state: "IN_PRODUCTION", departmentId: { not: null } },
    _count: { _all: true },
  });
  const inProductionByDept = new Map(
    inProductionCounts.map((row) => [row.departmentId, row._count._all]),
  );

  return departments.map((dept) => ({
    departmentId: dept.id,
    departmentName: dept.name,
    readyCount: dept._count.workItems,
    inProductionCount: inProductionByDept.get(dept.id) ?? 0,
  }));
}
