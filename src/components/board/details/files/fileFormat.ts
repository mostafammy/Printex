/**
 * Small display formatters shared by the board popup's Files tab.
 * (specs/017-press-floor-board)
 */

/** Compact byte size. The shop floor reads sizes, not byte counts. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Arabic-localized timestamp, degrading to the raw ISO string rather than
 * rendering "Invalid Date" — a malformed date is still better shown verbatim
 * than swallowed.
 */
export function formatDate(iso: string | null | undefined): string {
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
