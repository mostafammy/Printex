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
    labelAr: "الإنتاج",
    stations: ["production"],
  },
  {
    id: "delivery",
    labelAr: "التسليم للعميل",
    stations: ["collection", "delivered"],
  },
  {
    id: "accounting",
    labelAr: "التسعير والمالية",
    stations: ["pricing"],
  },
] as const;
