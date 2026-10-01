/**
 * 050's category vocabulary as the board popup presents it.
 * (specs/017-press-floor-board)
 */

/**
 * The VALUES must match `FileCategory` in `~/server/files/schemas.ts` — 050 is
 * the authority and this list is only its Arabic label set.
 *
 * That asymmetry is deliberate rather than a second source of truth: the upload
 * route validates the category with `fileCategorySchema` (a `z.enum`), so a
 * value that ever drifts here is refused with a 400 instead of quietly filing a
 * file under a category nobody reads. The server, not this array, is the check.
 */
export const FILE_CATEGORIES = [
  { value: "ORIGINAL", label: "الملف الأصلي" },
  { value: "DESIGN_VERSIONS", label: "إصدارات التصميم" },
  { value: "REVIEW_PROOF", label: "نسخة المراجعة" },
  { value: "APPROVED", label: "ملف معتمد" },
  { value: "PRODUCTION", label: "ملفات الإنتاج" },
  { value: "SUPPORTING", label: "مرفقات داعمة" },
] as const;

/**
 * 050's lifecycle states that mean "this version is no longer the file". A
 * VOID or ARCHIVED version still exists and stays downloadable for the audit
 * trail, but presenting it as current is how the wrong artwork reaches a press.
 */
const RETIRED_STATUSES: Readonly<Record<string, string>> = {
  VOID: "ملغى",
  ARCHIVED: "مؤرشف",
  SUPERSEDED: "مستبدل",
  CORRUPTED: "تالف",
};

const CATEGORY_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  FILE_CATEGORIES.map((c) => [c.value, c.label]),
);

/** Falls back to the raw value so an unknown category is visible, not blank. */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** The Arabic retirement badge for a status, or `null` when it is still live. */
export function retiredLabel(status: string): string | null {
  return RETIRED_STATUSES[status] ?? null;
}
