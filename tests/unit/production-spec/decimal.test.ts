// Unit tests — the browser's entry point to exact decimal arithmetic.
//
// `parseDecimalField` is what stands between a text input and the money maths in
// the reception form, so its contract matters more than its size:
//
//   * a value that is not a number YET returns `null`, so a half-typed field
//     shows "fill in the width, length and price" instead of a refusal or a
//     crash inside a `useMemo`;
//   * a value that IS a number is returned, however odd — including a negative
//     one, which must reach the derivation so the receptionist is told the width
//     is invalid rather than being told the field is empty.
//
// It deliberately does NOT pre-filter with a regex: it defers to Decimal's own
// parser, which is what the server's `parseDecimal` does. Divergence between
// the two is the bug this file exists to prevent.

import { describe, expect, it } from "vitest";
import { parseDecimalField } from "~/lib/production/decimal";
import { Prisma } from "../../../generated/prisma";

describe("parseDecimalField — input that is not a number yet", () => {
  it.each(["", "   ", "-", ".", "1.2.", "abc", "12cm", "1 000", "1,5"])(
    'treats %j as "not answered yet"',
    (input) => {
      expect(parseDecimalField(input)).toBeNull();
    },
  );

  it("returns null for a value that parses but is not finite", () => {
    expect(parseDecimalField("NaN")).toBeNull();
  });
});

describe("parseDecimalField — input that is a number", () => {
  it.each([
    ["0", "0"],
    ["145", "145"],
    ["145.50", "145.5"],
    ["0.25", "0.25"],
    ["  2  ", "2"],
  ])("parses %j as %j", (input, expected) => {
    expect(parseDecimalField(input)?.toString()).toBe(expected);
  });

  it("accepts a trailing decimal point, so typing 1.5 does not blink the panel", () => {
    // A field passes through "1." on the way to "1.5". Refusing it would make the
    // price disappear and reappear for one keystroke, and — worse — would be a
    // decision this file made about which strings are numbers, which is the
    // server's decision, not the browser's.
    expect(parseDecimalField("1.")?.toString()).toBe("1");
  });

  it("keeps a negative value, so the domain can refuse it with a reason", () => {
    // Not null: `resolveProductionWidth` must see it and answer
    // INVALID_DIMENSIONS, which is a message the receptionist can act on.
    expect(parseDecimalField("-5")?.toString()).toBe("-5");
  });

  it("agrees with the server's parser on every input", () => {
    // The parity claim, asserted rather than assumed: for any string, this
    // returns null exactly when `new Prisma.Decimal(raw)` is unusable. If a
    // future Prisma release tightens its parser, this fails and the comment
    // above gets revisited — which is the point of having both halves on the
    // same test.
    for (const raw of ["145", "145.50", "1e3", "-0.5", "0.0001", "1.", "", "NaN", "abc", "12cm"]) {
      let serverAccepts = false;
      try {
        serverAccepts = new Prisma.Decimal(raw).isFinite();
      } catch {
        serverAccepts = false;
      }
      expect(parseDecimalField(raw) === null, `parity for ${JSON.stringify(raw)}`).toBe(
        !serverAccepts,
      );
    }
  });

  it("produces a value the shared money maths accepts", () => {
    // No conversion step: what comes out of the field goes straight into
    // `computeProductionArea`, which is why there is nothing to keep in sync.
    const width = parseDecimalField("145");
    const height = parseDecimalField("2");
    expect(width).not.toBeNull();
    expect(height).not.toBeNull();
    expect(width!.div(100).mul(height!).toString()).toBe("2.9");
  });
});
