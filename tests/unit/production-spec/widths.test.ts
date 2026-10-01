// Unit tests — 093 FR-002/FR-003, spec SC-001.
//
// The width ladder is the single most load-bearing piece of arithmetic in this
// feature: it decides what is produced, what is billed, and what the printer
// cuts. The vector below is the spec's own table, transcribed case by case so
// that a change to `resolveProductionWidth` cannot pass unnoticed by "fixing"
// one boundary and breaking another.
//
// No database and no I/O: the ladder arrives as a plain argument precisely so
// this can be pinned as arithmetic (constitution V — the boundary validates,
// the domain does not re-check).

import { Prisma } from "../../../generated/prisma";
import { describe, expect, it } from "vitest";
import {
  assertWidthLadder,
  maxProductionWidthCm,
  resolveProductionWidth,
} from "~/server/production-spec/widths";
import { DomainProductionSpecError } from "~/server/production-spec/errors";

const ladder = assertWidthLadder([80, 110, 150, 210, 260, 270, 320]);

function resolve(requestedCm: string) {
  return resolveProductionWidth(new Prisma.Decimal(requestedCm), ladder);
}

describe("resolveProductionWidth — the spec's width vector (SC-001)", () => {
  // [requested, expected production width]
  const vector: ReadonlyArray<readonly [string, number]> = [
    ["75", 80],
    ["80", 80],
    ["81", 110],
    ["109", 110],
    ["110", 110],
    ["111", 150],
    ["145", 150],
    ["150", 150],
    ["151", 210],
    ["209", 210],
    ["210", 210],
    ["211", 260],
    ["250", 260],
    ["260", 260],
    ["261", 270],
    ["265", 270],
    ["270", 270],
    ["271", 320],
    ["319", 320],
    ["320", 320],
  ];

  it.each(vector)("rounds %s cm UP to %i cm", (requested, expected) => {
    const result = resolve(requested);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.productionWidthCm).toBe(expected);
    // FR-001: the customer's own number is carried through untouched, never
    // replaced by the rounded one.
    expect(result.customerWidthCm).toBe(Number(requested));
  });

  it("never rounds down: the production width is always >= the request", () => {
    for (const [requested, expected] of vector) {
      const result = resolve(requested);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.productionWidthCm).toBeGreaterThanOrEqual(Number(requested));
      // …and is either the request itself or the next step above it.
      expect(result.productionWidthCm).toBe(expected);
    }
  });

  it("reports whether rounding actually moved the width, and by how much", () => {
    const exact = resolve("150");
    expect(exact.ok && exact.rounded).toBe(false);
    expect(exact.ok && exact.roundingDeltaCm).toBe(0);

    const rounded = resolve("145");
    expect(rounded.ok && rounded.rounded).toBe(true);
    expect(rounded.ok && rounded.roundingDeltaCm).toBe(5);
  });
});

describe("resolveProductionWidth — above the maximum is refused, never clamped", () => {
  // FR-003. The critical assertion in this block is the negative one: 321 and
  // 9999 must NOT come back as 320. A clamp here is the bug this whole guard
  // exists to prevent — it would let reception believe it sold a 4 m banner
  // while the customer received a 3.2 m one.
  it.each(["321", "330", "999", "320.1"])("refuses %s cm instead of clamping", (requested) => {
    const result = resolve(requested);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("WIDTH_ABOVE_MAXIMUM");
    expect(result.maxWidthCm).toBe(320);
    // The refusal carries the numbers the exception ticket needs. Note the
    // CEILING: 320.1 cm is reported as 321, never quietly reduced to 320 —
    // reducing it would be the clamp this gate exists to prevent.
    expect(result.customerWidthCm).toBe(new Prisma.Decimal(requested).ceil().toNumber());
  });

  it("names the ceiling and points at the exception path in the message", () => {
    const result = resolve("330");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("320");
    expect(result.message.toLowerCase()).toContain("exception");
  });
});

describe("resolveProductionWidth — invalid input", () => {
  it.each(["0", "-1", "-0.5"])("refuses a non-positive width of %s cm", (requested) => {
    const result = resolve(requested);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_DIMENSIONS");
  });

  it("rounds a sub-centimetre request UP to the next whole centimetre", () => {
    // 149.6 must land on the same ladder step as 150, not on 110.
    const result = resolve("149.6");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.productionWidthCm).toBe(150);
  });

  it("ceils the fractional part rather than rounding it to nearest", () => {
    // 149.2 -> 150 cm, so 149.2 is never given a SMALLER production width
    // than 149.9 would get. Nearest-rounding would give 149 -> 150 too, but
    // the 320.1 case above is where the distinction actually bites.
    const low = resolve("149.2");
    expect(low.ok && low.productionWidthCm).toBe(150);
  });
});

describe("assertWidthLadder — configuration is validated once, at the boundary", () => {
  it("exposes the widest step as the maximum", () => {
    expect(maxProductionWidthCm(ladder)).toBe(320);
  });

  it("accepts the seeded roll ladder", () => {
    expect([...assertWidthLadder([80, 110, 150, 210, 260, 270, 320])]).toEqual([
      80, 110, 150, 210, 260, 270, 320,
    ]);
  });

  it("freezes the result so a caller cannot mutate configuration in place", () => {
    expect(Object.isFrozen(ladder)).toBe(true);
  });

  it.each([
    [[], "empty ladder"],
    [[150, 110], "descending ladder"],
    [[80, 80], "repeated step"],
    [[0, 80], "non-positive step"],
    [[-80], "negative step"],
    [[80.5], "fractional step"],
  ])("rejects %s", (candidate) => {
    expect(() => assertWidthLadder(candidate)).toThrow(DomainProductionSpecError);
  });

  it("names INVALID_WIDTH_LADDER so a corrupt configuration is diagnosable", () => {
    try {
      assertWidthLadder([]);
      expect.unreachable("assertWidthLadder should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainProductionSpecError);
      expect((error as DomainProductionSpecError).code).toBe("INVALID_WIDTH_LADDER");
    }
  });
});
