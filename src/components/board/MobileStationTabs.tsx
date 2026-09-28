"use client";

/**
 * MobileStationTabs: responsive single-column switcher for phone viewports (< 640px).
 * (specs/017-press-floor-board/spec.md FR-035c, SC-010, plan.md S1)
 */

import React from "react";
import { STATIONS } from "~/lib/board/stations";
import type { StationId } from "~/server/board";

export interface MobileStationTabsProps {
  readonly activeStationId: StationId;
  readonly onSelectStation: (id: StationId) => void;
}

export const MobileStationTabs = React.memo(function MobileStationTabs({
  activeStationId,
  onSelectStation,
}: MobileStationTabsProps) {
  return (
    <nav
      aria-label="محطات المطبعة للهاتف"
      className="flex sm:hidden overflow-x-auto gap-1 border-b border-border/60 bg-muted/20 p-2 scrollbar-none"
    >
      {STATIONS.map((st) => {
        const isActive = st.id === activeStationId;
        return (
          <button
            key={st.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectStation(st.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: `var(--ink-${st.ink})` }}
              aria-hidden="true"
            />
            <span>{st.labelAr}</span>
          </button>
        );
      })}
    </nav>
  );
});
