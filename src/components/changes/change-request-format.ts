// change-request-format.ts — Pure, directive-free helpers for the change
// request UI (tasks.md T051): field labels, request age, and
// turning a submitted form into a spec patch. Safe for Server Actions,
// Server Components and Client Components alike.

import type {
  SpecField,
  SpecPatchInput,
  SpecSnapshot,
  WorkItemDimensionUnit,
} from "~/server/changes";
import ar from "~/messages/ar.json";

const FIELD_LABELS: Record<SpecField, string> = ar.changes.fields;

export function specFieldLabel(field: SpecField): string {
  return FIELD_LABELS[field];
}

const AGE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "منذ ٣ ساعات"-style age of a request, relative to `now`. */
export function formatAge(createdAt: Date, now: Date = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - createdAt.getTime());
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  for (const [unit, ms] of AGE_UNITS) {
    if (elapsed >= ms) {
      return rtf.format(-Math.floor(elapsed / ms), unit);
    }
  }
  return rtf.format(0, "minute");
}

const DIMENSION_UNITS = new Set<string>(["MM", "CM", "M", "IN"]);
const TEXT_FIELDS = ["material", "description", "finishNotes"] as const;
const DECIMAL_FIELDS = ["widthValue", "heightValue"] as const;

function trimmed(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : undefined;
}

function sameDecimal(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  const [na, nb] = [Number(a), Number(b)];
  return Number.isFinite(na) && Number.isFinite(nb) ? na === nb : a === b;
}

/**
 * Copies into `out` only the spec fields of `formData` whose value differs
 * from `current` (blank = null), so a request carries just what changed.
 */
export function copyChangedSpecFields(
  formData: FormData,
  current: SpecSnapshot,
  out: FormData,
): void {
  const read = (key: string): string | null => {
    const v = trimmed(formData, key);
    return v === undefined || v === "" ? null : v;
  };

  const quantity = read("quantity");
  if ((quantity === null ? null : Number(quantity)) !== current.quantity) {
    out.set("quantity", quantity ?? "");
  }
  for (const field of DECIMAL_FIELDS) {
    const value = read(field);
    if (!sameDecimal(value, current[field])) out.set(field, value ?? "");
  }
  for (const field of ["dimensionUnit", ...TEXT_FIELDS] as const) {
    const value = read(field);
    if (value !== current[field]) out.set(field, value ?? "");
  }
}

/**
 * Builds a spec patch from only the fields present in `formData` (the
 * client form sends changed fields only). Blank text clears the field;
 * a blank quantity is ignored; an unknown unit is ignored.
 */
export function specPatchFromFormData(formData: FormData): SpecPatchInput {
  const patch: SpecPatchInput = {};

  const quantity = trimmed(formData, "quantity");
  if (quantity) patch.quantity = Number(quantity);

  for (const field of DECIMAL_FIELDS) {
    const value = trimmed(formData, field);
    if (value !== undefined) patch[field] = value === "" ? null : value;
  }

  const unit = trimmed(formData, "dimensionUnit");
  if (unit === "") patch.dimensionUnit = null;
  else if (unit !== undefined && DIMENSION_UNITS.has(unit)) {
    patch.dimensionUnit = unit as WorkItemDimensionUnit;
  }

  for (const field of TEXT_FIELDS) {
    const value = trimmed(formData, field);
    if (value !== undefined) patch[field] = value === "" ? null : value;
  }

  return patch;
}
