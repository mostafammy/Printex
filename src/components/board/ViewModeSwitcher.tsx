"use client";

/**
 * ViewModeSwitcher: toggles the board between the station rail and the full
 * horizontal board. Both views render the same StationColumn components off
 * the same store — this only chooses which are mounted.
 *
 * The labels name what the operator gets rather than the mechanism behind it.
 * "عرض الأقسام" with a rows icon described neither the layout nor the
 * outcome; "محطّتي" and "كل المحطات" do.
 */

import React from "react";
import { Columns3, Rows3 } from "lucide-react";

export type BoardViewMode = "tabbed" | "full";

export interface ViewModeSwitcherProps {
  readonly mode: BoardViewMode;
  readonly onChange: (mode: BoardViewMode) => void;
}

const OPTIONS: readonly { readonly id: BoardViewMode; readonly labelAr: string }[] = [
  { id: "tabbed", labelAr: "محطّتي" },
  { id: "full", labelAr: "كل المحطات" },
];

export function ViewModeSwitcher({ mode, onChange }: ViewModeSwitcherProps) {
  return (
    // A layout preference is a choice between mutually exclusive options, so
    // it is a radiogroup. role="group" with aria-pressed announced "pressed"
    // without saying pressed into which layout.
    <div
      role="radiogroup"
      aria-label="طريقة عرض اللوحة"
      className="flex items-center gap-px rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-muted/40 p-px"
    >
      {OPTIONS.map((opt) => {
        const isActive = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.id)}
            className={`flex min-h-11 items-center gap-1.5 px-3 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.id === "tabbed" ? (
              <Rows3 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Columns3 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{opt.labelAr}</span>
          </button>
        );
      })}
    </div>
  );
}
