// specFields.ts — Specification fields, snapshots, and patch validation.
// contracts/change-control.md §Shared types, data-model.md §Validation rules.

import { z } from "zod";
import { Prisma } from "../../../generated/prisma";
import type { WorkItemDimensionUnit, SpecVersionOrigin } from "../../../generated/prisma";
import type { WorkItemState } from "~/server/core";

export const SPEC_FIELDS = [
  "productTypeId",
  "description",
  "quantity",
  "widthValue",
  "heightValue",
  "dimensionUnit",
  "material",
  "finishNotes",
] as const;

export type SpecField = (typeof SPEC_FIELDS)[number];

/** Normalized, comparison-ready snapshot. Decimals are canonical strings ("1.5", never "1.50"). */
export type SpecSnapshot = {
  productTypeId: string | null;
  description: string | null;
  quantity: number | null;
  widthValue: string | null;
  heightValue: string | null;
  dimensionUnit: WorkItemDimensionUnit | null;
  material: string | null;
  finishNotes: string | null;
};

/** Partial update. At least one key. "" → null for strings. Decimal inputs accept number | string. */
export type SpecPatch = Partial<SpecSnapshot>;

export type SpecVersionView = {
  id: string;
  workItemId: string;
  version: number;
  origin: SpecVersionOrigin;
  snapshot: SpecSnapshot;
  stateAtCreation: WorkItemState;
  reason: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
};

const dimensionUnitEnum = z.enum(["MM", "CM", "M", "IN"]);

const stringFieldSchema = z
  .string()
  .trim()
  .max(2000, "String length must not exceed 2000 characters")
  .transform((val) => {
    return val === "" ? null : val;
  })
  .nullable();

const decimalFieldSchema = z
  .union([
    z.number(),
    z.string(),
    z.null(),
  ])
  .superRefine((val, ctx) => {
    if (val === null || val === undefined) {
      return;
    }
    if (typeof val === "number") {
      if (!Number.isFinite(val) || val <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimension must be a positive number greater than 0",
        });
        return;
      }
      if (val > 99999999.99) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimension must not exceed 99,999,999.99",
        });
        return;
      }
      const d = new Prisma.Decimal(val);
      if (d.decimalPlaces() > 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimension must have at most 2 decimal places",
        });
        return;
      }
      return;
    }

    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") {
        return;
      }
      if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimension must be a valid positive decimal",
        });
        return;
      }
      const parts = trimmed.split(".");
      if (parts[1] && parts[1].length > 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimension must have at most 2 decimal places",
        });
        return;
      }
      try {
        const d = new Prisma.Decimal(trimmed);
        if (!d.greaterThan(0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Dimension must be greater than 0",
          });
          return;
        }
        if (!d.lessThanOrEqualTo("99999999.99")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Dimension must not exceed 99,999,999.99",
          });
          return;
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimension must be a valid decimal",
        });
      }
    }
  })
  .transform((val): string | null => {
    if (val === null || val === undefined) {
      return null;
    }
    if (typeof val === "number") {
      return new Prisma.Decimal(val).toString();
    }
    const trimmed = val.trim();
    if (trimmed === "") {
      return null;
    }
    return new Prisma.Decimal(trimmed).toString();
  });

export type SpecPatchInput = {
  [K in keyof SpecSnapshot]?: K extends "widthValue" | "heightValue"
    ? number | string | null
    : SpecSnapshot[K];
};

export const specPatchSchema: z.ZodType<SpecPatch, z.ZodTypeDef, SpecPatchInput> = z
  .object({
    productTypeId: stringFieldSchema.optional(),
    description: stringFieldSchema.optional(),
    quantity: z.number().int("Quantity must be an integer").min(1, "Quantity must be at least 1").optional(),
    widthValue: decimalFieldSchema.optional(),
    heightValue: decimalFieldSchema.optional(),
    dimensionUnit: dimensionUnitEnum.nullable().optional(),
    material: stringFieldSchema.optional(),
    finishNotes: stringFieldSchema.optional(),
  })
  .strict()
  .refine(
    (patch) =>
      Object.keys(patch).length > 0 &&
      Object.values(patch).some((v) => v !== undefined),
    {
      message: "SpecPatch must contain at least one field",
    },
  );

export interface SpecColumns {
  productTypeId: string | null;
  description: string | null;
  quantity: number | null;
  widthValue: Prisma.Decimal | number | string | null;
  heightValue: Prisma.Decimal | number | string | null;
  dimensionUnit: WorkItemDimensionUnit | null;
  material: string | null;
  finishNotes: string | null;
}

/** Prisma row → normalized, comparison-ready snapshot. */
export function toSpecSnapshot(row: SpecColumns): SpecSnapshot {
  const normDecimal = (v: Prisma.Decimal | number | string | null): string | null => {
    if (v == null) return null;
    const str = typeof v === "object" && "toString" in v ? v.toString() : String(v);
    const trimmed = str.trim();
    if (trimmed === "") return null;
    return new Prisma.Decimal(trimmed).toString();
  };

  const normString = (s: string | null): string | null => {
    if (s == null) return null;
    const trimmed = s.trim();
    return trimmed === "" ? null : trimmed;
  };

  return {
    productTypeId: normString(row.productTypeId),
    description: normString(row.description),
    quantity: row.quantity ?? null,
    widthValue: normDecimal(row.widthValue),
    heightValue: normDecimal(row.heightValue),
    dimensionUnit: row.dimensionUnit ?? null,
    material: normString(row.material),
    finishNotes: normString(row.finishNotes),
  };
}

/** Merges a patch into a base snapshot, producing a normalized snapshot. */
export function mergeSpecPatch(base: SpecSnapshot, patch: SpecPatch): SpecSnapshot {
  return toSpecSnapshot({
    productTypeId: patch.productTypeId !== undefined ? patch.productTypeId : base.productTypeId,
    description: patch.description !== undefined ? patch.description : base.description,
    quantity: patch.quantity !== undefined ? patch.quantity : base.quantity,
    widthValue: patch.widthValue !== undefined ? patch.widthValue : base.widthValue,
    heightValue: patch.heightValue !== undefined ? patch.heightValue : base.heightValue,
    dimensionUnit: patch.dimensionUnit !== undefined ? patch.dimensionUnit : base.dimensionUnit,
    material: patch.material !== undefined ? patch.material : base.material,
    finishNotes: patch.finishNotes !== undefined ? patch.finishNotes : base.finishNotes,
  });
}
