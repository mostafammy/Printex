import { describe, expect, it } from "vitest";
import { normalizePhone } from "~/server/customers/normalizePhone";

describe("normalizePhone", () => {
  it.each([
    ["01012345678", "+201012345678"],
    ["+201012345678", "+201012345678"],
    ["00201012345678", "+201012345678"],
    ["010-1234-5678", "+201012345678"],
    ["+20 10 1234 5678", "+201012345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["010123", "021012345678", "abc", ""]) ("rejects %s", (input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });
});
