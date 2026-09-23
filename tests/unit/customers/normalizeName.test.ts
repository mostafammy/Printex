import { describe, expect, it } from "vitest";
import { normalizeCustomerName } from "~/server/customers/normalizeName";

describe("normalizeCustomerName", () => {
  it("matches Arabic spelling variants", () => {
    expect(normalizeCustomerName("أَحْمَد")).toBe(normalizeCustomerName("احمد"));
    expect(normalizeCustomerName("مدرسة")).toBe(normalizeCustomerName("مدرسه"));
    expect(normalizeCustomerName("فتى")).toBe(normalizeCustomerName("فتي"));
  });
});
