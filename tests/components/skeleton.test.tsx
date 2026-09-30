/** @vitest-environment jsdom */
// tests/components/skeleton.test.tsx — T050 (092-performance, Phase 11).
//
// Acceptance for the shimmering skeleton system (investigation §6.2 / §17
// Fix B):
// - `Skeleton` renders an honest block: aria-busy, mergeable className,
//   `.skeleton` shimmer class, default `bg-muted` — never operational data
// - globals.css carries the shimmer keyframes: a glint sweeping via
//   background-position (~1.5s linear infinite), RTL-safe (no directional
//   left/right properties), fully disabled under
//   `@media (prefers-reduced-motion: reduce)` with `animation: none`

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Skeleton } from "~/components/ui/skeleton";

// vitest config has no `globals: true`, so RTL's automatic cleanup never
// registers — clean up explicitly between tests.
afterEach(cleanup);

const css = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8",
);

describe("Skeleton component (T050)", () => {
  it("renders an aria-busy block with the shimmer class and default bg-muted", () => {
    render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId("sk");

    expect(el).toHaveAttribute("aria-busy", "true");
    expect(el.className).toContain("skeleton");
    expect(el.className).toContain("bg-muted");
    // Honest fallback: no operational data, no live region (FR-007, SR-003).
    expect(el).not.toHaveAttribute("aria-live");
    expect(el).toBeEmptyDOMElement();
  });

  it("merges caller className (size/rounding overrides) onto the defaults", () => {
    render(<Skeleton data-testid="sk" className="h-8 w-48 rounded-xl" />);
    const el = screen.getByTestId("sk");

    expect(el.className).toContain("h-8");
    expect(el.className).toContain("w-48");
    expect(el.className).toContain("rounded-xl");
    // still a skeleton, still aria-busy
    expect(el.className).toContain("skeleton");
    expect(el).toHaveAttribute("aria-busy", "true");
  });
});

describe("shimmer CSS (T050 — globals.css)", () => {
  it("defines the .skeleton glint: background-position sweep, ~1.5s linear infinite", () => {
    expect(css).toContain(".skeleton {");
    expect(css).toContain("@keyframes skeleton-shimmer");
    expect(css).toMatch(
      /animation:\s*skeleton-shimmer\s+1\.5s\s+linear\s+infinite/,
    );
    // Moving glint via gradient + background-position (not directional props).
    expect(css).toMatch(/background-position:\s*-?200% 0/);
    expect(css).toMatch(
      /\.skeleton\s*\{[^}]*background-image:\s*linear-gradient/,
    );
  });

  it("is RTL-safe: the skeleton rule uses no directional left/right properties", () => {
    const rule = css.match(/\.skeleton\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule.length).toBeGreaterThan(0);
    expect(rule).not.toMatch(/\bleft\s*:/);
    expect(rule).not.toMatch(/\bright\s*:/);
    expect(rule).not.toMatch(/text-align:\s*(left|right)/);
  });

  it("fully disables shimmer under prefers-reduced-motion: reduce", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.skeleton\s*\{[^}]*animation:\s*none/,
    );
    // The reduced-motion block must also drop the glint itself.
    const reduced = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.skeleton\s*\{[^}]*\}/,
    )?.[0];
    expect(reduced).toContain("background-image: none");
  });
});
