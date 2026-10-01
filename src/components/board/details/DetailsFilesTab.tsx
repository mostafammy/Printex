"use client";

/**
 * Files and design versions tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import Link from "next/link";
import { ExternalLink, FileText, User, Calendar, ShieldCheck } from "lucide-react";
import type { BoardCard } from "~/lib/board/types";
import type { DetailDesignVersion, WorkItemFullDetail } from "~/lib/board/detailTypes";

export interface DetailsFilesTabProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function VersionHeader({ dv }: { readonly dv: DetailDesignVersion }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary border border-primary/20">
          <FileText className="h-5 w-5" />
          <span className="absolute -bottom-1 -end-1 rounded-md bg-card px-1 py-0.2 font-mono text-[9px] font-black border border-border/80 shadow-2xs">
            v{dv.version}
          </span>
        </div>
        <div>
          <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{dv.fileName}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
            <span className="font-mono">{formatBytes(dv.sizeBytes)}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3 text-muted-foreground/70" />{dv.uploadedByName}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-mono"><Calendar className="h-3 w-3 text-muted-foreground/70" />{formatDate(dv.createdAt)}</span>
          </div>
        </div>
      </div>
      {dv.approvedAt ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5" />معتمد
        </span>
      ) : (
        <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">مسودة</span>
      )}
    </div>
  );
}

function DesignVersionCard({ dv }: { readonly dv: DetailDesignVersion }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm">
      <VersionHeader dv={dv} />
      {dv.note && (
        <div className="mt-3 rounded-xl border border-border/50 bg-muted/30 p-2.5 text-xs text-muted-foreground leading-relaxed">
          {dv.note}
        </div>
      )}
    </div>
  );
}

export function DetailsFilesTab({ card, detail, loading }: DetailsFilesTabProps) {
  if (loading) {
    return <div className="py-12 text-center text-xs text-muted-foreground">جاري تحميل الملفات والتصاميم...</div>;
  }

  const versions = detail?.designVersions ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      {versions.length > 0 ? (
        versions.map((dv) => <DesignVersionCard key={dv.id} dv={dv} />)
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 py-12 text-center text-xs text-muted-foreground">
          لا توجد تصاميم مرفوعة لهذا الصنف حالياً
        </div>
      )}
      <div className="mt-2 text-center">
        <Link
          href={`/work-items/${card.id}/files`}
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-xs font-bold text-primary shadow-2xs transition-all hover:bg-primary/10 hover:border-primary/40 active:scale-95"
        >
          <span>عرض لوحة إدارة الملفات والمرفقات الكاملة</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
