// Boot hook (FR-051, T087).
//
// Next 15 calls `register()` exactly ONCE per server process, before any
// request is served — the true boot path. Starting the two notification
// loops here runs their immediate first tick at process start, so a window
// missed during downtime (a shop closed over the weekend, a deploy restart)
// is evaluated as soon as the server comes up rather than when the first
// browser opens the shell layout.
//
// The import is `./server/notifications/boot`, NOT the `~/server/notifications`
// barrel: the barrel reaches `~/server/auth` → `next/headers`, which cannot
// load in the build-time instrumentation context and crashes `next build`.
// `boot.ts` re-exports only the two starters, with the reasoning recorded
// there.
//
// The shell layout keeps its own `startOutboxProcessor()` /
// `startDelayScheduler()` calls as idempotent backstops: both paths read the
// process-wide timer slot (src/server/notifications/timers.ts), so whichever
// runs second is a no-op and no combination of boot + render + dev hot
// reload can stack an interval.
export async function register(): Promise<void> {
  try {
    const { startDelayScheduler, startOutboxProcessor } = await import(
      "./server/notifications/boot"
    );
    startOutboxProcessor();
    startDelayScheduler();
  } catch {
    // Boot must never fail because the loops could not start. The shell
    // layout's idempotent calls retry on the first render, and a scheduler
    // that never started shows as stopped on the Admin screen — a support
    // conversation, not a crashed server.
  }
}
