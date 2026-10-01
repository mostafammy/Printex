// widths.ts — re-export of the canonical width round-up.
//
// The implementation moved to `src/lib/production/widths.ts` so the reception
// row can round a width with the SAME function the server uses (see the
// client-safety note there). Pure maths, no behaviour change: `maxProductionWidthCm`,
// `resolveProductionWidth` and `assertWidthLadder` are the same code with the
// same semantics, and `~/server/production-spec/widths` still resolves to them.

export * from "~/lib/production/widths";
