// guards.ts — 016's transition guards. tasks.md T046,
// contracts/events-and-ports.md §3, research.md §18.
//
// Guards read committed data through the global `db`: 002's GuardContext has
// no `tx`. The `meta` markers below are the only way through, and they are
// parsed by a closed Zod union — anything else is ignored, which means refusal.

import { z } from "zod";
import { db } from "~/server/db";
import { registerGuard, type GuardFn, type GuardResult, type WorkItemState } from "~/server/core";
import { getProductionHold } from "./productionHold";

export const CHANGE_HOLD = "CHANGE_HOLD";
export const LATE_CANCELLATION_REQUIRED = "LATE_CANCELLATION_REQUIRED";

const changeControlMetaSchema = z.discriminatedUnion("changeControl", [
  z.object({ changeControl: z.literal("LATE_CANCELLATION"), lateCancellationId: z.string().min(1) }),
  z.object({
    changeControl: z.literal("CHANGE_REQUEST_APPROVAL"),
    changeRequestId: z.string().min(1),
  }),
]);

type ChangeControlMeta = z.infer<typeof changeControlMetaSchema>;

function parseMeta(meta: unknown): ChangeControlMeta | null {
  const parsed = changeControlMetaSchema.safeParse(meta);
  return parsed.success ? parsed.data : null;
}

const OK: GuardResult = { ok: true, value: true };

function refuse(code: string, message: string): GuardResult {
  return { ok: false, error: { code, message } };
}

/** IN_PRODUCTION → PRODUCTION_COMPLETED: no hold of any kind. */
const completionHoldGuard: GuardFn = async ({ workItem }) => {
  const hold = await getProductionHold(db, workItem.id);
  return hold
    ? refuse(CHANGE_HOLD, "A specification change is pending or unacknowledged.")
    : OK;
};

/**
 * IN_PRODUCTION → REWORK_REQUIRED: no hold, or the approval of exactly the
 * pending request is sending the item back to design.
 */
const sendBackHoldGuard: GuardFn = async ({ workItem, meta }) => {
  const hold = await getProductionHold(db, workItem.id);
  if (!hold) {
    return OK;
  }
  const marker = parseMeta(meta);
  if (
    hold.kind === "CHANGE_PENDING" &&
    marker?.changeControl === "CHANGE_REQUEST_APPROVAL" &&
    marker.changeRequestId === hold.changeRequestId
  ) {
    return OK;
  }
  return refuse(CHANGE_HOLD, "A specification change is pending or unacknowledged.");
};

/** Production-started states → CANCELLED: only through cancelAfterProductionStarted. */
const lateCancellationGuard: GuardFn = async ({ meta }) =>
  parseMeta(meta)?.changeControl === "LATE_CANCELLATION"
    ? OK
    : refuse(
        LATE_CANCELLATION_REQUIRED,
        "Cancelling after production started requires a late cancellation with reason and cost.",
      );

export const LATE_CANCEL_STATES = [
  "IN_PRODUCTION",
  "PRODUCTION_COMPLETED",
  "READY_FOR_COLLECTION",
] as const satisfies readonly WorkItemState[];

let registered = false;

/**
 * Registers 016's guards once per process. Idempotent: 002's registerGuard
 * appends on every call, so a second registration would run each guard twice.
 */
export function registerChangeGuards(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerGuard({ from: "IN_PRODUCTION", to: "PRODUCTION_COMPLETED" }, completionHoldGuard);
  registerGuard({ from: "IN_PRODUCTION", to: "REWORK_REQUIRED" }, sendBackHoldGuard);
  for (const from of LATE_CANCEL_STATES) {
    registerGuard({ from, to: "CANCELLED" }, lateCancellationGuard);
  }
}
