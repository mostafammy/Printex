"use client";

import React from "react";
import { Check } from "lucide-react";

export const LIFECYCLE_STATIONS = [
  { key: "reception", label: "الاستقبال", states: ["NEW"] },
  { key: "design", label: "التصميم", states: ["ASSIGNED", "IN_DESIGN", "REWORK_REQUIRED", "DESIGN_COMPLETED"] },
  { key: "review", label: "المراجعة", states: ["WAITING_REVIEW", "APPROVED"] },
  { key: "pricing", label: "المحاسبة", states: ["WAITING_PRICING"] },
  { key: "production", label: "الإنتاج", states: ["READY_FOR_PRODUCTION", "IN_PRODUCTION", "PRODUCTION_COMPLETED"] },
  { key: "collection", label: "التسليم", states: ["READY_FOR_COLLECTION", "DELIVERED", "COMPLETED"] },
];

export function getLifecycleIndex(state: string): number {
  const idx = LIFECYCLE_STATIONS.findIndex((st) => st.states.includes(state));
  return idx >= 0 ? idx : 0;
}

function StepCircle({ isDone, isCurrent, index }: { readonly isDone: boolean; readonly isCurrent: boolean; readonly index: number }) {
  if (isDone) {
    return (
      <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-3.5 w-3.5 stroke-[3]" />
      </div>
    );
  }
  if (isCurrent) {
    return (
      <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-sm scale-110">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 border-border/80 bg-card text-muted-foreground">
      <span className="text-[11px] font-mono">{index + 1}</span>
    </div>
  );
}

export function LifecycleStepper({ currentState }: { readonly currentState: string }) {
  const activeIdx = getLifecycleIndex(currentState);
  const trackWidth = `${(activeIdx / (LIFECYCLE_STATIONS.length - 1)) * 100}%`;

  return (
    <div className="mt-3.5 rounded-2xl border border-border/50 bg-background/60 p-2.5 sm:p-3 backdrop-blur-md">
      <div className="relative flex items-center justify-between">
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-1 bg-border/60 rounded-full -z-0">
          <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: trackWidth }} />
        </div>
        {LIFECYCLE_STATIONS.map((station, i) => (
          <div key={station.key} className="relative z-10 flex flex-col items-center gap-1.5">
            <StepCircle isDone={i < activeIdx} isCurrent={i === activeIdx} index={i} />
            <span className={`text-[11px] font-semibold ${i === activeIdx ? "text-primary font-bold" : i < activeIdx ? "text-foreground" : "text-muted-foreground/70"}`}>
              {station.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
