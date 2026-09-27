// Arabic display formatting shared by SERVER and CLIENT.
//
// Home here, deliberately: these functions must be importable from `"use
// client"` components (the bell's badge, the dropdown's relative time), and
// a client module may not pull `~/server/notifications` — that barrel
// transitively imports `next/headers` (through `~/server/auth`), which
// breaks `next build` with "needs next/headers … not supported outside a
// Server Component". Type-only imports from the barrel are fine (erased at
// compile time); VALUE imports are not, which is exactly what this module
// replaces.
//
// One implementation, SC-012: the server's `formatAge` and the bell's
// badge both digit-render through here, so an age never renders two ways on
// two screens — the previous arrangement would have forked the digit map
// across client and server to work around the build.

/** ASCII digits → Arabic-Indic (٠١٢٣٤٥٦٧٨٩). */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

/**
 * The bell's unread badge: the exact count in Arabic-Indic digits, or
 * `99+` from 100 up (the display bound only — the API's count stays exact,
 * contracts/ui.md §Count badge).
 */
export function formatBadge(count: number): string {
  return count >= 100 ? "99+" : toArabicDigits(count);
}
