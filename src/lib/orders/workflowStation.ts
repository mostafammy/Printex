export const WORKFLOW_STATIONS = [
  { key: "RECEPTION", label: "الاستقبال", desc: "تأكيد الطلب" },
  { key: "DESIGN", label: "التصميم", desc: "إعداد الملفات" },
  { key: "REVIEW", label: "المراجعة", desc: "اعتماد البروفة" },
  { key: "PRODUCTION", label: "الطباعة", desc: "التشغيل والإنتاج" },
  { key: "DELIVERY", label: "التسليم", desc: "جاهز للعميل" },
] as const;

export function toDimString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return v.toString();
  if (typeof v === "object" && "toString" in v && typeof (v as { toString(): string }).toString === "function") {
    return (v as { toString(): string }).toString();
  }
  return "";
}

export function formatDimensions(
  widthValue: unknown,
  heightValue: unknown,
  dimensionUnit: string | null,
): string {
  const w = toDimString(widthValue);
  const h = toDimString(heightValue);
  if (!w && !h) return "—";
  const unitAr =
    dimensionUnit === "CM"
      ? "سم"
      : dimensionUnit === "M"
      ? "م"
      : dimensionUnit === "MM"
      ? "مم"
      : dimensionUnit === "IN"
      ? "بوصة"
      : dimensionUnit ?? "سم";

  if (w && h) return `${w} × ${h} ${unitAr}`;
  if (w) return `${w} ${unitAr}`;
  if (h) return `${h} ${unitAr}`;
  return "—";
}

/**
 * Calculates the active workflow journey station index (0 to 4, or -1 for cancelled)
 * based on the actual lifecycle state of the order's work items.
 */
export function getActiveStepIndex(
  orderStatus: string,
  workItems: readonly { state: string }[],
): number {
  if (workItems.length === 0) {
    if (orderStatus === "CANCELLED") return -1;
    if (orderStatus === "COMPLETED" || orderStatus === "DELIVERED") return 4;
    return 0;
  }

  const nonCancelled = workItems.filter((wi) => wi.state !== "CANCELLED");
  if (nonCancelled.length === 0) return -1;

  // 1. If every non-cancelled item is completed or delivered -> Station 4 (التسليم)
  if (nonCancelled.every((wi) => wi.state === "COMPLETED" || wi.state === "DELIVERED")) {
    return 4;
  }

  // 2. If any item is in printing/production or finished production -> Station 3 (الطباعة)
  const hasPrinting = nonCancelled.some(
    (wi) =>
      wi.state === "IN_PRODUCTION" ||
      wi.state === "READY_FOR_PRODUCTION" ||
      wi.state === "PRODUCTION_COMPLETED" ||
      wi.state === "READY_FOR_COLLECTION",
  );
  if (hasPrinting) return 3;

  // 3. If any item is in review -> Station 2 (المراجعة)
  const hasReview = nonCancelled.some(
    (wi) =>
      wi.state === "WAITING_REVIEW" ||
      wi.state === "APPROVED" ||
      wi.state === "WAITING_PRICING",
  );
  if (hasReview) return 2;

  // 4. If any item is in design -> Station 1 (التصميم)
  const hasDesign = nonCancelled.some(
    (wi) =>
      wi.state === "IN_DESIGN" ||
      wi.state === "ASSIGNED" ||
      wi.state === "DESIGN_COMPLETED" ||
      wi.state === "REWORK_REQUIRED",
  );
  if (hasDesign) return 1;

  // 5. Default to Reception -> Station 0 (الاستقبال)
  return 0;
}
