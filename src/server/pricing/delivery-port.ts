import { db } from "~/server/db";
import type { PricingGatePort, PricingGateStatus } from "./ports";

const fallbackStatus = (): PricingGateStatus => ({
  status: "PENDING",
  waitingSince: null,
  responsible: { label: "Pricing review required", userIds: [] },
});

export const pricingGateProvider: PricingGatePort = {
  async getPricingStatus(workItemIds) {
    if (workItemIds.length === 0) return new Map();

    const requestedIds = [...new Set(workItemIds)];
    const statuses = await db.pricingStatus.findMany({
      where: { workItemId: { in: requestedIds } },
      select: {
        workItemId: true,
        status: true,
        waitingSince: true,
        currentPriceId: true,
      },
    });
    const priceIds = statuses.flatMap((status) => status.currentPriceId ? [status.currentPriceId] : []);
    const currentPrices = await db.workItemPrice.findMany({
      where: { id: { in: priceIds } },
      select: { id: true },
    });
    const validPriceIds = new Set(currentPrices.map((price) => price.id));
    const byWorkItem = new Map(statuses.map((status) => [status.workItemId, status]));

    return new Map(requestedIds.map((workItemId) => {
      const status = byWorkItem.get(workItemId);
      if (!status) return [workItemId, fallbackStatus()] as const;
      if (status.status === "PRICED" && status.currentPriceId && validPriceIds.has(status.currentPriceId)) {
        return [workItemId, { status: "RESOLVED" } as const];
      }
      return [workItemId, {
        status: "PENDING",
        waitingSince: status.waitingSince,
        responsible: { label: "Pricing review required", userIds: [] },
      } as const];
    }));
  },
};