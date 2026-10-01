"use client";

/**
 * One 050 file version inside the board popup's Files tab.
 * (specs/017-press-floor-board)
 */

import React from "react";
import { Download, FileText } from "lucide-react";
import type { DetailFileVersion } from "~/lib/board/detailTypes";
import { retiredLabel } from "./fileCategories";
import { formatBytes, formatDate } from "./fileFormat";

/**
 * The two badges are mutually exclusive in practice (`markApproved` refuses a
 * retired version), but rendering both when they somehow co-occur says
 * "approved AND cancelled" rather than hiding one of them.
 */
function VersionBadges({ version }: { readonly version: DetailFileVersion }) {
  const retired = retiredLabel(version.status);

  return (
    <>
      {version.approved && (
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
          معتمد
        </span>
      )}
      {retired && (
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
          {retired}
        </span>
      )}
    </>
  );
}

function VersionIdentity({
  version,
  live,
}: {
  readonly version: DetailFileVersion;
  readonly live: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={`text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono font-bold ${
          live ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        v{version.versionNumber}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <FileText className="text-muted-foreground h-3 w-3 shrink-0" />
          <span
            className="text-foreground truncate text-xs font-semibold"
            title={version.originalName}
          >
            {version.originalName}
          </span>
          <VersionBadges version={version} />
        </div>
        <div className="text-2xs text-muted-foreground truncate">
          {formatBytes(version.sizeBytes)} · {version.uploadedByName} ·{" "}
          {formatDate(version.createdAt)}
          {version.note ? ` · ${version.note}` : ""}
        </div>
      </div>
    </div>
  );
}

export function FileVersionRow({
  version,
}: {
  readonly version: DetailFileVersion;
}) {
  const retired = retiredLabel(version.status) !== null;
  const live = !retired;

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
        retired
          ? "border-border/50 bg-muted/20 opacity-70"
          : "border-border/70 bg-card"
      }`}
    >
      <VersionIdentity version={version} live={live} />

      {/* 050's own download route re-authorizes, re-verifies the SHA-256 and
          streams the bytes with a Content-Disposition, so this is a plain link
          rather than a fetch: the browser handles the save and a multi-hundred-MB
          print file never passes through JS memory. */}
      <a
        href={`/api/files/${version.id}/download`}
        className="border-border/70 text-2xs text-foreground hover:border-primary/40 hover:text-primary inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 font-semibold transition-colors"
        aria-label={`تحميل ${version.originalName}`}
      >
        <Download className="h-3 w-3" />
        تحميل
      </a>
    </li>
  );
}
