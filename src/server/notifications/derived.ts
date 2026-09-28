// Derived events — 002's `work_item.state_changed` expanded into the entries
// that are actually worth telling someone about (PRD §38, research.md
// §Decision: state_changed is a trigger).
//
// PURE: a mapping from (from, to) to catalog entry names. It never queries
// and never writes — the processor does the resolving. That matters because
// this is the one place where one outbox row can fan out into several
// notifications, and the fan-out's correctness is entirely a question of
// this function.

import type { WorkItemState } from "~/server/core";
import { isProductionSideState } from "./delays";

/** One derived notification the processor should produce. */
export interface DerivedEvent {
  /** The catalog's canonical type. */
  readonly type: string;
  /** When a user matches two derived entries, the higher severity wins. */
  readonly severity: "INFO" | "ACTION" | "URGENT";
}

const SEVERITY_RANK: Record<DerivedEvent["severity"], number> = {
  INFO: 0,
  ACTION: 1,
  URGENT: 2,
};

export function isMoreSevere(a: DerivedEvent["severity"], b: DerivedEvent["severity"]): boolean {
  return SEVERITY_RANK[a] > SEVERITY_RANK[b];
}

export interface StateChangedContext {
  readonly from: WorkItemState | null;
  readonly to: WorkItemState;
  /** The order's priority. PRD §55 Rule 12: urgency changes alerting, never
   *  the transition itself. */
  readonly orderPriority: "NORMAL" | "URGENT";
}

/**
 * The derived entries for one transition, in a stable order.
 *
 * A move into `READY_FOR_PRODUCTION` on an URGENT order yields TWO entries —
 * `ready_for_production` for the operator and `urgent` for the department and
 * reception. That is intended: the two audiences have different reasons to
 * care, and both are PRD §38 entries. The collapse to ONE notification per
 * user happens in `collapseByUser`, not here, because the dedup needs the
 * resolved recipient set, which this pure function does not have.
 */
export function deriveFromStateChange(ctx: StateChangedContext): DerivedEvent[] {
  const derived: DerivedEvent[] = [];

  switch (ctx.to) {
    case "WAITING_REVIEW":
      derived.push({ type: "work_item.awaiting_review", severity: "ACTION" });
      break;
    case "READY_FOR_PRODUCTION":
      derived.push({ type: "work_item.ready_for_production", severity: "ACTION" });
      break;
    case "IN_PRODUCTION":
      derived.push({ type: "work_item.production_started", severity: "INFO" });
      break;
    default:
      break;
  }

  if (ctx.orderPriority === "URGENT" && isProductionSideState(ctx.to)) {
    derived.push({ type: "work_item.urgent", severity: "URGENT" });
  }

  return derived;
}

/**
 * Collapses derived events down to the single highest-severity entry per user.
 *
 * The catalog contract states the rule explicitly: "a user who is both the
 * department member and reception receives ONE notification, resolved to the
 * higher severity". Resolving it here — after resolution, before insert — is
 * what makes that true regardless of what the `@@unique` constraint would
 * otherwise do (which would keep the first and DROP the more severe second,
 * arriving at the right count by the wrong route).
 *
 * The `sourceEventId` is the SAME outbox row for every derived entry, so the
 * unique pair alone would collapse them; doing it explicitly is what makes the
 * severity choice deliberate.
 */
export function collapseByUser(
  candidates: ReadonlyArray<{ userId: string; event: DerivedEvent }>,
): Array<{ userId: string; event: DerivedEvent }> {
  const bestByUser = new Map<string, DerivedEvent>();
  for (const candidate of candidates) {
    const existing = bestByUser.get(candidate.userId);
    if (!existing || isMoreSevere(candidate.event.severity, existing.severity)) {
      bestByUser.set(candidate.userId, candidate.event);
    }
  }
  return [...bestByUser].map(([userId, event]) => ({ userId, event }));
}
