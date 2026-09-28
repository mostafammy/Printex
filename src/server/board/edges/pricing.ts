/**
 * Pricing Edge Handlers.
 * (research.md R3, FR-016, contracts/board-server.md §EdgeCatalog)
 */

import type { EdgeHandler } from "../edgeCatalog";

export const waitingPricingToReadyForProduction: EdgeHandler = {
  edgeId: "WAITING_PRICING->READY_FOR_PRODUCTION",
  kind: "SCREEN",
  permission: "pricing.use_fixed",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "تسعير أمر العمل",
  screenHref(card) {
    return `/pricing?workItem=${card.id}`;
  },
};

export const pricingEdges: readonly EdgeHandler[] = [
  waitingPricingToReadyForProduction,
];
