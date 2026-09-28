/**
 * ToastChannel: listens to FeedbackCenter and triggers user-facing toasts with Arabic messages.
 * (contracts/board-engine.md §FeedbackPort, plan.md S1)
 */

import type { FeedbackEvent } from "../types";
import { formatMoveCommitted, formatMovedByOther, formatMoveRefused } from "./messages.ar";

export type ToastVariant = "success" | "error" | "info";
export type ToastFn = (message: string, variant: ToastVariant) => void;

export class ToastChannel {
  private readonly showToast: ToastFn;

  constructor(showToast: ToastFn) {
    this.showToast = showToast;
  }

  handle = (event: FeedbackEvent): void => {
    if (event.type === "MOVE_COMMITTED") {
      this.showToast(formatMoveCommitted(event.card), "success");
    } else if (event.type === "MOVE_REFUSED") {
      this.showToast(formatMoveRefused(event.messageAr), "error");
    } else if (event.type === "MOVED_BY_OTHER") {
      this.showToast(formatMovedByOther(event.actorName, event.toState), "info");
    }
  };
}
