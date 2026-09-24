import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/auth", () => ({
  authorize: vi.fn(),
  audit: { record: vi.fn() },
}));
vi.mock("~/server/review", () => ({ createReturnInTx: vi.fn() }));

describe("pricing public barrel contract", () => {
  it("keeps the public import surface available", async () => {
    const pricing = await import("~/server/pricing");

    expect(pricing.quote).toBeTypeOf("function");
    expect(pricing.setPrice).toBeTypeOf("function");
    expect(pricing.getPricingQueue).toBeTypeOf("function");
    expect(pricing.getPriceHistory).toBeTypeOf("function");
    expect(pricing.calculateQuote).toBeTypeOf("function");
  });
});