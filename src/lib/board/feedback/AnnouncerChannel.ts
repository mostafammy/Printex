/**
 * AnnouncerChannel: updates an aria-live region with Arabic announcements on FeedbackEvents.
 * (specs/017-press-floor-board/contracts/board-engine.md §Accessibility, FR-032, plan.md S1)
 */

import type { FeedbackEvent } from "../types";
import {
  formatMoveCommitted,
  formatMovedByOther,
  formatMoveRefused,
} from "./messages.ar";

function getStatusMessage(status: string): string {
  if (status === "stale") return "انقطع الاتصال الخارجي، جاري إعادة الاتصال...";
  if (status === "open") return "تم الاتصال باللوحة بنجاح";
  return "";
}

function formatEventMessage(event: FeedbackEvent): string {
  switch (event.type) {
    case "MOVE_COMMITTED":
      return formatMoveCommitted(event.card);
    case "MOVE_REFUSED":
      return formatMoveRefused(event.messageAr);
    case "MOVED_BY_OTHER":
      return formatMovedByOther(event.actorName, event.toState);
    case "LIVE_STATUS_CHANGED":
      return getStatusMessage(event.status);
    case "GROUP_MOVE_DONE":
      return "تم نقل مجموعة الطلبات";
    default:
      return "";
  }
}

export class AnnouncerChannel {
  readonly #regionId = "__board-live-announcer";

  handle = (event: FeedbackEvent): void => {
    if (typeof document === "undefined") return;
    const message = formatEventMessage(event);
    if (message) {
      this.#announce(message);
    }
  };

  #announce(text: string): void {
    let region = document.getElementById(this.#regionId);
    if (!region) {
      region = document.createElement("div");
      region.id = this.#regionId;
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      region.className = "sr-only";
      document.body.appendChild(region);
    }
    region.textContent = text;
  }
}
