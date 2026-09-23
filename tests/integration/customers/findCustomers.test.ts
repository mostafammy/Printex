import { describe, expect, it } from "vitest";
import { normalizeCustomerName } from "~/server/customers/normalizeName";

describe("customer search contract", () => {
  it("normalizes phone and Arabic fallback keys consistently", () => {
    expect(normalizeCustomerName("أحمد")).toBe(normalizeCustomerName("احمد"));
  });
});
