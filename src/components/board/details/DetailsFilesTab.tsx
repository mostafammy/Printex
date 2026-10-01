"use client";

/**
 * Files tab for the board's Work Item details popup.
 * (specs/017-press-floor-board)
 *
 * This tab is where the shop floor needs to attach a file: the person at the
 * board has the customer's artwork in hand and the card open in front of them.
 *
 * Two kinds of file live on a Work Item and they are NOT the same thing:
 *
 *   * `fileAssets` (050)     — the auditable, versioned attachment record.
 *     This is what the uploader writes, through 050's own route.
 *   * `designVersions` (014) — the design workspace's drafts and proofs,
 *     produced inside /design and shown here read-only.
 *
 * The parts live in `./files/` — the tab itself is only composition.
 */

import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { BoardCard } from "~/lib/board/types";
import type { WorkItemFullDetail } from "~/lib/board/detailTypes";
import { AttachedFiles } from "./files/AttachedFiles";
import { DesignVersions } from "./files/DesignVersions";
import { FileUploader } from "./files/FileUploader";

export interface DetailsFilesTabProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  /** Re-reads the detail in place. Called after a successful upload. */
  readonly onRefresh?: () => void | Promise<void>;
}

function FullFilesLink({ cardId }: { readonly cardId: string }) {
  return (
    <div className="mt-1 text-center">
      <Link
        href={`/work-items/${cardId}/files`}
        className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
      >
        <span>عرض لوحة إدارة الملفات والمرفقات الكاملة</span>
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function DetailsFilesTab({
  card,
  detail,
  loading,
  onRefresh,
}: DetailsFilesTabProps) {
  if (loading) {
    return (
      <div className="text-muted-foreground py-8 text-center text-xs">
        جاري تحميل الملفات...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FileUploader cardId={card.id} onUploaded={onRefresh} />
      <AttachedFiles assets={detail?.fileAssets ?? []} />
      <DesignVersions versions={detail?.designVersions ?? []} />
      <FullFilesLink cardId={card.id} />
    </div>
  );
}
