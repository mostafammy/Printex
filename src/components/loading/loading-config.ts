/**
 * Magic numbers and duration configuration for the Printex loading experience.
 *
 * These durations drive the BOOT overlay only (092-performance FR-001/FR-002,
 * spec Clarifications 2026-09-29 Option A): navigation no longer arms any
 * loading UI, so the anti-flicker minimum applies to cold start alone.
 */

/** Delay in milliseconds before revealing anything. Loads under 180ms stay completely hidden. */
export const SHOW_DELAY_MS = 180;

/** Duration in milliseconds of the awakening enter transition (scale 0.96->1, opacity 0->1). */
export const AWAKENING_MS = 260;

/** Minimum time in milliseconds the loader stays visible once revealed to eliminate visual flicker. */
export const MIN_VISIBLE_MS = 500;

/** Duration in milliseconds of the exit and convergence sequence before unmounting. */
export const COMPLETE_MS = 620;
