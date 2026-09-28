/**
 * groupMoveWorkItems: executes group moves for all eligible sibling items of an Order.
 * Each item runs in its OWN transaction through moveWorkItem dispatcher.
 * (specs/017-press-floor-board/data-model.md §3.5, contracts/board-server.md, FR-019)
 */

import type { Actor } from "~/server/auth";
import type { BoardCard, GroupMoveItemResult, GroupMoveRequest, GroupMoveResult } from "~/lib/board/types";
import { db } from "~/server/db";
import { getBoardCards } from "./snapshot";
import { moveWorkItem } from "./move";

interface ItemContext {
  readonly card: BoardCard | undefined;
  readonly itemId: string;
  readonly req: GroupMoveRequest;
}

async function processSingleItem(
  actor: Actor,
  ctx: ItemContext,
): Promise<GroupMoveItemResult> {
  const { card, itemId, req } = ctx;
  if (!card) {
    return { workItemId: itemId, status: "NOT_ELIGIBLE", reasonAr: "الطلب غير مرئي للمستخدم الحالي" };
  }
  const matchingMove = card.moves.find((m) => m.to === req.to);
  if (!matchingMove) {
    return { workItemId: itemId, status: "NOT_ELIGIBLE", reasonAr: "الحالة الحالية لا تقبل الانتقال المطلوب" };
  }
  const moveRes = await moveWorkItem(actor, {
    workItemId: card.id,
    edgeId: matchingMove.edgeId,
    input: req.input,
    clientMoveId: `${req.clientMoveId}-${card.id}`,
  });
  if (moveRes.ok) {
    return { workItemId: card.id, status: "MOVED", card: moveRes.card };
  }
  return { workItemId: card.id, status: "REFUSED", code: moveRes.code, messageAr: moveRes.messageAr };
}

export async function groupMoveWorkItems(
  actor: Actor,
  req: GroupMoveRequest,
): Promise<GroupMoveResult> {
  const orderWorkItems = await db.workItem.findMany({
    where: { orderId: req.orderId },
    select: { id: true },
  });

  const allCards = await getBoardCards(actor, orderWorkItems.map((w) => w.id));
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const items: GroupMoveItemResult[] = [];

  for (const item of orderWorkItems) {
    const res = await processSingleItem(actor, {
      card: cardMap.get(item.id),
      itemId: item.id,
      req,
    });
    items.push(res);
  }

  return { orderId: req.orderId, to: req.to, items };
}
