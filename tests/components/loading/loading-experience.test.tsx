/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "~/messages/ar.json";
import {
  AppBootLoader,
  AWAKENING_MS,
  COMPLETE_MS,
  LoadingExperience,
  MIN_VISIBLE_MS,
  SHOW_DELAY_MS,
} from "~/components/loading";

const pathnameMock = vi.fn(() => "/queue");

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
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

describe("LoadingExperience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fast path: does not render role=status if isLoading becomes false before SHOW_DELAY_MS", () => {
    const { rerender } = render(<LoadingExperience isLoading={true} />);

    // Fast load: isLoading flips to false at 100ms (< 180ms SHOW_DELAY_MS)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole("status")).toBeNull();

    rerender(<LoadingExperience isLoading={false} />);

    // Advance further past SHOW_DELAY_MS and beyond
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Must never render visible/role="status" content
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("normal path: renders role=status with polite aria-live and sr-only label when isLoading exceeds SHOW_DELAY_MS", () => {
    render(<LoadingExperience isLoading={true} />);

    // Before SHOW_DELAY_MS: nothing shown
    expect(screen.queryByRole("status")).toBeNull();

    // Advance past SHOW_DELAY_MS
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveAttribute("aria-live", "polite");
    expect(statusElement).toHaveAttribute("data-phase", "awakening");
    expect(statusElement).toHaveTextContent(ar.ui.loading);

    // After AWAKENING_MS: advances to processing
    act(() => {
      vi.advanceTimersByTime(AWAKENING_MS);
    });
    expect(statusElement).toHaveAttribute("data-phase", "processing");
  });

  it("completes with MIN_VISIBLE_MS and COMPLETE_MS before unmounting cleanly", () => {
    const { rerender } = render(<LoadingExperience isLoading={true} />);

    // Advance past SHOW_DELAY_MS into awakening and processing
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS + AWAKENING_MS);
    });
    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();

    // Now isLoading becomes false after AWAKENING_MS (260ms of visibility < MIN_VISIBLE_MS 500ms)
    rerender(<LoadingExperience isLoading={false} />);

    // Advance by 100ms (visible for 360ms < 500ms): still processing, not yet completing
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-phase",
      "processing",
    );

    // Advance remaining visible time to reach MIN_VISIBLE_MS (500 - 360 = 140ms)
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-phase",
      "completing",
    );

    // Advance through COMPLETE_MS (620ms): finishes exit transition and unmounts
    act(() => {
      vi.advanceTimersByTime(COMPLETE_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("cleans up all timers on unmount without errors or warnings while isLoading is true", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { unmount } = render(<LoadingExperience isLoading={true} />);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(() => {
      unmount();
    }).not.toThrow();

    // Advance any pending timers into the future
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("respects prefers-reduced-motion: reduce by setting reduced motion attribute", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<LoadingExperience isLoading={true} />);

    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    const statusElement = screen.getByRole("status");
    expect(statusElement).toHaveAttribute("data-reduced-motion", "true");
  });

  it("AppBootLoader renders children immediately underneath the overlay", () => {
    render(
      <AppBootLoader>
        <div data-testid="app-content">محتوى التطبيق</div>
      </AppBootLoader>,
    );

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
  });
});

// Real timers: these exercise AppBootLoader's boot rAF + navigation-detection
// logic end to end, which fake timers cannot reliably drive (rAF scheduling).
describe("AppBootLoader route navigation", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/queue");
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the loader for a same-tab internal navigation and hides it once the route commits", async () => {
    const { rerender } = render(
      <AppBootLoader>
        <a href="/orders">Orders</a>
      </AppBootLoader>,
    );

    await flushBootRaf();
    await wait(
      SHOW_DELAY_MS + AWAKENING_MS + MIN_VISIBLE_MS + COMPLETE_MS + 50,
    );
    expect(screen.queryByRole("status")).toBeNull();

    const link = screen.getByText("Orders");
    await act(async () => {
      link.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
    });

    await wait(SHOW_DELAY_MS + 20);
    expect(screen.getByRole("status")).toBeInTheDocument();

    // The route commits: usePathname now reports the destination.
    pathnameMock.mockReturnValue("/orders");
    rerender(
      <AppBootLoader>
        <a href="/orders">Orders</a>
      </AppBootLoader>,
    );

    await wait(MIN_VISIBLE_MS + COMPLETE_MS + 50);
    expect(screen.queryByRole("status")).toBeNull();
  }, 10000);

  it("ignores modifier-key clicks, new-tab, download, and external links", async () => {
    render(
      <AppBootLoader>
        <a href="/orders" target="_blank" rel="noreferrer">
          New tab
        </a>
        <a href="https://example.com">External</a>
        <a href="/file.pdf" download>
          Download
        </a>
      </AppBootLoader>,
    );

    await flushBootRaf();
    await wait(
      SHOW_DELAY_MS + AWAKENING_MS + MIN_VISIBLE_MS + COMPLETE_MS + 50,
    );
    expect(screen.queryByRole("status")).toBeNull();

    for (const text of ["New tab", "External", "Download"]) {
      const link = screen.getByText(text);
      await act(async () => {
        link.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
        );
      });
    }

    await wait(SHOW_DELAY_MS + 20);
    expect(screen.queryByRole("status")).toBeNull();
  }, 10000);
});
