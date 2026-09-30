// (shell)/loading.tsx — 092-performance T006 (spec FR-005, SR-001, AC-003).
//
// The single inherited loading boundary for every authenticated route: a soft
// navigation paints this skeleton immediately (the layout chrome renders
// around it) instead of leaving the PREVIOUS route frozen until the target
// RSC payload resolves. Honest skeleton only — aria-busy, shimmering blocks,
// no operational data and no stale content (FR-007, SR-003; Clarifications
// 2026-09-29: aria-busy only — no live-region, no focus moves). The layout
// already wraps children in `mx-auto max-w-7xl`, so this file only shapes
// the content.
//
// T050 (investigation §17 Fix B): every block is a `Skeleton` — the shared
// `.skeleton` shimmer from globals.css replaces the animate-pulse-only look;
// `animate-pulse` is kept alongside the shimmer here so the block still
// breathes if the glint is ever disabled, and prefers-reduced-motion turns
// both off.

import { Skeleton } from "~/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-6" data-testid="shell-loading">
      {/* Page title */}
      <Skeleton className="h-8 w-48 animate-pulse rounded-md" />
      {/* Toolbar / filters row */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-32 animate-pulse rounded-lg" />
        <Skeleton className="h-9 w-24 animate-pulse rounded-lg" />
      </div>
      {/* Primary content card */}
      <Skeleton className="h-64 w-full animate-pulse rounded-xl" />
      {/* Secondary rows */}
      <div className="space-y-3">
        <Skeleton className="h-14 w-full animate-pulse rounded-lg bg-muted/70" />
        <Skeleton className="h-14 w-full animate-pulse rounded-lg bg-muted/70" />
        <Skeleton className="h-14 w-full animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}
