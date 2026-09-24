import { describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import {
  specPatchSchema,
  toSpecSnapshot,
  mergeSpecPatch,
  type SpecSnapshot,
} from "~/server/changes/specFields";

describe("specPatchSchema (T011)", () => {
  it("refuses an empty patch", () => {
    const result = specPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("refuses an unknown key", () => {
    const result = specPatchSchema.safeParse({
      quantity: 10,
      unknownKey: "unexpected",
    });
    expect(result.success).toBe(false);
  });

  it("refuses quantity 0, -1, or 1.5", () => {
    expect(specPatchSchema.safeParse({ quantity: 0 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ quantity: -1 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ quantity: 1.5 }).success).toBe(false);
  });

  it("accepts valid positive integer quantity", () => {
    const parsed = specPatchSchema.parse({ quantity: 100 });
    expect(parsed.quantity).toBe(100);
  });

  it("refuses a width with 3 decimal places, and width 0", () => {
    expect(specPatchSchema.safeParse({ widthValue: 0 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ widthValue: "0" }).success).toBe(false);
    expect(specPatchSchema.safeParse({ widthValue: "0.00" }).success).toBe(false);
    expect(specPatchSchema.safeParse({ widthValue: -1 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ widthValue: 1.234 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ widthValue: "1.234" }).success).toBe(false);
    expect(specPatchSchema.safeParse({ widthValue: "1.500" }).success).toBe(false);
  });

  it("refuses width exceeding 99999999.99", () => {
    expect(specPatchSchema.safeParse({ widthValue: 100000000 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ widthValue: "100000000.00" }).success).toBe(false);
  });

  it('accepts "1.50" and 1.5 and normalizes both to "1.5"', () => {
    const parsedFromString = specPatchSchema.parse({ widthValue: "1.50" });
    expect(parsedFromString.widthValue).toBe("1.5");

    const parsedFromNumber = specPatchSchema.parse({ widthValue: 1.5 });
    expect(parsedFromNumber.widthValue).toBe("1.5");

    const parsedHeight = specPatchSchema.parse({ heightValue: "2.00" });
    expect(parsedHeight.heightValue).toBe("2");
  });

  it("refuses a string over 2000 characters", () => {
    const over2000 = "a".repeat(2001);
    expect(specPatchSchema.safeParse({ description: over2000 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ material: over2000 }).success).toBe(false);
    expect(specPatchSchema.safeParse({ finishNotes: over2000 }).success).toBe(false);
  });

  it('turns "" into null for string fields and trims strings', () => {
    const parsedEmpty = specPatchSchema.parse({
      description: "",
      material: "   ",
      finishNotes: "",
    });
    expect(parsedEmpty.description).toBeNull();
    expect(parsedEmpty.material).toBeNull();
    expect(parsedEmpty.finishNotes).toBeNull();

    const parsedTrimmed = specPatchSchema.parse({
      description: "  custom poster  ",
      material: "vinyl",
      finishNotes: "matte lamination",
    });
    expect(parsedTrimmed.description).toBe("custom poster");
    expect(parsedTrimmed.material).toBe("vinyl");
    expect(parsedTrimmed.finishNotes).toBe("matte lamination");
  });

  it("accepts valid dimensionUnit or null, and refuses invalid unit", () => {
    expect(specPatchSchema.parse({ dimensionUnit: "CM" }).dimensionUnit).toBe("CM");
    expect(specPatchSchema.parse({ dimensionUnit: "MM" }).dimensionUnit).toBe("MM");
    expect(specPatchSchema.parse({ dimensionUnit: "M" }).dimensionUnit).toBe("M");
    expect(specPatchSchema.parse({ dimensionUnit: "IN" }).dimensionUnit).toBe("IN");
    expect(specPatchSchema.parse({ dimensionUnit: null }).dimensionUnit).toBeNull();
    expect(specPatchSchema.safeParse({ dimensionUnit: "KM" }).success).toBe(false);
  });

  it('turns widthValue null and "" into null', () => {
    const fromNull = specPatchSchema.parse({ widthValue: null });
    expect(fromNull.widthValue).toBeNull();

    const fromEmpty = specPatchSchema.parse({ widthValue: "" });
    expect(fromEmpty.widthValue).toBeNull();
  });

  it("accepts a productTypeId string", () => {
    const parsed = specPatchSchema.parse({ productTypeId: "pt_123" });
    expect(parsed.productTypeId).toBe("pt_123");
  });

  it("refuses { quantity: undefined } as empty", () => {
    const res = specPatchSchema.safeParse({ quantity: undefined });
    expect(res.success).toBe(false);
  });
});

describe("toSpecSnapshot & mergeSpecPatch (T011, B10)", () => {
  const baseSnapshot: SpecSnapshot = {
    productTypeId: "pt_1",
    description: "Base description",
    quantity: 10,
    widthValue: "100",
    heightValue: "200",
    dimensionUnit: "CM",
    material: "Paper",
    finishNotes: "Matte",
  };

  it('normalizes a Prisma.Decimal("1.50") input to "1.5"', () => {
    const snap = toSpecSnapshot({
      productTypeId: null,
      description: null,
      quantity: 1,
      widthValue: new Prisma.Decimal("1.50"),
      heightValue: null,
      dimensionUnit: null,
      material: null,
      finishNotes: null,
    });
    expect(snap.widthValue).toBe("1.5");
  });

  it("keeps the base value when a patch key is set to undefined", () => {
    const merged = mergeSpecPatch(baseSnapshot, {
      description: undefined,
      quantity: 20,
    });
    expect(merged.description).toBe("Base description");
    expect(merged.quantity).toBe(20);
  });

  it("clears the value when a patch key is set to null", () => {
    const merged = mergeSpecPatch(baseSnapshot, {
      description: null,
      material: null,
    });
    expect(merged.description).toBeNull();
    expect(merged.material).toBeNull();
    expect(merged.quantity).toBe(10);
  });

  it("normalizes a whitespace-only string to null", () => {
    const snap = toSpecSnapshot({
      productTypeId: "   ",
      description: " \t \n ",
      quantity: null,
      widthValue: null,
      heightValue: null,
      dimensionUnit: null,
      material: "  ",
      finishNotes: "",
    });
    expect(snap.productTypeId).toBeNull();
    expect(snap.description).toBeNull();
    expect(snap.material).toBeNull();
    expect(snap.finishNotes).toBeNull();

    const merged = mergeSpecPatch(baseSnapshot, {
      description: "   ",
    });
    expect(merged.description).toBeNull();
  });
});
