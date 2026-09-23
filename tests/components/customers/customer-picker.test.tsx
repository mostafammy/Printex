import { describe, expect, it } from "vitest";
import { normalizeCustomerName } from "~/server/customers/normalizeName";

describe("CustomerPicker contract", () => {
  it("uses Arabic-normalized search values", () => {
    expect(normalizeCustomerName("أحمد")).toBe(normalizeCustomerName("احمد"));
  });
});
