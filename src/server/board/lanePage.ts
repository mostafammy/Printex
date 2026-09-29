/**
 * Per-lane board pages: one bounded chunk per work-item state.
 * (contracts/board-server.md §getBoardSnapshot, plan.md S1)
 *
 * Each lane paginates independently — a lane's scroll position never
 * affects another lane. Lane queries filter by exact state on top of the
 * actor visibility scope, with stable createdAt+id ordering so consecutive
 * chunks neither overlap nor skip rows.
 */

import type { Prisma } from "../../../generated/prisma";
import type { BlockedHint, BoardCard, BoardPagination, BoardSnapshot, LanePage, LanePageRequest, SnapshotRequest } from "~/lib/board/types";
import type { Actor } from "~/server/auth";
import type { WorkItemState } from "~/server/core";
import { db } from "~/server/db";
import { PageRequest } from "~/server/pagination";
import { loadStationTargetsConfig } from "./config";
import { edgeCatalog } from "./edges";
import { fetchRawWorkItemRows, mapRowToBoardCard, type RawWorkItemRow } from "./projection";
import { SLICES, resolveAvailableSlices, resolveDefaultSlice, type SliceId } from "./slices";
import { OFF_BOARD_STATES, STATE_PLACEMENT } from "./stations";
import { toPrismaWhere } from "./visibility";

/** Renderable lane states for a slice, in station order. */
export function sliceLaneStates(slice: SliceId): WorkItemState[] {
  const stations = SLICES.find((s) => s.id === slice)?.stations ?? [];
  return (Object.entries(STATE_PLACEMENT) as [WorkItemState, (typeof STATE_PLACEMENT)[WorkItemState]][])
    .filter(([_, p]) => p !== "OFF_BOARD" && stations.includes(p.station))
    .map(([st]) => st);
}

function resolveLaneSlice(roles: Actor["roles"], requested?: SliceId): SliceId {
  const available = resolveAvailableSlices(roles);
  return requested && available.includes(requested) ? requested : resolveDefaultSlice(roles);
}

function emptyLanePage(state: WorkItemState, req: LanePageRequest): LanePage {
  const pageReq = PageRequest.of(req.pagination ?? {});
  return {
    state,
    cards: [],
    pagination: {
      page: pageReq.page, pageSize: pageReq.pageSize, totalCount: 0,
      hasMore: false, nextCursor: null,
    },
  };
}

function toLaneCard(row: RawWorkItemRow, actor: Actor): BoardCard {
  const base = mapRowToBoardCard(row, loadStationTargetsConfig());
  return { ...base, moves: edgeCatalog.offer(actor, base) };
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

export async function computeHiddenSiblings(
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

export function computeBlockedHints(cards: readonly BoardCard[]): BlockedHint[] {
  const hasPending = cards.some(
    (c) => c.pricing === "PENDING" && (c.state === "PRODUCTION_COMPLETED" || c.state === "READY_FOR_COLLECTION"),
  );
  return hasPending ? [{ station: "delivered", reasonAr: "يجب حسم التسعير أولاً" }] : [];
}

export async function getBoardLanePage(
  actor: Actor,
  req: LanePageRequest,
  prismaClient = db,
): Promise<LanePage> {
  const slice = resolveLaneSlice(actor.roles, req.slice);
  if (!sliceLaneStates(slice).includes(req.state)) return emptyLanePage(req.state, req);
  if (!req.filters?.archive && (OFF_BOARD_STATES as readonly string[]).includes(req.state)) {
    return emptyLanePage(req.state, req);
  }
  const where: Prisma.WorkItemWhereInput = { AND: [toPrismaWhere(actor), { state: req.state }] };
  const pageReq = PageRequest.of(req.pagination ?? {});
  const [rows, totalCount] = await Promise.all([
    fetchRawWorkItemRows(where, prismaClient, { page: pageReq.page, pageSize: pageReq.pageSize }),
    prismaClient.workItem.count({ where }),
  ]);
  const hasMore = pageReq.skip + rows.length < totalCount;
  return {
    state: req.state,
    cards: rows.map((r) => toLaneCard(r, actor)),
    pagination: {
      page: pageReq.page, pageSize: pageReq.pageSize, totalCount,
      hasMore, nextCursor: hasMore ? pageReq.page + 1 : null,
    },
  };
}

export interface LaneSnapshotInput {
  readonly actor: Actor;
  readonly request: SnapshotRequest;
  readonly slice: SliceId;
  readonly availableSlices: readonly SliceId[];
}

/**
 * Lane-mode snapshot: page 1 per lane state plus a cursor map, so every
 * lane paginates independently from the first paint.
 */
export async function getLaneSnapshot(
  input: LaneSnapshotInput,
  prismaClient = db,
): Promise<BoardSnapshot> {
  const states = sliceLaneStates(input.slice);
  const size = input.request.lanePageSize ?? 20;
  const pages = await Promise.all(states.map((state) =>
    getBoardLanePage(
      input.actor,
      { slice: input.slice, filters: input.request.filters, state, pagination: { page: 1, pageSize: size } },
      prismaClient,
    )));
  const cards = pages.flatMap((p) => p.cards);
  const lanePagination: Record<string, BoardPagination> = {};
  for (const p of pages) lanePagination[p.state] = p.pagination;
  return {
    generatedAt: new Date().toISOString(),
    cards,
    hiddenSiblingCounts: await computeHiddenSiblings(cards, prismaClient),
    slice: input.slice,
    availableSlices: input.availableSlices,
    blockedHints: computeBlockedHints(cards),
    lanePagination,
  };
}
