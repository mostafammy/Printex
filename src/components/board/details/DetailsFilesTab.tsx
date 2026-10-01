"use client";

/**
 * Files and attachments tab for WorkItemDetailsSheet.
 * Provides self-contained file uploading, 050 attachments, and 014 design versions.
 * (specs/017-press-floor-board)
 */

import React from "react";
import type { BoardCard } from "~/lib/board/types";
import type { WorkItemFullDetail } from "~/lib/board/detailTypes";
import { AttachedFiles } from "./files/AttachedFiles";
import { DesignVersions } from "./files/DesignVersions";
import { FileUploader } from "./files/FileUploader";

export interface DetailsFilesTabProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  /** Re-reads the detail in place after a successful upload. */
  readonly onRefresh?: () => void | Promise<void>;
}

export function DetailsFilesTab({
  card,
  detail,
  loading,
  onRefresh,
}: DetailsFilesTabProps) {
  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground">
        جاري تحميل الملفات والتصاميم...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FileUploader cardId={card.id} onUploaded={onRefresh} />
      <AttachedFiles assets={detail?.fileAssets ?? []} />
      <DesignVersions versions={detail?.designVersions ?? []} />
    </div>
  );
}
