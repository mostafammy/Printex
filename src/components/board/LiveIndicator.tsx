"use client";

/**
 * LiveIndicator: connection status and move-refusal feedback.
 * (specs/017-press-floor-board/contracts/board-live-sse.md §LiveChannel, FR-025, US4-4)
 *
 * This previously held `useState("open")` with no setter, so `return null`
 * was a compile-time constant and the stale/reconnect pill below it was
 * unreachable markup — a board that had stopped receiving updates looked
 * exactly like a quiet board. It now subscribes to the controller's real
 * feedback channel, and announces refusals and colleagues' moves in a live
 * region so they reach a screen reader too.
 */

import React, { useEffect, useState } from "react";
import type { FeedbackEvent } from "~/lib/board/types";
import type { FeedbackCenter } from "~/lib/board/feedback/FeedbackCenter";
import { useBoardController } from "./hooks/useBoardController";

type Banner =
  | { readonly kind: "stale"; readonly text: string }
  | { readonly kind: "ok"; readonly text: string }
  | { readonly kind: "error"; readonly text: string };

function fromEvent(e: FeedbackEvent): Banner | null {
  switch (e.type) {
    case "LIVE_STATUS_CHANGED":
      if (e.status === "stale" || e.status === "connecting" || e.status === "closed") {
        return { kind: "stale", text: "غير متصل — يتم إعادة الاتصال" };
      }
      if (e.status === "open") return { kind: "ok", text: "تم تحديث الاتصال" };
      return null;
    case "MOVE_REFUSED":
      return { kind: "error", text: `تعذّر النقل: ${e.messageAr}` };
    case "MOVED_BY_OTHER":
      return { kind: "ok", text: `${e.actorName} نقل هذا الطلب إلى ${e.toState}` };
    case "MOVE_COMMITTED":
      return null;
    default:
      return null;
  }
}

export function LiveIndicator() {
  const controller = useBoardController();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!controller?.feedback) return;
    const center = controller.feedback as FeedbackCenter;
    return center.subscribe?.((e) => {
      const next = fromEvent(e);
      if (next) {
        setBanner(next);
        setAnnouncement(next.text);
      }
    });
  }, [controller]);

  // Errors stay until acknowledged; non-errors clear themselves, so a
  // reconnect notice does not sit on screen for the rest of the shift.
  useEffect(() => {
    if (!banner || banner.kind === "error") return;
    const t = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(t);
  }, [banner]);

  return (
    <>
      {/* Screen readers hear status changes; sighted users get the pill. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {banner && (
        <div
          role="status"
          className={`fixed bottom-4 inset-inline-start-4 z-40 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg ${
            banner.kind === "error"
              ? "bg-destructive"
              : banner.kind === "stale"
                ? "bg-amber-600"
                : "bg-emerald-600"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full bg-white ${
              banner.kind === "error" ? "" : "animate-pulse"
            }`}
          />
          <span>{banner.text}</span>
        </div>
      )}
    </>
  );
}
