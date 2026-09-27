// errors.ts — 016 Order Change Control error types.
// contracts/change-control.md "Errors" (specs/016-change-control/contracts/change-control.md).

import type { AspectResult } from "~/server/core";

/** 016's module error union: objects raised with fail(), returned in AspectResult.error. */
export type ChangeError =
  | { readonly code: "CHANGE_REQUEST_REQUIRED" }
  | { readonly code: "ADMIN_OVERRIDE_REQUIRED" }
  | { readonly code: "WORK_ITEM_LOCKED" }
  | { readonly code: "NO_CHANGES" }
  | { readonly code: "STALE_SPEC_VERSION"; readonly currentVersion?: number }
  | { readonly code: "REDESIGN_CHOICE_REQUIRED" }
  | { readonly code: "REDESIGN_NOT_ALLOWED" }
  | { readonly code: "ORIGIN_DEPARTMENT_REQUIRED" }
  | { readonly code: "NOT_IN_PRODUCTION" }
  | { readonly code: "CHANGE_REQUEST_PENDING" }
  | { readonly code: "CHANGE_REQUEST_ALREADY_DECIDED" }
  | { readonly code: "WORK_ITEM_LEFT_PRODUCTION" }
  | { readonly code: "NOTHING_TO_ACKNOWLEDGE" }
  | { readonly code: "REVISION_UNACKNOWLEDGED" }
  | { readonly code: "LATE_CANCEL_NOT_APPLICABLE" }
  | { readonly code: "VERSION_MISMATCH" }
  | { readonly code: "CHANGE_HOLD" }
  | { readonly code: "LATE_CANCELLATION_REQUIRED" }
  | { readonly code: "SPEC_CHANGE_VETOED"; readonly listener: string; readonly reason: string };

export type ChangeResult<T> = AspectResult<T, ChangeError>;
