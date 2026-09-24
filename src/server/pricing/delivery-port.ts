// 015's PricingGatePort provider (contracts/delivery-gate.md).
//
// 051 owns this provider and binds it through `bindPricingGatePort`; 015 owns
// the `READY_FOR_COLLECTION -> DELIVERED` guard itself. This provider only
// READS committed pricing data — it never writes WorkItem workflow state and
// never opens nested transactions of its own.

import { db } from "~/server/db";
import type { PricingGatePort, PricingGateStatus, PricingResponsible } from "./ports";
import { findValidCurrentPriceIds, resolveResponsiblePricingUsers } from "./status";

const fallbackResponsible: PricingResponsible = {
  label: "Pricing review required",
  userIds: [],
};

function pendingStatus(
  waitingSince: Date | null,
  responsible: PricingResponsible,
): PricingGateStatus {
  return { status: "PENDING", waitingSince, responsible };
}

export const pricingGateProvider: PricingGatePort = {
  async getPricingStatus(workItemIds) {
    if (workItemIds.length === 0) return new Map();

    const requestedIds = [...new Set(workItemIds)];

    // One transaction: statuses, responsible pricing users, and the candidate
    // current prices are all read together so the gate cannot mix a pre- and
    // post-price read, and every read sees committed data only.
    return db.$transaction(async (tx) => {
      const [statuses, responsible] = await Promise.all([
        tx.pricingStatus.findMany({
          where: { workItemId: { in: requestedIds } },
          select: {
            workItemId: true,
            status: true,
            waitingSince: true,
            disputeReason: true,
            currentPriceId: true,
          },
        }),
        resolveResponsiblePricingUsers(tx),
      ]);

      const validPriceIds = await findValidCurrentPriceIds(statuses, tx);
      const byWorkItem = new Map(statuses.map((status) => [status.workItemId, status]));

      return new Map(requestedIds.map((workItemId) => {
        const status = byWorkItem.get(workItemId);
        // Missing provider data fails closed as PENDING (contracts/delivery-gate.md).
        if (!status) return [workItemId, pendingStatus(null, responsible)] as const;

        const resolved =
          status.status === "PRICED" &&
          status.currentPriceId !== null &&
          validPriceIds.has(status.currentPriceId);
        if (resolved) return [workItemId, { status: "RESOLVED" } as const] as const;

        // PENDING and DISPUTED are both unresolved; `waitingSince` is retained
        // while unresolved so 053's delay alerts keep their original timestamp.
        return [workItemId, pendingStatus(status.waitingSince, responsible)] as const;
      }));
    });
  },
};
