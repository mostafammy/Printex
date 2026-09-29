// (shell)/loading.tsx — 092-performance T006 (spec FR-005, SR-001, AC-003).
//
// The single inherited loading boundary for every authenticated route: a soft
// navigation paints this skeleton immediately (the layout chrome renders
// around it) instead of leaving the PREVIOUS route frozen until the target
// RSC payload resolves. Honest skeleton only — aria-busy, pulsing blocks, no
// operational data and no stale content (FR-007, SR-003; Clarifications
// 2026-09-29: aria-busy only — no live-region, no focus moves). The layout
// already wraps children in `mx-auto max-w-7xl`, so this file only shapes
// the content.

export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-6" data-testid="shell-loading">
      {/* Page title */}
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      {/* Toolbar / filters row */}
      <div className="flex gap-3">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
      {/* Primary content card */}
      <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
      {/* Secondary rows */}
      <div className="space-y-3">
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted/70" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted/70" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}
