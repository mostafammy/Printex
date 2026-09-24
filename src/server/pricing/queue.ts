import { authorizePricingOperation } from "./authorization";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";

export type PricingQueueInput = {
  readonly limit?: number;
  readonly cursor?: string;
  readonly now?: Date;
};

export type PricingQueueRow = {
  readonly workItemId: string;
  readonly orderId: string;
  readonly orderNumber: number;
  readonly customerName: string;
  readonly productName: string | null;
  readonly priority: "NORMAL" | "URGENT";
  readonly waitingSince: Date;
  readonly ageLabel: string;
  readonly dueDate: Date | null;
};

export type PricingQueueResult = {
  readonly rows: readonly PricingQueueRow[];
  readonly nextCursor: string | null;
};

export async function getPricingQueue(
  actor: Actor,
  input: PricingQueueInput = {},
): Promise<PricingQueueResult> {
  authorizePricingOperation(actor, "APPLY_QUOTE");
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const now = input.now ?? new Date();
  const statuses = await db.pricingStatus.findMany({
    where: { status: "PENDING" },
    select: {
      workItemId: true,
      waitingSince: true,
      workItem: {
        select: {
          dueDate: true,
          productType: { select: { name: true } },
          order: { select: { id: true, number: true, priority: true, customer: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ waitingSince: "asc" }, { workItemId: "asc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { workItemId: input.cursor }, skip: 1 } : {}),
  });

  const ordered = statuses.sort((left, right) => {
    const priorityDifference = Number(right.workItem.order.priority === "URGENT") - Number(left.workItem.order.priority === "URGENT");
    if (priorityDifference !== 0) return priorityDifference;
    const timeDifference = (left.waitingSince?.getTime() ?? now.getTime()) - (right.waitingSince?.getTime() ?? now.getTime());
    return timeDifference || left.workItemId.localeCompare(right.workItemId);
  });
  const page = ordered.slice(0, limit);

  return {
    rows: page.map((row) => ({
      workItemId: row.workItemId,
      orderId: row.workItem.order.id,
      orderNumber: row.workItem.order.number,
      customerName: row.workItem.order.customer.name,
      productName: row.workItem.productType?.name ?? null,
      priority: row.workItem.order.priority,
      waitingSince: row.waitingSince ?? now,
      ageLabel: formatQueueAge(row.waitingSince ?? now, now),
      dueDate: row.workItem.dueDate,
    })),
    nextCursor: ordered.length > limit ? page.at(-1)?.workItemId ?? null : null,
  };
}

export function formatQueueAge(waitingSince: Date, now: Date): string {
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - waitingSince.getTime()) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h ${elapsedMinutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}