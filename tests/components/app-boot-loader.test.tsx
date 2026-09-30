/** @vitest-environment jsdom */
// tests/components/app-boot-loader.test.tsx — T002 (092-performance, US1).
//
// AC-001 / FR-001..FR-003 / spec Clarifications Q1 (Option A): navigation
// NEVER arms a blocking overlay — pointerdown on an internal anchor, hash
// links, and same-path anchors produce zero loading UI — while the initial
// boot experience (FR-002) keeps working and leaves no zombie overlay.
//
// Real timers (same approach as loading-experience.test.tsx's
// "AppBootLoader route navigation" describe): the boot rAF + pointerdown
// flow cannot be driven reliably under fake timers.
//
// Tests-first: the navigation cases FAIL until T004 removes the
// pointerdown-arming path ("fails until T004" — tasks.md Phase 2).

import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppBootLoader, SHOW_DELAY_MS } from "~/components/loading";

vi.mock("next/navigation", () => ({
  usePathname: () => vi.fn(() => "/queue")(),
}));

async function flushBootRaf() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** Fires the document-level pointerdown the loader used to listen for. */
function pressInternalAnchor(href: string) {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  document.body.appendChild(anchor);
  act(() => {
    // MouseEvent, not PointerEvent — jsdom does not implement PointerEvent
    // (same pattern as loading-experience.test.tsx).
    anchor.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
  });
  anchor.remove();
}

describe("AppBootLoader navigation never blocks (092 AC-001)", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("children render immediately and boot leaves no overlay behind (FR-002)", async () => {
    render(
      <AppBootLoader>
        <div data-testid="app-content">محتوى التطبيق</div>
      </AppBootLoader>,
    );

    expect(screen.getByTestId("app-content")).toBeInTheDocument();

    await flushBootRaf();
    // Past boot + full reveal/exit window: nothing may remain on screen.
    await wait(SHOW_DELAY_MS + 1500);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("pointerdown on an internal anchor shows NO navigation overlay (AC-001, fails until T004)", async () => {
    render(
      <AppBootLoader>
        <div>child</div>
      </AppBootLoader>,
    );
    await flushBootRaf(); // boot done — any later overlay is navigation-caused
    await wait(SHOW_DELAY_MS + 1000); // let any boot reveal/exit fully settle

    pressInternalAnchor("/my-queue");
    await wait(SHOW_DELAY_MS + 20);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hash-only links never produce loading UI (NB-002, fails until T004)", async () => {
    render(
      <AppBootLoader>
        <div>child</div>
      </AppBootLoader>,
    );
    await flushBootRaf();
    await wait(SHOW_DELAY_MS + 1000);

    pressInternalAnchor("#main-content");
    await wait(SHOW_DELAY_MS + 20);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("same-path anchors (no route change) never produce loading UI (NB-002, fails until T004)", async () => {
    render(
      <AppBootLoader>
        <div>child</div>
      </AppBootLoader>,
    );
    await flushBootRaf();
    await wait(SHOW_DELAY_MS + 1000);

    pressInternalAnchor("/queue");
    await wait(SHOW_DELAY_MS + 20);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("no input-blocking layer appears after a navigation press (FR-003, fails until T004)", async () => {
    render(
      <AppBootLoader>
        <button type="button">inside</button>
      </AppBootLoader>,
    );
    await flushBootRaf();
    await wait(SHOW_DELAY_MS + 1000);

    pressInternalAnchor("/production");
    await wait(SHOW_DELAY_MS + 20);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "inside" })).toBeEnabled();
  });
});
