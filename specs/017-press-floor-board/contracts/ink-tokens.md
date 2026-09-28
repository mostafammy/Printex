# Contract: Ink visual tokens (`src/styles/ink.css`)

This replaces the `apple-*` tokens and utilities in `src/styles/globals.css`. The shadcn semantic
tokens (`--background`, `--primary`, …) remain, re-pointed at ink primitives, so existing
components keep working.

## Layers

1. **Primitives**: per ink ∈ {cyan, magenta, violet, yellow, key, orange, green, red}:
   `--ink-<name>-fill`, `--ink-<name>-edge`, `--ink-<name>-text`, `--ink-<name>-wash`. Defined in
   OKLCH under `:root` (light) and `.dark`.
2. **Semantic**:
   - `--station-<stationId>-{fill,edge,text,wash}` → the ink assigned by FR-027
   - `--signal-backward-*`, `--signal-destructive-*`, `--signal-overdue-*` → `red` (FR-027a)
   - `--surface-canvas`, `--surface-ticket`, `--surface-lane`, `--line-perforation`
3. **Component**: set by `[data-station="<id>"]` → `--ticket-edge`, `--ticket-wash`,
   `--ticket-bar`, `--lane-glow`. Components read only component tokens.

## Rules (tested in `tests/unit/board/ink-contrast.test.ts`)

- `--ink-*-text` on `--surface-ticket` and `--surface-lane` meets ≥ 4.5:1 in light and dark (FR-029).
- `--ink-*-edge` against the surface meets ≥ 3:1 (non-text UI contrast).
- Yellow's `-text` is a dark ochre in light mode; key is graphite (`oklch(0.82 0 0)`-range) in dark
  mode (FR-027 table note).
- No station token resolves to the red ink.
- `color-scheme: light` on `:root` and `color-scheme: dark` on `.dark`; plus
  `<meta name="color-scheme" content="light dark">` in `src/app/layout.tsx`.

## Removed from `globals.css`

`.apple-glass`, `.apple-card`, `.apple-bento-card`, `.apple-glow*`, `.apple-shimmer-sweep`,
`--apple-*`, `--color-apple-*`, the global `* { transition-timing-function }` rule, and every
`transition: all`. Uses are migrated to ink component tokens (a grep check in CI: no
`apple-` identifiers remain in `src/`).

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  :root { --motion-duration-travel: 0ms; /* …all durations 0 */ }
}
```

The `MotionDirector` also swaps to `InstantChoreography`. The CSS guard covers CSS-only
transitions (hover states, sheet entry).
