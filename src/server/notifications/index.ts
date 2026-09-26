// Public barrel for 053-notifications — the ONLY legal import surface from
// outside `src/server/notifications/**`, mirroring `src/server/pricing/index.ts`
// and `src/server/finance/index.ts` (plan.md §Project structure).
//
// Exported publicly:
//   - the event catalog emitters reference (`Events`, `lookup`, `renderEntry`)
//   - the processor and the scheduler (the two system entry points)
//   - the notification center and the delayed-work query (the user reads)
//   - thresholds and recipient overrides (the Admin configures)
//   - the stream registry, for the SSE route
//   - the shared error and formatting vocabulary
//
// NOT exported: internals. An ESLint `no-restricted-imports` rule should
// enforce this the way it does for core/auth/orders/pricing; until that rule
// lands, this file's shape is the contract (contracts/notification-service.md).

// --- errors (contract §Errors) ----------------------------------------------
export { DomainNotificationError, describeError, isNotificationError } from "./errors";
export type { NotificationErrorCode } from "./errors";

// --- the shared event vocabulary (FR-011) -----------------------------------
export {
  CATALOG,
  Events,
  canonicalType,
  canonicalTypes,
  defaultRecipients,
  lookup,
  recipientsFor,
  renderEntry,
  spellingsOf,
} from "./catalog";
export type { CatalogContext, CatalogEntity, CatalogEntry, Delivery, RenderedEntry, Severity } from "./catalog";

// --- config ------------------------------------------------------------------
export {
  DELAY_PHASES,
  PHASE_LABELS_AR,
  getNotificationConfig,
  isDelayPhase,
  resetNotificationConfigCache,
} from "./config";
export type { DelayPhase, NotificationConfigData } from "./config";

// --- recipients (FR-002/003/016) --------------------------------------------
export { resolveRecipients, unionSpecs } from "./recipients";
export type { RecipientSpec } from "./recipients";

// --- the processor (US1) -----------------------------------------------------
export { processOutboxBatch } from "./processor";
export type { ProcessResult } from "./processor";

// --- the scheduler (US2) -----------------------------------------------------
export {
  isSchedulerRunning,
  processOwnerId,
  runDelayTick,
  startDelayScheduler,
  stopDelayScheduler,
} from "./scheduler";
export type { DelayTickResult } from "./scheduler";

// --- the notification center (US3) ------------------------------------------
export {
  archive,
  formatBadge,
  list as listNotifications,
  markAllRead,
  markRead,
  markUnread,
  unreadCount,
} from "./center";
export type {
  NotificationFilter,
  NotificationListResult,
  NotificationView,
} from "./center";

// --- delayed work (US2 / US6) ------------------------------------------------
export {
  ageMinutes,
  evaluateDelay,
  formatAge,
  formatDuration,
  getDelayedWorkItemIds,
  getDelayedWorkItems,
  isInActorScope,
  isTerminalState,
  parseDuration,
  phaseForState,
  toArabicDigits,
} from "./delays";
export type { DelayedFilter, DelayedWorkItemView, DerivedDelay } from "./delays";

// --- thresholds + scheduler status (US5) ------------------------------------
export {
  read as readThresholds,
  schedulerStatus,
  update as updateThreshold,
} from "./thresholds";
export type { SchedulerStatus, ThresholdInput, ThresholdView } from "./thresholds";

// --- recipient overrides (FR-017, US5) --------------------------------------
export {
  clearRecipientOverride,
  listRecipientOverrides,
  recipientOverride,
  setRecipientOverride,
} from "./overrides";
export type { OverrideView, SetRecipientOverrideInput } from "./overrides";

// --- the stream (US4) --------------------------------------------------------
export {
  atCapacity,
  connectionCount,
  connectionsFor,
  publish,
  publishCount,
  registerConnection,
  resetRegistry,
  serializeSignal,
  unregisterConnection,
} from "./stream";
export type { StreamSignal } from "./stream";
