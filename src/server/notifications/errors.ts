// 053-notifications error codes — contracts/notification-service.md,
// contracts/authorization-audit.md, contracts/notification-stream.md.
//
// One SCREAMING_SNAKE vocabulary shared by every surface of the feature, so
// an Arabic message can be keyed off the code and a test can assert on it
// without coupling to a translated string (constitution IX, FR-062).

export type NotificationErrorCode =
  // --- shared with the rest of the app (001's vocabulary) ---------------
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  // --- validation sub-codes, mapped to distinct Arabic messages ---------
  | "VALIDATION"
  | "INVALID_THRESHOLD"
  | "INVALID_ESCALATION"
  | "UNKNOWN_ROLE"
  | "UNKNOWN_PERMISSION"
  | "UNKNOWN_DEPARTMENT"
  | "UNKNOWN_EVENT_TYPE"
  | "EMPTY_REASON"
  // --- not found --------------------------------------------------------
  | "NOTIFICATION_NOT_FOUND"
  // --- infrastructure ---------------------------------------------------
  | "OUTBOX_UNAVAILABLE"
  | "STREAM_CAPACITY";

/**
 * The single error type 053's server surface throws. Mirrors
 * `DomainFinanceError` / `DomainPricingError` in shape so callers in this
 * codebase read the same way, and so the UI can switch on `code` to pick an
 * Arabic message rather than matching on an English one.
 */
export class DomainNotificationError extends Error {
  readonly code: NotificationErrorCode;

  constructor(code: NotificationErrorCode, message: string) {
    super(message);
    this.name = "DomainNotificationError";
    this.code = code;
  }
}

/**
 * Narrows an unknown thrown value to a `DomainNotificationError`. Used by the
 * processor, which must never let one event's failure escape as an unhandled
 * rejection while still being able to record the failure on the outbox row.
 */
export function isNotificationError(value: unknown): value is DomainNotificationError {
  return value instanceof DomainNotificationError;
}

/** Human-readable detail for an arbitrary thrown value, for `lastError`. */
export function describeError(error: unknown): string {
  if (isNotificationError(error)) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
