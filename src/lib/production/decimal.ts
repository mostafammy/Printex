// decimal.ts — the ONE place the browser obtains a Decimal constructor.
//
// Why this file exists: every other module in `src/lib/production` imports the
// generated Prisma client TYPE-ONLY, so nothing from it reaches the browser.
// The reception row cannot do the same, because `resolveProductionWidth` and
// friends take Decimal *values*, and the row's inputs arrive from the server
// as plain strings (`"145"`, `"90.5"`).
//
// Why it is still safe to import in a Client Component: the generated client
// declares a `browser` export condition, and `generated/prisma/index-browser.js`
// resolves to a ~35 KB self-contained bundle — the Decimal implementation and
// the enum objects, inlined, with no `require` of anything (no `fs`, no
// `@prisma/client` runtime, no WASM). It is a value class, not a database
// driver, so the client gets exact decimal arithmetic and nothing else.
//
// The type is the same `Prisma.Decimal` the server passes around: the generated
// `index.d.ts` is one file for both builds, so a Decimal produced here is typed
// identically to a Decimal produced by `setProductionSpec` and the shared
// functions in this directory accept both without a cast.

import { Prisma } from "../../../generated/prisma";

/** `decimal.js` Decimal, re-exported as the constructor for browser callers. */
export const Decimal = Prisma.Decimal;

/** Alias for the VALUE type, so pure modules can avoid a second import. */
export type DecimalValue = Prisma.Decimal;

/**
 * Parses a form field into a Decimal, or `null` when the field is not a
 * complete number yet.
 *
 * Delegating to Decimal's own parser — rather than pre-filtering with a regex —
 * is what keeps this in step with the server's `parseDecimal`, which does the
 * same thing. If the two disagreed about which strings are numbers, the form
 * would refuse to show a price for input the server is perfectly willing to
 * price, and the receptionist would get "fill in the fields" for a field they
 * had filled in.
 *
 * `null` is reserved for input that is genuinely not a number yet (empty, a
 * lone "-", a half-typed "1.2."), and for non-finite results. Both mean the
 * same thing to a caller: there is nothing to price. A *negative* width is
 * different — it parses, so it reaches the derivation and comes back as the
 * `INVALID_DIMENSIONS` refusal the server would return.
 */
export function parseDecimalField(value: string): DecimalValue | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new Decimal(trimmed);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}
