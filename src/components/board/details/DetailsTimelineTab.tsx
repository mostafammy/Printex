"use client";

/**
 * State transitions and audit timeline tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import type { DetailTransition, WorkItemFullDetail } from "~/lib/board/detailTypes";
import { STATE_AR_LABELS } from "~/lib/board/stations";

export interface DetailsTimelineTabProps {
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function TransitionItem({ t }: { readonly t: DetailTransition }) {
  const fromLabel = STATE_AR_LABELS[t.from as keyof typeof STATE_AR_LABELS] ?? t.from;
  const toLabel = STATE_AR_LABELS[t.to as keyof typeof STATE_AR_LABELS] ?? t.to;

  return (
    <div className="relative flex flex-col gap-1 text-xs">
      <span className="absolute -start-[17px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <span>{fromLabel}</span>
          <span className="text-muted-foreground">←</span>
          <span className="text-primary">{toLabel}</span>
        </div>
        <span className="font-mono text-2xs text-muted-foreground">{formatDate(t.at)}</span>
      </div>

      <div className="text-2xs text-muted-foreground">
        بواسطة: <span className="font-semibold text-foreground/80">{t.actorName}</span>
      </div>

      {t.reason && (
        <p className="mt-0.5 rounded-md bg-muted/40 p-1.5 text-2xs text-foreground/90">
          السبب: {t.reason}
        </p>
      )}
    </div>
  );
}

export function DetailsTimelineTab({ detail, loading }: DetailsTimelineTabProps) {
  if (loading) {
    return <div className="py-8 text-center text-xs text-muted-foreground">جاري تحميل المسار الزمني...</div>;
  }

  const transitions = detail?.transitions ?? [];

  if (transitions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
        لا توجد انتقالات مسجلة
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 pe-2 ps-4 before:absolute before:inset-y-2 before:start-1.5 before:w-0.5 before:bg-border/80">
      {transitions.map((t) => (
        <TransitionItem key={t.id} t={t} />
      ))}
    </div>
  );
}
