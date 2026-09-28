/**
 * Collection & Delivery Edge Handlers (015 dependent - marked UNAVAILABLE pending 015).
 * (research.md R3, FR-017, contracts/board-server.md §EdgeCatalog)
 */

import type { EdgeHandler } from "../edgeCatalog";

export const productionCompletedToReadyForCollection: EdgeHandler = {
  edgeId: "PRODUCTION_COMPLETED->READY_FOR_COLLECTION",
  kind: "UNAVAILABLE",
  permission: "collection.receive",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "استلام وتدقيق",
};

export const readyForCollectionToDelivered: EdgeHandler = {
  edgeId: "READY_FOR_COLLECTION->DELIVERED",
  kind: "UNAVAILABLE",
  permission: "delivery.record",
  backward: false,
  destructive: false,
  groupable: true,
  labelAr: "تسليم للعميل",
  precheck(_actor, card) {
    if (card.pricing === "PENDING") {
      return { ok: false, hintAr: "يجب حسم التسعير أولاً" };
    }
    return { ok: true };
  },
};

export const collectionEdges: readonly EdgeHandler[] = [
  productionCompletedToReadyForCollection,
  readyForCollectionToDelivered,
];
