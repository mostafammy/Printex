// quote.ts — re-export of the shared production-area money maths.
//
// The implementation moved to `src/lib/production/quote.ts` so the reception
// row can show the price as the receptionist types, by calling THESE functions
// rather than a browser-side copy. The arithmetic is unchanged — including the
// single whole-EGP rounding site — so the number previewed in the form and the
// number `setProductionSpec` freezes are produced by one implementation.

export * from "~/lib/production/quote";
