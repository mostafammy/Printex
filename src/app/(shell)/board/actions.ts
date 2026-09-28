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
  MoveRequest,
  MoveResult,
  SnapshotRequest,
} from "~/lib/board/types";
import { getActor } from "~/server/auth";
import {
  getBoardCards,
  getBoardSnapshot,
  groupMoveWorkItems,
  moveWorkItem,
} from "~/server/board";
import { searchOrders } from "~/server/orders/search";
import { findCustomers } from "~/server/customers";

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
