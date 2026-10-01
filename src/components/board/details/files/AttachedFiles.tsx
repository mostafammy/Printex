"use client";

/**
 * The 050 attachments section of the board popup's Files tab.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { Paperclip } from "lucide-react";
import type { DetailFileAsset } from "~/lib/board/detailTypes";
import { categoryLabel } from "./fileCategories";
import { FileVersionRow } from "./FileVersionRow";

/** Header + count. The count is of versions, not assets, because that is the
 *  number of distinct files a person has to reason about. */
function AttachmentsHeading({ count }: { readonly count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-foreground flex items-center gap-1.5 text-xs font-bold">
        <Paperclip className="text-muted-foreground h-3.5 w-3.5" />
        المرفقات
      </h3>
      <span className="text-2xs text-muted-foreground">{count} ملف</span>
    </div>
  );
}

export function AttachedFiles({
  assets,
}: {
  readonly assets: readonly DetailFileAsset[];
}) {
  if (assets.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <AttachmentsHeading count={0} />
        <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed py-6 text-center text-xs">
          لا توجد مرفقات لهذا الصنف. استخدم زر الرفع أعلاه لإضافة أول ملف.
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <AttachmentsHeading
        count={assets.reduce((n, a) => n + a.versions.length, 0)}
      />
      <div className="flex flex-col gap-3">
        {assets.map((asset) => (
          <div key={asset.id} className="flex flex-col gap-1.5">
            <span className="text-2xs text-muted-foreground font-bold">
              {categoryLabel(asset.category)}
            </span>
            <ul className="flex flex-col gap-1.5">
              {asset.versions.map((version) => (
                <FileVersionRow key={version.id} version={version} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
