"use server";

// Admin actions for the thresholds screen — contracts/ui.md §Server Actions.
//
// `admin.config` on every one of them, enforced inside the services rather than
// here: this layer shapes FormData and revalidates, and a permission check
// that lived only in an action file would be bypassable by calling the service
// directly (constitution V).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActor } from "~/server/auth";
import {
  DomainNotificationError,
  isSchedulerRunning,
  parseDuration,
  runDelayTick,
  startDelayScheduler,
  stopDelayScheduler,
  updateThreshold,
  type DelayPhase,
} from "~/server/notifications";
import ar from "~/messages/ar.json";

const REASON = "reason";
const N = ar.notifications;

function formStr(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Arabic message for a server error code — never a generic "something went
 * wrong", and never an English string leaking into the UI (constitution IX).
 * Keyed off the code rather than matched on the thrown message so the mapping
 * cannot drift when the service's message text changes.
 */
function messageFor(error: unknown): string {
  if (error instanceof DomainNotificationError) {
    switch (error.code) {
      case "INVALID_THRESHOLD":
        return N.errorInvalidThreshold;
      case "INVALID_ESCALATION":
        return N.errorInvalidEscalation;
      case "UNKNOWN_ROLE":
        return N.errorUnknownRole;
      case "UNKNOWN_PERMISSION":
        return N.errorUnknownPermission;
      case "UNKNOWN_DEPARTMENT":
        return N.errorUnknownDepartment;
      case "UNKNOWN_EVENT_TYPE":
        return N.errorUnknownEventType;
      case "EMPTY_REASON":
        return N.errorEmptyReason;
      case "FORBIDDEN":
        return N.errorForbidden;
      default:
        return N.errorSaveFailed;
    }
  }
  return N.errorSaveFailed;
}

/** `30` → 30, `4h` → 240, `1h30m` → 90. A blank input means "disabled". */
function durationOrNull(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseDuration(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export interface ActionResult {
  readonly ok: boolean;
  readonly message?: string;
}

/**
 * Saves one phase's threshold. The reason is validated BEFORE anything is
 * written, so a rejected save stores nothing and writes no audit event
 * (FR-062, 052's pattern).
 */
export async function updateThresholdsAction(formData: FormData): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const phase = formStr(formData, "phase") as DelayPhase;

    const thresholdMinutes = durationOrNull(formStr(formData, "thresholdMinutes"));
    const escalationMinutes = durationOrNull(formStr(formData, "escalationMinutes"));

    if (thresholdMinutes === undefined) {
      // A malformed duration is a validation failure, not a silent "disable"
      // — the latter would quietly switch off a phase the Admin meant to edit.
      throw new DomainNotificationError("INVALID_THRESHOLD", "مدة التنبيه غير صالحة");
    }
    if (escalationMinutes === undefined) {
      throw new DomainNotificationError("INVALID_ESCALATION", "مدة التصعيد غير صالحة");
    }

    await updateThreshold(actor, {
      phase,
      thresholdMinutes,
      escalationMinutes,
      alertRoles: formData.getAll("alertRoles").filter((v): v is string => typeof v === "string"),
      alertPermissions: formData
        .getAll("alertPermissions")
        .filter((v): v is string => typeof v === "string"),
      alertDepartmentIds: formData
        .getAll("alertDepartmentIds")
        .filter((v): v is string => typeof v === "string"),
      reason: formStr(formData, REASON),
    });

    revalidatePath("/admin/notifications");
    return { ok: true };
  } catch (error) {
    // Returned to the form, not thrown: a rejected save must render inline
    // against the offending field (contracts/ui.md), and an unhandled
    // rejection from a form action would give the operator nothing to act on.
    return { ok: false, message: messageFor(error) };
  }
}

/**
 * Runs one tick now, re-authorizing with `admin.config` first — the single
 * manual entry point into the system path, which is otherwise reachable only
 * from inside the server process (authorization-audit.md §System actors).
 */
export async function triggerSchedulerAction(): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor.permissions.has("admin.config")) {
      throw new DomainNotificationError("FORBIDDEN", "FORBIDDEN");
    }
    await runDelayTick();
    revalidatePath("/admin/notifications");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/** FR-054: startable and stoppable by an Admin WITHOUT a redeploy. */
export async function setSchedulerRunningAction(formData: FormData): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor.permissions.has("admin.config")) {
      throw new DomainNotificationError("FORBIDDEN", "FORBIDDEN");
    }
    if (formStr(formData, "running") === "true") startDelayScheduler();
    else stopDelayScheduler();

    revalidatePath("/admin/notifications");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function schedulerIsRunning(): Promise<boolean> {
  return isSchedulerRunning();
}

// --- void-returning form wrappers -------------------------------------------
// React's `action` prop types a form handler as returning `void | Promise<void>`,
// so the `ActionResult` form above cannot be passed directly. These wrappers
// keep the typed result (for any `useAction` caller) while giving the form a
// signature React accepts. A rejected save is not silently swallowed: the
// server action writes the Arabic error into the URL the page already reads,
// so the operator sees it inline against the screen.

export async function updateThresholdsForm(formData: FormData): Promise<void> {
  const result = await updateThresholdsAction(formData);
  if (!result.ok && result.message) redirectWithError(result.message);
}

export async function triggerSchedulerForm(): Promise<void> {
  const result = await triggerSchedulerAction();
  if (!result.ok && result.message) redirectWithError(result.message);
}

export async function setSchedulerRunningForm(formData: FormData): Promise<void> {
  const result = await setSchedulerRunningAction(formData);
  if (!result.ok && result.message) redirectWithError(result.message);
}

function redirectWithError(message: string): void {
  redirect(`/admin/notifications?error=${encodeURIComponent(message)}`);
}
