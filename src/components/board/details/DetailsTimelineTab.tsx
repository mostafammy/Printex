"use client";

/**
 * World-class Apple-grade State transitions and audit timeline tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { Clock, User, MessageSquare, Sparkles, Inbox, ArrowLeft } from "lucide-react";
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

function TransitionItem({ t, isLatest }: { readonly t: DetailTransition; readonly isLatest?: boolean }) {
  const fromLabel = STATE_AR_LABELS[t.from as keyof typeof STATE_AR_LABELS] ?? t.from;
  const toLabel = STATE_AR_LABELS[t.to as keyof typeof STATE_AR_LABELS] ?? t.to;

  return (
    <div className="relative group">
      {/* Node indicator on the timeline */}
      <span
        className={`absolute -start-[23px] top-4 h-3.5 w-3.5 rounded-full border-2 border-background transition-all ${
          isLatest
            ? "bg-primary ring-4 ring-primary/25 scale-110 shadow-sm"
            : "bg-muted-foreground/60 ring-2 ring-border/80 group-hover:bg-primary group-hover:ring-primary/20"
        }`}
      />

      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* State progression */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="rounded-lg bg-muted/60 px-2 py-0.5 text-muted-foreground">
              {fromLabel}
            </span>
            <span className="text-muted-foreground/60 font-normal">←</span>
            <span className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-primary font-black shadow-2xs">
              {toLabel}
            </span>
          </div>

          {/* Timestamp */}
          <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
            <Clock className="h-3 w-3 text-muted-foreground/70" />
            {formatDate(t.at)}
          </span>
        </div>

        {/* Actor */}
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <User className="h-3 w-3 text-muted-foreground/70" />
          <span>بواسطة:</span>
          <span className="font-bold text-foreground/90">{t.actorName}</span>
        </div>

        {/* Reason / note */}
        {t.reason && (
          <div className="mt-1 flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 p-2.5 text-2xs text-foreground/90 leading-relaxed">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary/70 mt-0.5" />
            <p className="flex-1 font-medium">{t.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DetailsTimelineTab({ detail, loading }: DetailsTimelineTabProps) {
  if (loading) {
    return <div className="py-12 text-center text-xs text-muted-foreground">جاري تحميل المسار الزمني...</div>;
  }

  const transitions = detail?.transitions ?? [];

  if (transitions.length === 0) {
    if (detail?.createdAt) {
      return (
        <div className="relative flex flex-col gap-4 pe-2 ps-6 before:absolute before:inset-y-3 before:start-2 before:w-0.5 before:bg-gradient-to-b before:from-primary before:to-border/40">
          <div className="relative group">
            <span className="absolute -start-[23px] top-4 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary ring-4 ring-primary/25 shadow-sm scale-110" />
            <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Inbox className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-black text-sm text-foreground">تم إنشاء أمر العمل (جديد)</span>
                </div>
                <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded-md border border-border/50">
                  <Clock className="h-3 w-3" />
                  {formatDate(detail.createdAt)}
                </span>
              </div>
              {detail.createdBy?.name && (
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <User className="h-3 w-3 text-muted-foreground/70" />
                  <span>بواسطة:</span>
                  <span className="font-bold text-foreground/90">{detail.createdBy.name}</span>
                </div>
              )}
              <p className="text-2xs text-muted-foreground bg-background/60 p-2.5 rounded-xl border border-border/40 leading-relaxed">
                استلام الطلب في صالة الاستقبال وبانتظار الإسناد للمصمم وتدقيق المواصفات.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 py-12 text-center text-xs text-muted-foreground">
        لا توجد انتقالات مسجلة
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 pe-2 ps-6 before:absolute before:inset-y-3 before:start-2 before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-primary/40 before:to-border/60">
      {transitions.map((t, idx) => (
        <TransitionItem key={t.id} t={t} isLatest={idx === 0} />
      ))}

      {detail?.createdAt && (
        <div className="relative group">
          <span className="absolute -start-[23px] top-4 h-3.5 w-3.5 rounded-full border-2 border-background bg-muted-foreground/40 ring-2 ring-border/80" />
          <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3.5 sm:p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold text-muted-foreground">تم إنشاء أمر العمل (جديد)</span>
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(detail.createdAt)}
              </span>
            </div>
            {detail.createdBy?.name && (
              <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <User className="h-3 w-3 text-muted-foreground/70" />
                <span>بواسطة:</span>
                <span className="font-medium text-foreground/80">{detail.createdBy.name}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
