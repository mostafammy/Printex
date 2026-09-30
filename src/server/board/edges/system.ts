/**
 * System Transition Edge Handlers.
 * (research.md R3, contracts/board-server.md §EdgeCatalog)
 *
 * Only edges with no manual path live here. The APPROVED exits used to
 * be SYSTEM auto-edges, but approved cards rest on the board with zero
 * offered moves that way — they moved to `./approvedHandoff` as manual
 * DIRECT/SHEET edges, mirroring the DESIGN_COMPLETED handoff.
 */

import type { EdgeHandler } from "../edgeCatalog";

export const deliveredToCompleted: EdgeHandler = {
  edgeId: "DELIVERED->COMPLETED",
  kind: "SYSTEM",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "إغلاق أمر العمل تلقائياً",
};

export const systemEdges: readonly EdgeHandler[] = [
  deliveredToCompleted,
];
