// change-error-messages.ts — Directive-free error message mapping and action result types.
// tasks.md T038, contracts/change-control.md §editSpec.
// Directive-free so it can be safely imported by both Server Actions and Client Components.

import type { AspectBaseError } from "~/server/core";
import type { ChangeError } from "~/server/changes";
import ar from "~/messages/ar.json";

export interface EditSpecActionResult {
  ok: boolean;
  error?: string;
  success?: boolean;
}

export type ChangeErrorCode = ChangeError["code"] | AspectBaseError["code"];

export const UNKNOWN: string = ar.changes.errors.UNKNOWN;

const ERRORS: Record<ChangeErrorCode, string> = {
  // Base aspect error codes
  VALIDATION: ar.changes.errors.VALIDATION,
  FORBIDDEN: ar.changes.errors.FORBIDDEN,
  NOT_FOUND: ar.changes.errors.NOT_FOUND,
  CONFLICT: ar.changes.errors.CONFLICT,
  INVALID_STATE: ar.changes.errors.INVALID_STATE,
  GUARD_FAILED: ar.changes.errors.GUARD_FAILED,

  // Change control error codes
  CHANGE_REQUEST_REQUIRED: ar.changes.errors.CHANGE_REQUEST_REQUIRED,
  ADMIN_OVERRIDE_REQUIRED: ar.changes.errors.ADMIN_OVERRIDE_REQUIRED,
  WORK_ITEM_LOCKED: ar.changes.errors.WORK_ITEM_LOCKED,
  NO_CHANGES: ar.changes.errors.NO_CHANGES,
  STALE_SPEC_VERSION: ar.changes.errors.STALE_SPEC_VERSION,
  REDESIGN_CHOICE_REQUIRED: ar.changes.errors.REDESIGN_CHOICE_REQUIRED,
  REDESIGN_NOT_ALLOWED: ar.changes.errors.REDESIGN_NOT_ALLOWED,
  ORIGIN_DEPARTMENT_REQUIRED: ar.changes.errors.ORIGIN_DEPARTMENT_REQUIRED,
  NOT_IN_PRODUCTION: ar.changes.errors.NOT_IN_PRODUCTION,
  CHANGE_REQUEST_PENDING: ar.changes.errors.CHANGE_REQUEST_PENDING,
  CHANGE_REQUEST_ALREADY_DECIDED: ar.changes.errors.CHANGE_REQUEST_ALREADY_DECIDED,
  WORK_ITEM_LEFT_PRODUCTION: ar.changes.errors.WORK_ITEM_LEFT_PRODUCTION,
  NOTHING_TO_ACKNOWLEDGE: ar.changes.errors.NOTHING_TO_ACKNOWLEDGE,
  REVISION_UNACKNOWLEDGED: ar.changes.errors.REVISION_UNACKNOWLEDGED,
  LATE_CANCEL_NOT_APPLICABLE: ar.changes.errors.LATE_CANCEL_NOT_APPLICABLE,
  VERSION_MISMATCH: ar.changes.errors.VERSION_MISMATCH,
  CHANGE_HOLD: ar.changes.errors.CHANGE_HOLD,
  LATE_CANCELLATION_REQUIRED: ar.changes.errors.LATE_CANCELLATION_REQUIRED,
  SPEC_CHANGE_VETOED: ar.changes.errors.SPEC_CHANGE_VETOED,
};

/**
 * Maps a ChangeResult or AspectBaseError error code to its Arabic user-facing message.
 */
export function getChangeErrorMessage(code: ChangeErrorCode): string {
  return (ERRORS as Record<string, string>)[code] ?? UNKNOWN;
}
