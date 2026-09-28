"use client";

/**
 * LaneSkeleton: shimmering ticket-shaped placeholders shown at a lane's end
 * while its next chunk loads. Mirrors JobTicket proportions (header, title,
 * footer rows) so the list doesn't jump when real cards arrive.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface)
 */

import React from "react";

export interface LaneSkeletonProps {
  readonly count?: number;
  readonly label?: string;
}

function SkeletonTicket() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col justify-between gap-2 rounded-lg border bg-card p-3 shadow-xs"
      style={{ borderInlineStartWidth: "4px" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="lane-shimmer h-5 w-20 rounded-full" />
        <div className="lane-shimmer h-4 w-10 rounded-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="lane-shimmer h-3.5 w-3/4 rounded" />
        <div className="lane-shimmer h-4 w-1/2 rounded" />
      </div>
      <div className="flex items-center justify-between border-t border-dashed pt-2">
        <div className="lane-shimmer h-3 w-16 rounded" />
        <div className="lane-shimmer h-3 w-12 rounded" />
      </div>
    </div>
  );
}

export function LaneSkeleton({ count = 3, label }: LaneSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label ?? "جاري تحميل المزيد"}
      className="flex flex-col gap-2 px-1 pb-2 animate-in fade-in duration-200"
    >
      {Array.from({ length: Math.max(count, 1) }, (_, i) => (
        <SkeletonTicket key={i} />
      ))}
    </div>
  );
}
