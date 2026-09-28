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
import type { FeedbackEvent, LiveStatus } from "~/lib/board/types";
import type { FeedbackCenter } from "~/lib/board/feedback/FeedbackCenter";
import { useBoardController } from "./hooks/useBoardController";

type Banner =
  | { readonly kind: "stale"; readonly text: string }
  | { readonly kind: "ok"; readonly text: string }
  | { readonly kind: "error"; readonly text: string };

function fromStatus(status: LiveStatus): Banner | null {
  switch (status) {
    case "stale":
    case "connecting":
    case "resyncing":
    case "closed":
      return { kind: "stale", text: "غير متصل — يتم إعادة الاتصال" };
    case "open":
      return { kind: "ok", text: "تم تحديث الاتصال" };
  }
}

function fromEvent(e: FeedbackEvent): Banner | null {
  switch (e.type) {
    case "LIVE_STATUS_CHANGED":
      return fromStatus(e.status);
    case "MOVE_REFUSED":
      return { kind: "error", text: `تعذّر النقل: ${e.messageAr}` };
    case "MOVED_BY_OTHER":
      return { kind: "ok", text: `${e.actorName} نقل هذا الطلب إلى ${e.toState}` };
    case "MOVE_COMMITTED":
    case "GROUP_MOVE_DONE":
      return null;
  }
}

function BannerPill({ banner }: { readonly banner: Banner }) {
  const surface =
    banner.kind === "error"
      ? "bg-destructive"
      : banner.kind === "stale"
        ? "bg-amber-600"
        : "bg-emerald-600";
  return (
    <div
      role="status"
      className={`fixed bottom-4 inset-inline-start-4 z-40 flex items-center gap-2 rounded-[var(--board-radius)] px-2.5 py-1.5 text-xs font-semibold text-white ${surface}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 bg-white ${banner.kind === "error" ? "" : "animate-pulse"}`}
      />
      <span>{banner.text}</span>
    </div>
  );
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
      {banner && <BannerPill banner={banner} />}
    </>
  );
}
