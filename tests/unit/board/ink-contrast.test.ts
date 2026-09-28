import { describe, expect, it } from "vitest";
import { STATIONS } from "~/server/board/stations";

/**
 * Convert OKLCH to sRGB relative luminance according to CSS Color Module Level 4.
 */
function oklchToLuminance(l: number, c: number, hDeg: number): number {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab to LMS linear
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lCube = l_ * l_ * l_;
  const mCube = m_ * m_ * m_;
  const sCube = s_ * s_ * s_;

  // LMS to linear sRGB
  const rLinear = +4.0767434036 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const gLinear = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const bLinear = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube;

  // Clamp linear sRGB
  const rClamped = Math.max(0, Math.min(1, rLinear));
  const gClamped = Math.max(0, Math.min(1, gLinear));
  const bClamped = Math.max(0, Math.min(1, bLinear));

  // WCAG relative luminance
  return 0.2126 * rClamped + 0.7152 * gClamped + 0.0722 * bClamped;
}

function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("ink contrast verification (FR-027, FR-027a, FR-029)", () => {
  const lightSurfaces = {
    ticket: oklchToLuminance(1, 0, 0),
    lane: oklchToLuminance(0.96, 0.005, 240),
  };

  const darkSurfaces = {
    ticket: oklchToLuminance(0.2, 0.015, 240),
    lane: oklchToLuminance(0.17, 0.012, 240),
  };

  const lightTexts: Record<string, [number, number, number]> = {
    cyan: [0.35, 0.12, 220],
    magenta: [0.36, 0.18, 345],
    violet: [0.35, 0.16, 295],
    yellow: [0.36, 0.13, 85],
    key: [0.18, 0.005, 240],
    orange: [0.36, 0.15, 55],
    green: [0.34, 0.14, 145],
    red: [0.36, 0.18, 25],
  };

  const darkTexts: Record<string, [number, number, number]> = {
    cyan: [0.85, 0.11, 220],
    magenta: [0.85, 0.13, 345],
    violet: [0.85, 0.12, 295],
    yellow: [0.88, 0.14, 85],
    key: [0.82, 0, 0],
    orange: [0.86, 0.13, 55],
    green: [0.85, 0.12, 145],
    red: [0.85, 0.14, 25],
  };

  it("all light mode ink text tokens achieve >= 4.5:1 contrast on surface-ticket and surface-lane", () => {
    for (const [ink, [l, c, h]] of Object.entries(lightTexts)) {
      const lumText = oklchToLuminance(l, c, h);
      const ratioTicket = contrastRatio(lumText, lightSurfaces.ticket);
      const ratioLane = contrastRatio(lumText, lightSurfaces.lane);

      expect(
        ratioTicket,
        `Light mode ink '${ink}' on surface-ticket had contrast ratio ${ratioTicket.toFixed(2)}, expected >= 4.5`,
      ).toBeGreaterThanOrEqual(4.5);

      expect(
        ratioLane,
        `Light mode ink '${ink}' on surface-lane had contrast ratio ${ratioLane.toFixed(2)}, expected >= 4.5`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("all dark mode ink text tokens achieve >= 4.5:1 contrast on surface-ticket and surface-lane", () => {
    for (const [ink, [l, c, h]] of Object.entries(darkTexts)) {
      const lumText = oklchToLuminance(l, c, h);
      const ratioTicket = contrastRatio(lumText, darkSurfaces.ticket);
      const ratioLane = contrastRatio(lumText, darkSurfaces.lane);

      expect(
        ratioTicket,
        `Dark mode ink '${ink}' on surface-ticket had contrast ratio ${ratioTicket.toFixed(2)}, expected >= 4.5`,
      ).toBeGreaterThanOrEqual(4.5);

      expect(
        ratioLane,
        `Dark mode ink '${ink}' on surface-lane had contrast ratio ${ratioLane.toFixed(2)}, expected >= 4.5`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("enforces non-station red ink (no station uses red)", () => {
    for (const station of STATIONS) {
      expect(station.ink).not.toBe("red");
    }
  });
});
