// Guard registry — Strategy + Chain of Responsibility (plan.md §5.2, §5.3;
// contracts/workflow.md `registerGuard`).
//
// Each guard is an interchangeable strategy (`GuardFn`) run in a chain that
// short-circuits on the first failure. This lets downstream features
// (051 delivery gate, 024-028 pricing) inject policy into `transitionWorkItem`
// without `core` knowing they exist: `transitionWorkItem` is closed for
// modification, open for extension via `registerGuard` (open/closed
// principle).

import type { JsonValue } from "../json";
import type { Result } from "../result";
import type { Actor } from "../actor";
import type { WorkItemState } from "./states";
import type { WorkItemSnapshot } from "./snapshot";

export interface GuardContext {
  readonly workItem: WorkItemSnapshot;
  readonly actor: Actor;
  readonly reason?: string;
  readonly meta?: Readonly<Record<string, JsonValue>>;
}

export type GuardResult = Result<true, { readonly code: string; readonly message: string }>;

export type GuardFn = (ctx: GuardContext) => Promise<GuardResult>;

export interface GuardRegistry {
  register(match: { from?: WorkItemState; to: WorkItemState }, guard: GuardFn): void;
  run(from: WorkItemState, to: WorkItemState, ctx: GuardContext): Promise<GuardResult>;
}

interface GuardEntry {
  readonly from?: WorkItemState;
  readonly to: WorkItemState;
  readonly guard: GuardFn;
}

// Registry (module-scope singleton, DI-friendly) — plan.md §5.2. Populated
// once at server boot (module import time, via `registerGuard` calls in each
// registering feature's top-level module) and read-only thereafter per
// request — safe under multi-instance/serverless deployment (plan.md §5.6).
class InMemoryGuardRegistry implements GuardRegistry {
  private readonly entries: GuardEntry[] = [];

  register(match: { from?: WorkItemState; to: WorkItemState }, guard: GuardFn): void {
    this.entries.push({ from: match.from, to: match.to, guard });
  }

  async run(from: WorkItemState, to: WorkItemState, ctx: GuardContext): Promise<GuardResult> {
    const matching = this.entries.filter(
      (entry) => entry.to === to && (entry.from === undefined || entry.from === from),
    );

    for (const entry of matching) {
      // Guards run in registration order; the first failure short-circuits
      // the rest (contracts/workflow.md) — sequential by design, not a bug.
      const result = await InMemoryGuardRegistry.runOne(entry.guard, ctx);
      if (!result.ok) {
        return result;
      }
    }

    return { ok: true, value: true };
  }

  // A guard MUST be side-effect-free and return a `GuardResult`
  // (contracts/workflow.md), but guards are third-party plugins registered
  // by other features — defensively catch a throwing guard and convert it
  // to a failed `GuardResult` rather than letting it propagate as an
  // exception across the `core` boundary (plan.md §5.3: no throw in core).
  private static async runOne(guard: GuardFn, ctx: GuardContext): Promise<GuardResult> {
    try {
      return await guard(ctx);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      return {
        ok: false,
        error: { code: "GUARD_THREW", message },
      };
    }
  }
}

// Module-scope singleton instance — the actual registry callers use.
export const guardRegistry: GuardRegistry = new InMemoryGuardRegistry();

/**
 * Convenience wrapper matching contracts/workflow.md's `registerGuard`
 * signature. Call at module load time (top-level in the registering
 * feature's server module) — registration is process-lifetime, not
 * per-request.
 */
export function registerGuard(
  match: { from?: WorkItemState; to: WorkItemState },
  guard: GuardFn,
): void {
  guardRegistry.register(match, guard);
}

/**
 * Convenience wrapper used by `transitionWorkItem` to run every guard
 * registered against a given `(from, to)` edge.
 */
export function runGuards(
  from: WorkItemState,
  to: WorkItemState,
  ctx: GuardContext,
): Promise<GuardResult> {
  return guardRegistry.run(from, to, ctx);
}
