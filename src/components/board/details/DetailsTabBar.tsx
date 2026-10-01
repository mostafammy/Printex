"use client";

/**
 * Tab bar segmented control for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { Layers, Paperclip, RotateCcw, History } from "lucide-react";

export type DetailTabKey = "specs" | "files" | "rework" | "timeline";

export interface DetailsTabBarProps {
  readonly activeTab: DetailTabKey;
  readonly onChangeTab: (tab: DetailTabKey) => void;
  readonly filesCount?: number;
  readonly reworkCount?: number;
  readonly showReworkTab: boolean;
}

interface TabButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ComponentType<{ readonly className?: string }>;
  readonly label: string;
  readonly badge?: number;
  readonly amber?: boolean;
}

function TabButton({ active, onClick, icon: Icon, label, badge, amber }: TabButtonProps) {
  const activeCls = amber
    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border-amber-500/30 shadow-xs"
    : "bg-card text-foreground font-bold shadow-xs border-border/60";
  const inactiveCls = "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/40";
  const iconColor = amber ? "text-amber-600 dark:text-amber-400" : active ? "text-primary" : "text-muted-foreground/70";
  const badgeCls = amber ? "bg-amber-500/30 text-amber-900 dark:text-amber-200" : "bg-primary/15 text-primary";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-98 ${active ? activeCls : inactiveCls}`}
    >
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <span>{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${badgeCls}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function DetailsTabBar({ activeTab, onChangeTab, filesCount = 0, reworkCount = 0, showReworkTab }: DetailsTabBarProps) {
  return (
    <div className="px-4 sm:px-6 pt-3">
      <div className="grid grid-flow-col auto-cols-fr gap-1.5 rounded-2xl border border-border/50 bg-muted/40 p-1.5 backdrop-blur-md">
        <TabButton active={activeTab === "specs"} onClick={() => onChangeTab("specs")} icon={Layers} label="المواصفات والإنتاج" />
        <TabButton active={activeTab === "files"} onClick={() => onChangeTab("files")} icon={Paperclip} label="الملفات والتصاميم" badge={filesCount} />
        {showReworkTab && (
          <TabButton active={activeTab === "rework"} onClick={() => onChangeTab("rework")} icon={RotateCcw} label={`سجل التعديل (${reworkCount})`} amber />
        )}
        <TabButton active={activeTab === "timeline"} onClick={() => onChangeTab("timeline")} icon={History} label="المسار الزمني" />
      </div>
    </div>
  );
}
