"use client";

import React from "react";
import Link from "next/link";
import {
  Calendar,
  RotateCcw,
  ArrowUpRight,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  startTimerAction,
  pauseTimerAction,
  type MyQueueRowWithDurations,
} from "./actions";
import ar from "~/messages/ar.json";

const S = ar.ui;

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-EG", {
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MyQueueRowItem({
  item,
}: {
  readonly item: MyQueueRowWithDurations;
}) {
  const { row, durations } = item;

  return (
    <tr
      className={`group transition-all duration-200 ${
        row.hasOpenTimer
          ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08] border-s-4 border-s-emerald-500"
          : row.priority === "URGENT"
            ? "bg-rose-500/[0.02] hover:bg-muted/40 border-s-4 border-s-rose-500"
            : "hover:bg-muted/40"
      }`}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/15 to-indigo-500/15 text-xs font-bold text-primary border border-primary/20 shadow-2xs">
            {row.customerName.charAt(0) || "ع"}
          </div>
          <div>
            <Link
              href={`/orders/${row.orderId}`}
              className="group/link flex items-center gap-1.5 font-bold text-foreground hover:text-primary transition-colors text-sm"
            >
              <span>{row.customerName}</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-100" />
            </Link>
            <div className="mt-0.5 inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
              #{row.orderNumber}
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/60 px-3 py-1 text-xs font-semibold text-foreground shadow-2xs">
          {row.productTypeName ?? S.myQueueNoProductType}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>{formatDate(row.dueDate)}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {row.priority === "URGENT" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500/15 to-orange-500/15 border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              {S.badgeUrgent}
            </span>
          )}
          {row.isRework && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 shadow-2xs">
              <RotateCcw className="h-3 w-3" />
              {S.myQueueBadgeRework}
            </span>
          )}
          {row.priority !== "URGENT" && !row.isRework && (
            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              عادي
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          {row.hasOpenTimer && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          )}
          <span
            className={`rounded-xl px-3 py-1 font-mono text-xs tabular-nums ${
              row.hasOpenTimer
                ? "bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold"
                : "bg-muted/60 text-muted-foreground font-medium"
            }`}
          >
            {formatDuration(durations.activeTimeMs)}
          </span>
        </div>
      </td>
      <td className="px-5 py-4">
        <form action={row.hasOpenTimer ? pauseTimerAction : startTimerAction} className="flex">
          <input type="hidden" name="workItemId" value={row.workItemId} />
          <Button
            type="submit"
            variant={row.hasOpenTimer ? "outline" : "default"}
            size="sm"
            className={
              row.hasOpenTimer
                ? "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 font-bold"
                : "font-bold shadow-sm"
            }
          >
            {row.hasOpenTimer ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>{S.myQueuePauseButton}</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>{row.state === "IN_DESIGN" ? S.myQueueResumeButton : S.myQueueStartButton}</span>
              </>
            )}
          </Button>
        </form>
      </td>
    </tr>
  );
}
