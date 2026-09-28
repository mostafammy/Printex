/**
 * Snapshot server queries for press floor board.
 * (contracts/board-server.md §getBoardSnapshot, §getBoardCards, plan.md S1)
 */

import type { Prisma } from "../../../generated/prisma";
import type { BlockedHint, BoardCard, BoardSnapshot, SnapshotRequest } from "~/lib/board/types";
import type { Actor } from "~/server/auth";
import type { WorkItemState } from "~/server/core";
import { db } from "~/server/db";
import { loadStationTargetsConfig, type StationTargets } from "./config";
import { edgeCatalog } from "./edges";
import { fetchRawWorkItemRows, mapRowToBoardCard, type RawWorkItemRow } from "./projection";
import { type SliceId, SLICES, resolveAvailableSlices, resolveDefaultSlice } from "./slices";
import { OFF_BOARD_STATES, STATE_PLACEMENT } from "./stations";
import { toPrismaWhere } from "./visibility";

function mapRowWithMoves(
  row: RawWorkItemRow,
  targets: StationTargets,
  actor: Actor,
): BoardCard {
  const baseCard = mapRowToBoardCard(row, targets);
  const moves = edgeCatalog.offer(actor, baseCard);
  return { ...baseCard, moves };
}

function buildSnapshotWhere(
  actor: Actor,
  request?: SnapshotRequest,
  slice?: SliceId,
): Prisma.WorkItemWhereInput {
  const where: Prisma.WorkItemWhereInput = {
    AND: [toPrismaWhere(actor)],
  };
  const andList = where.AND as Prisma.WorkItemWhereInput[];

  if (!request?.filters?.archive) {
    andList.push({ state: { notIn: [...OFF_BOARD_STATES] } });
  }

  const sliceDef = SLICES.find((s) => s.id === slice);
  if (sliceDef && sliceDef.id !== "floor") {
    const states = (
      Object.entries(STATE_PLACEMENT) as [WorkItemState, (typeof STATE_PLACEMENT)[WorkItemState]][]
    )
      .filter(([_, p]) => p !== "OFF_BOARD" && sliceDef.stations.includes(p.station))
      .map(([st]) => st);
    andList.push({ state: { in: states } });
  }

  return where;
}

export async function getBoardSnapshot(
  actor: Actor,
  request?: SnapshotRequest,
  prismaClient = db,
): Promise<BoardSnapshot> {
  const availableSlices = resolveAvailableSlices(actor.roles);
  const defaultSlice = resolveDefaultSlice(actor.roles);
  const slice =
    request?.slice && availableSlices.includes(request.slice)
      ? request.slice
      : defaultSlice;

  const targets = loadStationTargetsConfig();
  const where = buildSnapshotWhere(actor, request, slice);
  const rawRows = await fetchRawWorkItemRows(where, prismaClient);
  const cards = rawRows.map((r) => mapRowWithMoves(r, targets, actor));

  const hiddenSiblingCounts = await computeHiddenSiblings(cards, prismaClient);
  const blockedHints = computeBlockedHints(cards);

  return {
    generatedAt: new Date().toISOString(),
    cards,
    hiddenSiblingCounts,
    slice,
    availableSlices,
    blockedHints,
  };
}

export async function getBoardCards(
  actor: Actor,
  ids: readonly string[],
  prismaClient = db,
): Promise<BoardCard[]> {
  const targets = loadStationTargetsConfig();
  const where: Prisma.WorkItemWhereInput = {
    AND: [toPrismaWhere(actor), { id: { in: [...ids] } }],
  };

  const rawRows = await fetchRawWorkItemRows(where, prismaClient);
  return rawRows.map((r) => mapRowWithMoves(r, targets, actor));
}

function countVisibleByOrder(cards: readonly BoardCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    if (c.state !== "COMPLETED" && c.state !== "CANCELLED") {
      counts[c.orderId] = (counts[c.orderId] ?? 0) + 1;
    }
  }
  return counts;
}

async function computeHiddenSiblings(
  cards: readonly BoardCard[],
  prismaClient = db,
): Promise<Record<string, number>> {
  const orderIds = [...new Set(cards.map((c) => c.orderId))];
  if (orderIds.length === 0) return {};

  const orderCounts = await prismaClient.workItem.groupBy({
    by: ["orderId"],
    where: { orderId: { in: orderIds }, state: { notIn: [...OFF_BOARD_STATES] } },
    _count: { id: true },
  });

  const visibleCounts = countVisibleByOrder(cards);
  const hidden: Record<string, number> = {};
  for (const oc of orderCounts) {
    const diff = oc._count.id - (visibleCounts[oc.orderId] ?? 0);
    if (diff > 0) hidden[oc.orderId] = diff;
  }
  return hidden;
}

function computeBlockedHints(cards: readonly BoardCard[]): BlockedHint[] {
  const hasPendingPricing = cards.some(
    (c) =>
      c.pricing === "PENDING" &&
      (c.state === "PRODUCTION_COMPLETED" || c.state === "READY_FOR_COLLECTION"),
  );

  if (hasPendingPricing) {
    return [{ station: "delivered", reasonAr: "يجب حسم التسعير أولاً" }];
  }
  return [];
}
