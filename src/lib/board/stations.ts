/**
 * Station mappings, layout constants, and WorkItemState placements.
 * Pure module with no I/O, shared between client and server.
 * (specs/017-press-floor-board/data-model.md §2, FR-001, FR-002, FR-027)
 */

import type { WorkItemState } from "~/server/board";

export type StationId =
  | "reception"
  | "design"
  | "review"
  | "pricing"
  | "production"
  | "collection"
  | "delivered";

export type InkName =
  | "cyan"
  | "magenta"
  | "violet"
  | "yellow"
  | "key"
  | "orange"
  | "green"
  | "red";

export type Placement =
  | { readonly station: StationId; readonly lane: number }
  | "OFF_BOARD";

export interface Lane {
  readonly state: WorkItemState;
  readonly labelAr: string;
}

export interface Station {
  readonly id: StationId;
  readonly labelAr: string;
  readonly ink: InkName;
  readonly icon: string;
  readonly lanes: readonly Lane[];
}

export const STATIONS: readonly Station[] = [
  {
    id: "reception",
    labelAr: "الاستقبال",
    ink: "key",
    icon: "Inbox",
    lanes: [{ state: "NEW", labelAr: "جديد" }],
  },
  {
    id: "design",
    labelAr: "التصميم",
    ink: "magenta",
    icon: "Palette",
    lanes: [
      { state: "ASSIGNED", labelAr: "معين" },
      { state: "IN_DESIGN", labelAr: "قيد التصميم" },
      { state: "REWORK_REQUIRED", labelAr: "تعديل مطلوب" },
      { state: "DESIGN_COMPLETED", labelAr: "مكتمل التصميم" },
    ],
  },
  {
    id: "review",
    labelAr: "المراجعة",
    ink: "violet",
    icon: "CheckCheck",
    lanes: [
      { state: "WAITING_REVIEW", labelAr: "بانتظار المراجعة" },
      { state: "APPROVED", labelAr: "معتمد" },
    ],
  },
  {
    id: "pricing",
    labelAr: "التسعير",
    ink: "yellow",
    icon: "Calculator",
    lanes: [{ state: "WAITING_PRICING", labelAr: "بانتظار التسعير" }],
  },
  {
    id: "production",
    labelAr: "الإنتاج",
    ink: "cyan",
    icon: "Printer",
    lanes: [
      { state: "READY_FOR_PRODUCTION", labelAr: "جاهز للإنتاج" },
      { state: "IN_PRODUCTION", labelAr: "قيد الإنتاج" },
    ],
  },
  {
    id: "collection",
    labelAr: "التجهيز للتسليم",
    ink: "orange",
    icon: "PackageCheck",
    lanes: [
      { state: "PRODUCTION_COMPLETED", labelAr: "مكتمل الإنتاج" },
      { state: "READY_FOR_COLLECTION", labelAr: "جاهز للتسليم" },
    ],
  },
  {
    id: "delivered",
    labelAr: "تم التسليم",
    ink: "green",
    icon: "Truck",
    lanes: [{ state: "DELIVERED", labelAr: "تم التسليم" }],
  },
] as const;

export const STATE_PLACEMENT = {
  NEW: { station: "reception", lane: 0 },
  ASSIGNED: { station: "design", lane: 0 },
  IN_DESIGN: { station: "design", lane: 1 },
  REWORK_REQUIRED: { station: "design", lane: 2 },
  DESIGN_COMPLETED: { station: "design", lane: 3 },
  WAITING_REVIEW: { station: "review", lane: 0 },
  APPROVED: { station: "review", lane: 1 },
  WAITING_PRICING: { station: "pricing", lane: 0 },
  READY_FOR_PRODUCTION: { station: "production", lane: 0 },
  IN_PRODUCTION: { station: "production", lane: 1 },
  PRODUCTION_COMPLETED: { station: "collection", lane: 0 },
  READY_FOR_COLLECTION: { station: "collection", lane: 1 },
  DELIVERED: { station: "delivered", lane: 0 },
  COMPLETED: "OFF_BOARD",
  CANCELLED: "OFF_BOARD",
} as const satisfies Record<WorkItemState, Placement>;

export const OFF_BOARD_STATES: readonly WorkItemState[] = [
  "COMPLETED",
  "CANCELLED",
] as const;
