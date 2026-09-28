"use client";

/**
 * LanePageControl: per-lane "load more" footer driven by that lane's cursor.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface)
 *
 * Each lane paginates independently — this control only ever fetches the
 * next chunk for its own lane, and reports that lane's end of list.
 */

import React from "react";
import { Check, Loader2 } from "lucide-react";
import type { WorkItemState } from "~/server/board";
import { useBoardController } from "./hooks/useBoardController";
import { useBoardSelector } from "./hooks/useBoardSelector";

export interface LanePageControlProps {
  readonly state: WorkItemState;
  readonly loaded: number;
  readonly loading: boolean;
  readonly onLoadMore: () => void;
}

function LaneEnd({ loaded }: { readonly loaded: number }) {
  if (loaded === 0) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1 text-muted-foreground select-none" aria-hidden="true">
      <span className="h-px flex-1 bg-border/60" />
      <span className="flex items-center gap-1 text-[10px] font-medium">
        <Check className="h-3 w-3" />
        نهاية القائمة
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
}

export function LanePageControl({ state, loaded, loading, onLoadMore }: LanePageControlProps) {
  const controller = useBoardController();
  const cursor = useBoardSelector(`lane:${state}`, () => controller.getLaneCursor(state));

  if (!cursor) return null;
  if (!cursor.hasMore) return <LaneEnd loaded={loaded} />;

  return (
    <button
      type="button"
      onClick={onLoadMore}
      disabled={loading}
      className="group mx-2 mb-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/80 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-xs backdrop-blur-xs transition-all hover:-translate-y-px hover:border-primary/40 hover:text-primary hover:shadow-md active:translate-y-0 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>جاري تحميل المزيد...</span>
        </>
      ) : (
        <span>تحميل المزيد · {loaded}</span>
      )}
    </button>
  );
}
