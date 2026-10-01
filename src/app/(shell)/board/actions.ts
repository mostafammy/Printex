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
import type { QuoteResult } from "~/server/pricing/quote";
import { getActor, authorize } from "~/server/auth";
import { db } from "~/server/db";
import { quoteForRelease } from "~/server/pricing/prices";
import { getCurrentPrice } from "~/server/pricing/history";
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

export interface QuickPriceContext {
  readonly pricing: BoardCard["pricing"];
  readonly policyMode: "FIXED" | "VARIABLE" | null;
  readonly quoteAmount: string | null;
  readonly quoteUnitAr: string | null;
  readonly currentAmount: string | null;
}

/**
 * Everything the quick-price sheet needs in one round trip: the live
 * auto-quote (or null when the item cannot be quoted yet), the current
 * price if any, and the product's pricing policy mode driving which
 * manual kinds are legal. Never throws — a missing product type or price
 * list degrades to the manual form, never a dead modal.
 */
export async function getQuickPriceContextAction(workItemId: string): Promise<QuickPriceContext> {
  const actor = await getActor();
  const canPrice =
    actor.permissions.has("pricing.use_fixed") ||
    actor.permissions.has("workitem.approve_production") ||
    actor.roles.includes("ACCOUNTING") ||
    actor.roles.includes("ADMIN_OWNER");
  if (!canPrice) {
    authorize(actor, "pricing.use_fixed");
  }

  const item = await db.workItem.findUniqueOrThrow({
    where: { id: workItemId },
    select: {
      productType: { select: { pricingPolicy: { select: { mode: true } } } },
      pricingStatus: { select: { status: true } },
    },
  });

  const quoted = await quoteForRelease(workItemId);
  const current = await getCurrentPrice(workItemId).catch(() => null);

  return {
    pricing: item.pricingStatus?.status ?? "NOT_REQUIRED",
    policyMode: item.productType?.pricingPolicy?.mode ?? null,
    quoteAmount: quoted.ok ? quoted.value.amount : null,
    quoteUnitAr: quoted.ok ? describeQuoteUnit(quoted.value) : null,
    currentAmount: current?.amount ?? null,
  };
}

function describeQuoteUnit(quote: QuoteResult): string {
  const unit = quote.breakdown.unit;
  const qty = quote.breakdown.quantity;
  const unitAr =
    unit === "PIECE" ? "قطعة" :
    unit === "SQUARE_METER" ? "م²" :
    unit === "LINEAR_METER" ? "متر طولي" :
    unit === "SHEET" ? "فرخ" :
    unit === "PACK" ? "رزمة" : unit;
  return `${qty} ${unitAr}`;
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

