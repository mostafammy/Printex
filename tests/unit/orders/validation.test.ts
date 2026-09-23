// Unit tests for src/server/orders/validation.ts's shared Zod schemas —
// tasks.md T051.

import { describe, expect, it } from "vitest";
import { workItemCreateSchema, productTypeNameSchema } from "~/server/orders/validation";

const VALID_ITEM = {
  quantity: 10,
  widthValue: 5,
  heightValue: 5,
  dimensionUnit: "CM" as const,
  requiresDesign: true,
  requiresReview: true,
};

describe("workItemCreateSchema", () => {
  it("accepts a fully valid item", () => {
    expect(workItemCreateSchema.safeParse(VALID_ITEM).success).toBe(true);
  });

  it("rejects quantity: zero", () => {
    expect(workItemCreateSchema.safeParse({ ...VALID_ITEM, quantity: 0 }).success).toBe(false);
  });

  it("rejects quantity: negative", () => {
    expect(workItemCreateSchema.safeParse({ ...VALID_ITEM, quantity: -5 }).success).toBe(false);
  });

  it("rejects quantity: non-integer", () => {
    expect(workItemCreateSchema.safeParse({ ...VALID_ITEM, quantity: 2.5 }).success).toBe(false);
  });

  it("rejects widthValue: zero", () => {
    expect(workItemCreateSchema.safeParse({ ...VALID_ITEM, widthValue: 0 }).success).toBe(false);
  });

  it("rejects widthValue: negative", () => {
    expect(workItemCreateSchema.safeParse({ ...VALID_ITEM, widthValue: -1 }).success).toBe(false);
  });

  it("rejects heightValue: zero", () => {
    expect(workItemCreateSchema.safeParse({ ...VALID_ITEM, heightValue: 0 }).success).toBe(false);
  });

  it("rejects heightValue: negative", () => {
    expect(workItemCreateSchema.safeParse({ ...VALID_ITEM, heightValue: -1 }).success).toBe(false);
  });

  it("rejects an invalid dimensionUnit", () => {
    expect(
      workItemCreateSchema.safeParse({ ...VALID_ITEM, dimensionUnit: "FEET" }).success,
    ).toBe(false);
  });
});

describe("productTypeNameSchema", () => {
  it("accepts a normal name", () => {
    expect(productTypeNameSchema.safeParse("Roll-up Banner").success).toBe(true);
  });

  it("rejects empty-after-trim", () => {
    expect(productTypeNameSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects names longer than 100 chars", () => {
    expect(productTypeNameSchema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("accepts exactly 100 chars", () => {
    expect(productTypeNameSchema.safeParse("a".repeat(100)).success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = productTypeNameSchema.safeParse("  Flyer  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Flyer");
  });
});
