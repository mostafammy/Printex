/**
 * Motion tokens reader: reads CSS motion custom properties with safe fallbacks.
 * (contracts/board-engine.md §Motion tokens, plan.md S1)
 */

export interface MotionTokens {
  readonly springEasing: string;
  readonly bounceEasing: string;
  readonly durationTravel: number;
  readonly durationStamp: number;
  readonly durationFlyback: number;
  readonly durationArc: number;
  readonly durationRollout: number;
  readonly durationLand: number;
}

export const DEFAULT_MOTION_TOKENS: MotionTokens = {
  springEasing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
  bounceEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  durationTravel: 380,
  durationStamp: 220,
  durationFlyback: 420,
  durationArc: 520,
  durationRollout: 480,
  durationLand: 320,
};

function parseMs(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = /^(\d+(?:\.\d+)?)(ms|s)?$/.exec(value.trim());
  if (!match?.[1]) return fallback;
  const num = parseFloat(match[1]);
  return match[2] === "s" ? num * 1000 : num;
}

export function readMotionTokens(element?: Element | null): MotionTokens {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_MOTION_TOKENS;
  }
  const target = element ?? document.documentElement;
  const style = window.getComputedStyle(target);
  const springEasing =
    style.getPropertyValue("--motion-spring").trim() || DEFAULT_MOTION_TOKENS.springEasing;
  const bounceEasing =
    style.getPropertyValue("--motion-bounce").trim() || DEFAULT_MOTION_TOKENS.bounceEasing;

  return {
    springEasing,
    bounceEasing,
    durationTravel: parseMs(
      style.getPropertyValue("--motion-duration-travel"),
      DEFAULT_MOTION_TOKENS.durationTravel,
    ),
    durationStamp: parseMs(
      style.getPropertyValue("--motion-duration-stamp"),
      DEFAULT_MOTION_TOKENS.durationStamp,
    ),
    durationFlyback: parseMs(
      style.getPropertyValue("--motion-duration-flyback"),
      DEFAULT_MOTION_TOKENS.durationFlyback,
    ),
    durationArc: parseMs(
      style.getPropertyValue("--motion-duration-arc"),
      DEFAULT_MOTION_TOKENS.durationArc,
    ),
    durationRollout: parseMs(
      style.getPropertyValue("--motion-duration-rollout"),
      DEFAULT_MOTION_TOKENS.durationRollout,
    ),
    durationLand: parseMs(
      style.getPropertyValue("--motion-duration-land"),
      DEFAULT_MOTION_TOKENS.durationLand,
    ),
  };
}
