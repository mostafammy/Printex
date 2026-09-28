/**
 * Floor visibility rules and Prisma query translator.
 * Single source of truth for who sees which card (snapshot and live stream).
 * (specs/017-press-floor-board/research.md R6, contracts/board-server.md §Visibility, FR-022, plan.md S1)
 */

import type { Prisma } from "../../../generated/prisma";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth/permissions";
import type { WorkItemState } from "~/server/core";

export interface WorkItemVisibilityItem {
  readonly id: string;
  readonly state: WorkItemState;
  readonly assigneeId?: string | null;
  readonly assignee?: { readonly id: string } | null;
  readonly departmentId?: string | null;
  readonly effectiveDepartmentId?: string | null;
}

const FLOOR_WIDE_PERMISSIONS: readonly Permission[] = [
  "order.create",
  "order.edit",
  "design.review",
  "pricing.use_fixed",
  "pricing.set_variable",
  "collection.receive",
  "delivery.record",
  "audit.view",
  "admin.users",
  "admin.config",
  "admin.override",
] as const;

const PRODUCTION_ONWARD_STATES: readonly WorkItemState[] = [
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION",
  "PRODUCTION_COMPLETED",
  "READY_FOR_COLLECTION",
  "DELIVERED",
  "COMPLETED",
] as const;

export function hasFloorWideVisibility(actor: Actor): boolean {
  for (const perm of FLOOR_WIDE_PERMISSIONS) {
    if (actor.permissions.has(perm)) {
      return true;
    }
  }
  return false;
}

function canDesignerSee(actor: Actor, item: WorkItemVisibilityItem): boolean {
  if (!actor.permissions.has("design.work")) return false;
  const assigneeId = item.assigneeId ?? item.assignee?.id ?? null;
  return assigneeId === actor.userId;
}

function canProductionOperatorSee(actor: Actor, item: WorkItemVisibilityItem): boolean {
  if (!actor.permissions.has("production.operate")) return false;
  const deptId = item.effectiveDepartmentId ?? item.departmentId ?? null;
  if (!deptId || !actor.departmentIds.includes(deptId)) return false;
  return PRODUCTION_ONWARD_STATES.includes(item.state);
}

export function canSeeWorkItem(
  actor: Actor,
  item: WorkItemVisibilityItem,
): boolean {
  if (hasFloorWideVisibility(actor)) return true;
  if (canDesignerSee(actor, item)) return true;
  return canProductionOperatorSee(actor, item);
}

export function toPrismaWhere(actor: Actor): Prisma.WorkItemWhereInput {
  if (hasFloorWideVisibility(actor)) {
    return {};
  }

  const conditions: Prisma.WorkItemWhereInput[] = [];

  if (actor.permissions.has("design.work")) {
    conditions.push({ assigneeId: actor.userId });
  }

  if (actor.permissions.has("production.operate") && actor.departmentIds.length > 0) {
    conditions.push({
      state: { in: [...PRODUCTION_ONWARD_STATES] },
      OR: [
        { departmentId: { in: [...actor.departmentIds] } },
        {
          departmentId: null,
          productType: { defaultDepartmentId: { in: [...actor.departmentIds] } },
        },
      ],
    });
  }

  if (conditions.length === 0) {
    return { id: "impossible_actor_has_no_board_access" };
  }

  if (conditions.length === 1) {
    return conditions[0]!;
  }

  return { OR: conditions };
}
