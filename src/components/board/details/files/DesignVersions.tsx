"use client";

/**
 * 014's design versions, as seen from the board popup.
 * (specs/017-press-floor-board)
 *
 * These are a DIFFERENT record from 050's attachments: they are the design
 * workspace's own drafts and proofs, produced inside /design and read-only
 * here. They are shown for reference only — attaching the current artwork is
 * what the uploader above is for.
 */

import React from "react";
import { CheckCircle2 } from "lucide-react";
import type { DetailDesignVersion } from "~/lib/board/detailTypes";
import { formatBytes, formatDate } from "./fileFormat";

function DesignVersionCard({ dv }: { readonly dv: DetailDesignVersion }) {
  return (
    <div className="border-border/70 bg-card flex flex-col gap-2 rounded-xl border p-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold">
            v{dv.version}
          </span>
          <div>
            <div className="text-foreground text-xs font-bold">
              {dv.fileName}
            </div>
            <div className="text-2xs text-muted-foreground">
              {formatBytes(dv.sizeBytes)} · رفعها {dv.uploadedByName} في{" "}
              {formatDate(dv.createdAt)}
            </div>
          </div>
        </div>
        <ApprovalBadge approved={dv.approvedAt !== null} />
      </div>
      {dv.note && (
        <p className="bg-muted/40 text-muted-foreground rounded-md p-2 text-xs">
          {dv.note}
        </p>
      )}
    </div>
  );
}

function ApprovalBadge({ approved }: { readonly approved: boolean }) {
  if (!approved) {
    return (
      <span className="bg-muted text-2xs text-muted-foreground rounded-full px-2 py-0.5">
        مسودة
      </span>
    );
  }

  return (
    <span className="text-2xs inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600">
      <CheckCircle2 className="h-3 w-3" />
      معتمد
    </span>
  );
}

export function DesignVersions({
  versions,
}: {
  readonly versions: readonly DetailDesignVersion[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-xs font-bold">إصدارات التصميم</h3>
        <span className="text-2xs text-muted-foreground">
          {versions.length}
        </span>
      </div>

      {versions.length > 0 ? (
        versions.map((dv) => <DesignVersionCard key={dv.id} dv={dv} />)
      ) : (
        <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed py-6 text-center text-xs">
          لا توجد تصاميم مرفوعة لهذا الصنف حالياً
        </div>
      )}
    </section>
  );
}
