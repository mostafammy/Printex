"use client";

/**
 * Files and design versions tab for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
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

function DesignVersionCard({ dv }: { readonly dv: DetailDesignVersion }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
            v{dv.version}
          </span>
          <div>
            <div className="text-xs font-bold text-foreground">{dv.fileName}</div>
            <div className="text-2xs text-muted-foreground">
              {formatBytes(dv.sizeBytes)} · رفعها {dv.uploadedByName} في {formatDate(dv.createdAt)}
            </div>
          </div>
        </div>
        {dv.approvedAt ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-bold text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            معتمد
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">مسودة</span>
        )}
      </div>
      {dv.note && <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{dv.note}</p>}
    </div>
  );
}

export function DetailsFilesTab({ card, detail, loading }: DetailsFilesTabProps) {
  if (loading) {
    return <div className="py-8 text-center text-xs text-muted-foreground">جاري تحميل الملفات...</div>;
  }

  const versions = detail?.designVersions ?? [];

  return (
    <div className="flex flex-col gap-3">
      {versions.length > 0 ? (
        versions.map((dv) => <DesignVersionCard key={dv.id} dv={dv} />)
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
          لا توجد تصاميم مرفوعة لهذا الصنف حالياً
        </div>
      )}

      <div className="mt-2 text-center">
        <Link
          href={`/work-items/${card.id}/files`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <span>عرض لوحة إدارة الملفات والمرفقات الكاملة</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
