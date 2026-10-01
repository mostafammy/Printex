/**
 * Slice definitions and client-safe slice metadata.
 * (specs/017-press-floor-board/spec.md FR-021, data-model.md §3.7)
 */

import type { StationId } from "./stations";

export type SliceId =
  | "reception"
  | "designer"
  | "head-designer"
  | "production"
  | "delivery"
  | "accounting"
  | "floor";

export interface SliceDefinition {
  readonly id: SliceId;
  readonly labelAr: string;
  readonly stations: readonly StationId[];
}

export const SLICES: readonly SliceDefinition[] = [
  {
    id: "floor",
    labelAr: "كامل صالة الطباعة",
    stations: [
      "reception",
      "design",
      "review",
      "pricing",
      "production",
      "collection",
      "delivered",
    ],
  },
  {
    id: "reception",
    labelAr: "الاستقبال والتسليم",
    stations: ["reception", "collection", "delivered"],
  },
  {
    id: "designer",
    labelAr: "تصاميمي",
    stations: ["design"],
  },
  {
    id: "head-designer",
    labelAr: "المراجعة والتصميم",
    stations: ["review", "design"],
  },
  {
    id: "production",
    labelAr: "صالة الإنتاج والطباعة",
    // `delivered` is here because the printer owns the hand-off in this shop:
    // without it they could move a job to تم التسليم but the lane that records
    // it was off their slice, so the move would appear to do nothing.
    stations: ["production", "collection", "delivered"],
  },
  {
    id: "delivery",
    labelAr: "التسليم للعميل",
    stations: ["collection", "delivered"],
  },
  {
    id: "accounting",
    labelAr: "لوحة المحاسب والتسعير",
    stations: ["pricing", "production"],
  },
] as const;
