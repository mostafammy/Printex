/**
 * Magic numbers and duration configuration for the Printex loading experience.
 */

/** Delay in milliseconds before revealing anything. Loads under 180ms stay completely hidden. */
export const SHOW_DELAY_MS = 180;

/** Duration in milliseconds of the awakening enter transition (scale 0.96->1, opacity 0->1). */
export const AWAKENING_MS = 260;

/** Minimum time in milliseconds the loader stays visible once revealed to eliminate visual flicker. */
export const MIN_VISIBLE_MS = 500;

/** Duration in milliseconds of the exit and convergence sequence before unmounting. */
export const COMPLETE_MS = 620;
