/**
 * System Transition Edge Handlers.
 * (research.md R3, contracts/board-server.md §EdgeCatalog)
 *
 * Only edges with no manual path live here. `DESIGN_COMPLETED` handoff
 * moved to `./designHandoff` as DIRECT edges: the state is transient in the
 * automatic `markDesignComplete` chain, but a card resting there had zero
 * offered moves (SYSTEM is never offered and moveWorkItem refuses it), so
 * every column rendered dimmed and cross-phase drag was impossible.
 */

import type { EdgeHandler } from "../edgeCatalog";

export const approvedToWaitingPricing: EdgeHandler = {
  edgeId: "APPROVED->WAITING_PRICING",
  kind: "SYSTEM",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "توجيه للتسعير تلقائياً",
};

export const approvedToReadyForProduction: EdgeHandler = {
  edgeId: "APPROVED->READY_FOR_PRODUCTION",
  kind: "SYSTEM",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "جاهز للإنتاج تلقائياً",
};

export const deliveredToCompleted: EdgeHandler = {
  edgeId: "DELIVERED->COMPLETED",
  kind: "SYSTEM",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "إغلاق أمر العمل تلقائياً",
};

export const systemEdges: readonly EdgeHandler[] = [
  approvedToWaitingPricing,
  approvedToReadyForProduction,
  deliveredToCompleted,
];
