// Boot entry for Next's `instrumentation.ts` (T087).
//
// WHY THIS FILE EXISTS RATHER THAN IMPORTING THE BARREL DIRECTLY: the
// `~/server/notifications` barrel re-exports the notification center, which
// imports `~/server/auth`, which imports `next/headers`. Next's BUILD-TIME
// instrumentation bundle executes outside a request context, so loading
// `next/headers` there crashes the production build with
// `TypeError: Cannot read properties of undefined (reading 'length')` — no
// file, no stack, purely because the module graph reached a request-only
// API. Verified by bisection: with `src/instrumentation.ts` present the build
// failed identically; with it removed, `next build` compiled successfully.
//
// This module therefore imports the two loop starters DIRECTLY from their
// files, bypassing the barrel and every request-scoped dependency. It is
// the ONLY place allowed to do so, and that is stated here so the next
// reader does not "tidy" it back to the barrel.

export { startOutboxProcessor, stopOutboxProcessor } from "./processor";
export { startDelayScheduler, stopDelayScheduler } from "./scheduler";
