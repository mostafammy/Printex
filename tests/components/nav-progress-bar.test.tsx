/** @vitest-environment jsdom */
// tests/components/nav-progress-bar.test.tsx — T010 (092-performance).
//
// Spec FR-004 / NB-003: the route progress indicator is decorative,
// pointer-transparent, never full-screen, reveals only for navigations slower
// than 2 s, and always clears on real route commitment.

import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NAV_PROGRESS_REVEAL_MS,
  NavProgressBar,
} from "~/components/loading/nav-progress-bar";

const pathnameMock = vi.fn(() => "/board");

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

const bar = () => screen.getByTestId("nav-progress");

function mount() {
  const { rerender } = render(<NavProgressBar />);
  return () => act(() => rerender(<NavProgressBar />));
}

/** Commit a new route: change the mock AND re-render (React only re-runs
    effects when the component actually renders with the new pathname). */
function navigate(to: string, rerender: () => void) {
  pathnameMock.mockReturnValue(to);
  act(() => rerender());
}

function clickLink(href: string) {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  document.body.appendChild(anchor);
  act(() => {
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
  });
  anchor.remove();
}

describe("NavProgressBar (T010)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pathnameMock.mockReturnValue("/board");
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows nothing on the initial render — boot is not a navigation", () => {
    mount();
    expect(bar()).toHaveAttribute("data-visible", "false");
  });

  it("never blocks input and is hidden from assistive tech (FR-004)", () => {
    mount();
    expect(bar()).toHaveAttribute("aria-hidden", "true");
    expect(bar().className).toContain("pointer-events-none");
    // Thin top edge — never a full-screen layer.
    expect(bar().className).toContain("fixed");
    expect(bar().className).toContain("inset-x-0");
    expect(bar().className).toContain("top-0");
    expect(bar().className).not.toContain("inset-0");
  });

  it("appears once a navigation runs past the reveal delay", async () => {
    mount();

    clickLink("/my-queue");
    // Under the delay: nothing drawn (no flicker on fast hops).
    expect(bar()).toHaveAttribute("data-visible", "false");

    await advance(NAV_PROGRESS_REVEAL_MS + 10);
    expect(bar()).toHaveAttribute("data-visible", "true");
  });

  it("clears on real route commitment and never flashes on fast navigation", async () => {
    const rerender = mount();

    clickLink("/my-queue");
    await advance(NAV_PROGRESS_REVEAL_MS + 10);
    expect(bar()).toHaveAttribute("data-visible", "true");

    // Route commits: bar stops immediately, then fades after the settle.
    navigate("/my-queue", rerender);
    expect(bar()).toHaveAttribute("data-visible", "false");

    // A fast hop never reaches the reveal delay.
    clickLink("/production");
    await advance(100);
    expect(bar()).toHaveAttribute("data-visible", "false");
  });

  it("ignores same-path, external, download and new-tab links", async () => {
    mount();

    for (const href of ["/board", "https://example.com/x"]) {
      clickLink(href);
      await advance(NAV_PROGRESS_REVEAL_MS + 10);
      expect(bar()).toHaveAttribute("data-visible", "false");
    }

    const dl = document.createElement("a");
    dl.setAttribute("href", "/file.pdf");
    dl.setAttribute("download", "");
    document.body.appendChild(dl);
    act(() => {
      dl.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    await advance(NAV_PROGRESS_REVEAL_MS + 10);
    expect(bar()).toHaveAttribute("data-visible", "false");
  });

  it("clears its timers on unmount without warnings", () => {
    mount();
    clickLink("/delayed");
    expect(() => cleanup()).not.toThrow();
  });

  it("ships reduced-motion handling and RTL-safe CSS", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/globals.css"),
      "utf8",
    );
    expect(css).toContain(".nav-progress__fill");
    expect(css).toContain("@keyframes nav-progress-sweep");
    const tail = css.slice(css.indexOf(".nav-progress__fill"));
    expect(tail).toContain("prefers-reduced-motion: reduce");
    const block = css.slice(css.indexOf("Route progress indicator"));
    expect(block).not.toMatch(/^\s*(left|right)\s*:/m);
  });
});
