/**
 * System Transition Edge Handlers.
 * (research.md R3, contracts/board-server.md §EdgeCatalog)
 */

import type { EdgeHandler } from "../edgeCatalog";

export const designCompletedToWaitingReview: EdgeHandler = {
  edgeId: "DESIGN_COMPLETED->WAITING_REVIEW",
  kind: "SYSTEM",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "إرسال للمراجعة تلقائياً",
};

export const designCompletedToApproved: EdgeHandler = {
  edgeId: "DESIGN_COMPLETED->APPROVED",
  kind: "SYSTEM",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "اعتماد تلقائي",
};

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
  designCompletedToWaitingReview,
  designCompletedToApproved,
  approvedToWaitingPricing,
  approvedToReadyForProduction,
  deliveredToCompleted,
];
