"use client";

/**
 * LiveIndicator: displays live connection status badge using logical properties.
 * (specs/017-press-floor-board/contracts/board-live-sse.md §LiveChannel, FR-025, US4-4, plan.md S1)
 */

import { useState } from "react";
import type { LiveStatus } from "~/lib/board/types";

export function LiveIndicator() {
  const [status] = useState<LiveStatus>("open");
  const [showResyncNotice] = useState(false);

  if (status === "open" && !showResyncNotice) {
    return null;
  }

  if (showResyncNotice) {
    return (
      <div className="fixed bottom-4 inset-inline-start-4 z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs text-white shadow-lg animate-fade-in">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        <span>تم التحديث</span>
      </div>
    );
  }

  if (status === "stale" || status === "connecting") {
    return (
      <div className="fixed bottom-4 inset-inline-start-4 z-40 flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-xs text-white shadow-lg">
        <span className="h-2 w-2 rounded-full bg-white animate-ping" />
        <span>غير متصل — يتم إعادة الاتصال</span>
      </div>
    );
  }

  return null;
}
