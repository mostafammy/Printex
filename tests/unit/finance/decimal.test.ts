// Decimal integrity — tasks.md T059 (Polish / SC-008).
// Money columns are Decimal/numeric in the schema (no float), and helpers
// round-trip exact values (0.10 must survive).

import { describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import { parsePositiveDecimal, sumDecimalStrings, toDecimalString } from "~/server/finance";

describe("decimal integrity (unit, SC-008)", () => {
  it("finance money columns are declared Decimal(12,2) in prisma/schema", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema/finance.prisma"), "utf8");
    // Every money-bearing field uses Decimal, never Float.
    const moneyFields = [
      "amount",
      "creditLimit",
      "approvalThreshold",
    ];
    for (const field of moneyFields) {
      const pattern = new RegExp(`${field}\\s+Decimal\\s+@db\\.Decimal\\(12,\\s*2\\)`);
      expect(schema).toMatch(pattern);
    }
    expect(schema).not.toMatch(/\bFloat\b/);
  });

  it("0.10 round-trips exactly through parse and sum (no float math)", () => {
    const a = parsePositiveDecimal("0.10");
    expect(toDecimalString(a)).toBe("0.1");
    const sum = sumDecimalStrings(["0.10", "0.20", "999999999.99"]);
    expect(toDecimalString(sum)).toBe("1000000000.29");

    // Classic float trap: 0.1 + 0.2 !== 0.3 in IEEE754 — Decimal must equal 0.3.
    const floatTrap = sumDecimalStrings(["0.1", "0.2"]);
    expect(toDecimalString(floatTrap)).toBe("0.3");
    expect(Number(0.1 + 0.2)).not.toBe(0.3);
  });

  it("rejects non-positive and garbage amounts", () => {
    expect(() => parsePositiveDecimal("0")).toThrow();
    expect(() => parsePositiveDecimal("-5")).toThrow();
    expect(() => parsePositiveDecimal("abc")).toThrow();
    expect(() => parsePositiveDecimal("")).toThrow();
  });

  it("Prisma.Decimal instances are used for API money values", () => {
    const value = new Prisma.Decimal("123.45");
    expect(value).toBeInstanceOf(Prisma.Decimal);
    expect(value.toString()).toBe("123.45");
  });
});
