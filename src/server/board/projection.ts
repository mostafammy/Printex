/**
 * Database query projection and pure mapping to BoardCard DTOs.
 * (specs/017-press-floor-board/data-model.md §3.1, contracts/board-server.md §getBoardSnapshot, plan.md S1)
 */

import type { Prisma } from "../../../generated/prisma";
import type { BoardCard, MoveOption } from "~/lib/board/types";
import { db } from "~/server/db";
import type { WorkItemState } from "~/server/core";
import type { StationTargets } from "./config";
import { STATE_PLACEMENT } from "./stations";

export interface RawWorkItemRow {
  readonly id: string;
  readonly orderId: string;
  readonly order: {
    readonly number: number;
    readonly priority: "NORMAL" | "URGENT";
    readonly dueDate: Date | null;
    readonly customer: { readonly name: string };
  };
  readonly description: string | null;
  readonly productType: { readonly name: string; readonly defaultDepartmentId: string | null } | null;
  readonly quantity: number | null;
  readonly state: WorkItemState;
  readonly departmentId: string | null;
  readonly assignee: { readonly id: string; readonly name: string } | null;
  readonly createdAt: Date;
  readonly dueDate: Date | null;
  readonly transitions: readonly {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly at: Date;
  }[];
  readonly pricingStatus: { readonly status: "PENDING" | "PRICED" | "DISPUTED" } | null;
  readonly reworkCount?: number;
}

export function computeOrderTagHue(orderId: string): number {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = (hash * 31 + orderId.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 360;
}

export function computeEnteredStationAt(
  currentState: WorkItemState,
  transitions: readonly { readonly to: string; readonly at: Date }[],
  createdAt: Date,
): string {
  const currentPlacement = STATE_PLACEMENT[currentState];
  if (currentPlacement === "OFF_BOARD") return createdAt.toISOString();

  const currentStation = currentPlacement.station;
  let earliest = createdAt.toISOString();
  let foundAny = false;

  for (const t of transitions) {
    const p = STATE_PLACEMENT[t.to as WorkItemState];
    if (p !== "OFF_BOARD" && p.station === currentStation) {
      earliest = t.at.toISOString();
      foundAny = true;
    } else if (foundAny) break;
  }
  return earliest;
}

function getTargetMinutes(row: RawWorkItemRow, targets: StationTargets): number | null {
  const p = STATE_PLACEMENT[row.state];
  if (p === "OFF_BOARD") return null;
  const cfg = targets[p.station];
  if (!cfg) return null;
  return row.order.priority === "URGENT" ? cfg.urgent : cfg.normal;
}

function getCardTitle(row: RawWorkItemRow): string {
  if (row.description) return row.description;
  if (row.productType) return row.productType.name;
  return "أمر عمل";
}

function getReworkCount(row: RawWorkItemRow): number {
  if (typeof row.reworkCount === "number") return row.reworkCount;
  return row.transitions.filter((t) => t.to === "REWORK_REQUIRED").length;
}

function getCardDueAt(row: RawWorkItemRow): string | null {
  const d = row.dueDate ?? row.order.dueDate;
  return d ? d.toISOString() : null;
}

function getTransitionMeta(row: RawWorkItemRow): { id: string | null; at: string } {
  const latest = row.transitions[0];
  if (!latest) return { id: null, at: row.createdAt.toISOString() };
  return { id: latest.id, at: latest.at.toISOString() };
}

export function mapRowToBoardCard(
  row: RawWorkItemRow,
  targets: StationTargets,
  moves: readonly MoveOption[] = [],
): BoardCard {
  const transition = getTransitionMeta(row);
  const departmentId = row.departmentId ?? row.productType?.defaultDepartmentId ?? null;
  const assignee = row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null;

  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.number,
    orderTagHue: computeOrderTagHue(row.orderId),
    customerName: row.order.customer.name,
    title: getCardTitle(row),
    quantity: row.quantity,
    state: row.state,
    priority: row.order.priority,
    pricing: row.pricingStatus?.status ?? "NOT_REQUIRED",
    enteredStationAt: computeEnteredStationAt(row.state, row.transitions, row.createdAt),
    targetMinutes: getTargetMinutes(row, targets),
    dueAt: getCardDueAt(row),
    reworkCount: getReworkCount(row),
    assignee,
    departmentId,
    moves,
    lastTransitionId: transition.id,
    lastTransitionAt: transition.at,
  };
}

export async function fetchRawWorkItemRows(
  where: Prisma.WorkItemWhereInput,
  prismaClient = db,
): Promise<RawWorkItemRow[]> {
  const items = await prismaClient.workItem.findMany({
    where,
    include: {
      order: {
        select: {
          number: true,
          priority: true,
          dueDate: true,
          customer: { select: { name: true } },
        },
      },
      productType: { select: { name: true, defaultDepartmentId: true } },
      assignee: { select: { id: true, name: true } },
      transitions: {
        select: { id: true, from: true, to: true, at: true },
        orderBy: { at: "desc" },
      },
      pricingStatus: { select: { status: true } },
    },
  });

  return items;
}
