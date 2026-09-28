"use client";

/**
 * ViewModeSwitcher: toggles the board between the full horizontal board and
 * the single-station tabbed view. Both views render the same StationColumn
 * components off the same store — this only chooses which are mounted.
 */

import React from "react";
import { Columns3, Rows3 } from "lucide-react";

export type BoardViewMode = "tabbed" | "full";

export interface ViewModeSwitcherProps {
  readonly mode: BoardViewMode;
  readonly onChange: (mode: BoardViewMode) => void;
}

const OPTIONS: readonly { readonly id: BoardViewMode; readonly labelAr: string }[] = [
  { id: "tabbed", labelAr: "عرض الأقسام" },
  { id: "full", labelAr: "عرض الأعمدة" },
];

export function ViewModeSwitcher({ mode, onChange }: ViewModeSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="طريقة عرض اللوحة"
      className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-0.5"
    >
      {OPTIONS.map((opt) => {
        const isActive = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
              isActive
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.id === "tabbed" ? (
              <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{opt.labelAr}</span>
          </button>
        );
      })}
    </div>
  );
}
