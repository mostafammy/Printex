"use server";

/**
 * Server Actions for Press Floor Board.
 * Thin wrappers verifying actor authentication and calling server modules.
 * (specs/017-press-floor-board/contracts/board-server.md, plan.md S1)
 */

import type {
  BoardCard,
  BoardSnapshot,
  GroupMoveRequest,
  GroupMoveResult,
  LanePage,
  LanePageRequest,
  MoveRequest,
  MoveResult,
  SnapshotRequest,
} from "~/lib/board/types";
import { getActor } from "~/server/auth";
import {
  getBoardCards,
  getBoardLanePage,
  getBoardSnapshot,
  getWorkItemDetail,
  groupMoveWorkItems,
  moveWorkItem,
  type WorkItemFullDetail,
} from "~/server/board";
import { searchOrders } from "~/server/orders/search";
import { findCustomers } from "~/server/customers";
import { getEligibleDesigners } from "~/server/designers";
import { db } from "~/server/db";

export async function getWorkItemDetailAction(
  workItemId: string,
): Promise<WorkItemFullDetail | null> {
  const actor = await getActor();
  return getWorkItemDetail(actor, workItemId);
}

export async function getBoardSnapshotAction(
  request?: SnapshotRequest,
): Promise<BoardSnapshot> {
  const actor = await getActor();
  return getBoardSnapshot(actor, request);
}

export async function getBoardCardsAction(
  ids: readonly string[],
): Promise<BoardCard[]> {
  const actor = await getActor();
  return getBoardCards(actor, ids);
}

export async function getBoardLanePageAction(
  request: LanePageRequest,
): Promise<LanePage> {
  const actor = await getActor();
  return getBoardLanePage(actor, request);
}

export async function moveWorkItemAction(
  req: MoveRequest,
): Promise<MoveResult> {
  const actor = await getActor();
  return moveWorkItem(actor, req);
}

export async function groupMoveWorkItemsAction(
  req: GroupMoveRequest,
): Promise<GroupMoveResult> {
  const actor = await getActor();
  return groupMoveWorkItems(actor, req);
}

export async function searchOrdersAction(query: string) {
  const actor = await getActor();
  const trimmed = query.trim();
  const num = parseInt(trimmed, 10);
  const q = !isNaN(num) ? { orderNumber: num } : { customerName: trimmed };
  const results = await searchOrders(actor, q);
  return results.slice(0, 10).map((o) => ({
    id: o.orderId,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    status: o.status,
  }));
}

export async function searchCustomersAction(query: string) {
  try {
    const results = await findCustomers({ text: query, limit: 10 });
    return results.map((c) => ({
      id: c.id,
      name: c.name,
    }));
  } catch {
    return [];
  }
}

export async function getEligibleDesignersAction(
  workItemId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    activeCount: number;
    queueSize?: number;
    estimatedWaitMinutes?: number;
    pastJobsForCustomer?: number;
    isSuggested: boolean;
  }>
> {
  const actor = await getActor();
  try {
    const list = await getEligibleDesigners(actor, workItemId);
    return list.map((d) => ({
      id: d.userId,
      name: d.name,
      activeCount: d.activeWorkItemCount,
      queueSize: d.queueSize,
      estimatedWaitMinutes: d.estimatedWaitMinutes,
      pastJobsForCustomer: d.pastJobsForCustomer,
      isSuggested: d.isSuggested,
    }));
  } catch (error) {
    console.warn("getEligibleDesigners fallback for", workItemId, error);
    const fallbackUsers = await db.user.findMany({
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
    return fallbackUsers.map((u, idx) => ({
      id: u.id,
      name: u.name,
      activeCount: 0,
      queueSize: 0,
      estimatedWaitMinutes: 0,
      pastJobsForCustomer: 0,
      isSuggested: idx === 0,
    }));
  }
}

export async function getDepartmentsAction(): Promise<Array<{ id: string; name: string }>> {
  const departments = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return departments;
}

