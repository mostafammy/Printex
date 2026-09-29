"use client";

/**
 * Tab bar navigation for WorkItemDetailsSheet.
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

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
  amber,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ComponentType<{ readonly className?: string }>;
  readonly label: string;
  readonly badge?: number;
  readonly amber?: boolean;
}) {
  const activeCls = amber
    ? "border-amber-600 font-bold text-amber-700 dark:text-amber-400"
    : "border-primary font-bold text-primary";
  const inactiveCls = "border-transparent text-muted-foreground hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors ${active ? activeCls : inactiveCls}`}
    >
      <Icon className={`h-3.5 w-3.5 ${amber ? "text-amber-600" : ""}`} />
      <span>{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
          {badge}
        </span>
      )}
    </button>
  );
}

export function DetailsTabBar({
  activeTab,
  onChangeTab,
  filesCount = 0,
  reworkCount = 0,
  showReworkTab,
}: DetailsTabBarProps) {
  return (
    <div className="flex border-b border-border/60 bg-muted/20 px-4 text-xs font-semibold sm:px-5">
      <TabButton
        active={activeTab === "specs"}
        onClick={() => onChangeTab("specs")}
        icon={Layers}
        label="المواصفات والإنتاج"
      />
      <TabButton
        active={activeTab === "files"}
        onClick={() => onChangeTab("files")}
        icon={Paperclip}
        label="الملفات والتصاميم"
        badge={filesCount}
      />
      {showReworkTab && (
        <TabButton
          active={activeTab === "rework"}
          onClick={() => onChangeTab("rework")}
          icon={RotateCcw}
          label={`سجل التعديل (${reworkCount})`}
          amber
        />
      )}
      <TabButton
        active={activeTab === "timeline"}
        onClick={() => onChangeTab("timeline")}
        icon={History}
        label="المسار الزمني"
      />
    </div>
  );
}
