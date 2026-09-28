// Boot hook (FR-051, T087).
//
// Next 15 calls `register()` once per server process, before any request is
// served — the true boot path. Starting the two notification loops here runs
// their immediate first tick at process start, so a window missed during
// downtime (a shop closed over the weekend, a deploy restart) is evaluated as
// soon as the server comes up rather than when the first browser opens the
// shell layout.
//
// WHY THE DYNAMIC IMPORT INSIDE A RUNTIME CHECK (this is Next's documented
// pattern, and it is load-bearing rather than stylistic):
//
// Next compiles `instrumentation.ts` for BOTH the Node.js and the Edge
// runtimes. A static import of the boot module would pull the whole
// processor/scheduler graph into the EDGE bundle too, and that graph is
// Node-only by nature — `node:fs` and `path.resolve(process.cwd())` in
// config.ts, `node:os`'s `hostname()` and `process.pid` in scheduler.ts, and
// Prisma's own WASM engine shim. Every one of those fails to compile for
// Edge, and `next dev` / `next build` abort with a wall of
// "A Node.js module is loaded ... not supported in the Edge Runtime" whose
// import traces all end at this file.
//
// `process.env.NEXT_RUNTIME` is INLINED at build time, so the `else` branch
// is dead-code-eliminated from the Edge bundle and the boot module is never
// even resolved there. A plain `await import()` would still be traced and
// bundled; the constant condition is what removes it.
//
// The loops belong on Node alone in any case: they are interval timers
// against a local Postgres, which is the opposite of an edge workload.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // `./server/notifications/boot` rather than the feature barrel: the
      // barrel reaches `~/server/auth` → `next/headers`, which cannot load
      // during a build-time instrumentation bundle. `boot.ts` re-exports
      // only the two starters.
      const { startDelayScheduler, startOutboxProcessor } = await import(
        "./server/notifications/boot"
      );
      startOutboxProcessor();
      startDelayScheduler();
    } catch {
      // Boot must never fail because the loops could not start. The shell
      // layout's idempotent calls retry on the first render, and a scheduler
      // that never started reads as stopped on the Admin screen — a support
      // conversation, not a crashed server.
    }
  }
}
