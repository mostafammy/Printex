// Barrel for src/components/changes/**
// Populated incrementally as components land.

export { SpecHistory } from "./spec-history";
export { EditSpecForm } from "./edit-spec-form";
export type { EditSpecFormProps } from "./edit-spec-form";
export { DirectEditSpecForm } from "./direct-edit-spec-form";
export type { DirectEditSpecFormProps } from "./direct-edit-spec-form";
export {
  getChangeErrorMessage,
  UNKNOWN,
  type ChangeErrorCode,
  type EditSpecActionResult,
} from "./change-error-messages";

// Phase 5: User Story 3 — change requests and production hold
export { RequestChangeForm, WithdrawChangeRequestForm } from "./request-change-form";
export type {
  RequestChangeFormProps,
  WithdrawChangeRequestFormProps,
  ChangeRequestAction,
} from "./request-change-form";
export { ChangeHoldBanner } from "./change-hold-banner";
export type { ChangeHoldBannerProps } from "./change-hold-banner";
export {
  specFieldLabel,
  formatAge,
  specPatchFromFormData,
  copyChangedSpecFields,
} from "./change-request-format";

// Phase 6: User Story 4 — spec diff
export { SpecDiff } from "./spec-diff";
export type { SpecDiffProps } from "./spec-diff";

// Phase 8: User Story 6 — late cancellation
export { LateCancelForm, CancelOrderForm } from "./late-cancel-form";
export type {
  LateCancelFormProps,
  LateCancelAction,
  CancelOrderFormProps,
  CancelOrderActionResult,
} from "./late-cancel-form";

// Phase 9: User Story 7 — admin override
export { AdminOverrideForm } from "./admin-override-form";
export type { AdminOverrideFormProps } from "./admin-override-form";
