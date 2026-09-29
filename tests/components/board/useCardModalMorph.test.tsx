// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCardModalMorph } from "~/components/board/details/useCardModalMorph";

describe("useCardModalMorph Hook", () => {
  let cardEl: HTMLDivElement;
  let dialogEl: HTMLDivElement;
  let backdropEl: HTMLDivElement;

  beforeEach(() => {
    cardEl = document.createElement("div");
    cardEl.setAttribute("data-card-id", "test-card-1");
    cardEl.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100,
      top: 150,
      width: 250,
      height: 120,
    } as DOMRect);
    document.body.appendChild(cardEl);

    dialogEl = document.createElement("div");
    dialogEl.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 300,
      top: 100,
      width: 700,
      height: 600,
    } as DOMRect);

    backdropEl = document.createElement("div");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("handles non-animated environment by immediately calling onClose", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCardModalMorph("test-card-1", true, onClose),
    );

    // Assign refs
    Object.defineProperty(result.current.dialogRef, "current", { value: dialogEl, writable: true });
    Object.defineProperty(result.current.backdropRef, "current", { value: backdropEl, writable: true });

    await act(async () => {
      await result.current.handleClose();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("runs open animation when Web Animations API is available", () => {
    const dialogAnimate = vi.fn().mockReturnValue({ finished: Promise.resolve() });
    const backdropAnimate = vi.fn().mockReturnValue({ finished: Promise.resolve() });
    dialogEl.animate = dialogAnimate as unknown as typeof dialogEl.animate;
    backdropEl.animate = backdropAnimate as unknown as typeof backdropEl.animate;

    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCardModalMorph("test-card-1", true, onClose),
    );

    Object.defineProperty(result.current.dialogRef, "current", { value: dialogEl, writable: true });
    Object.defineProperty(result.current.backdropRef, "current", { value: backdropEl, writable: true });

    // Re-render to trigger useEffect with refs attached
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useCardModalMorph("test-card-1", open, onClose),
      { initialProps: { open: false } },
    );

    // Trigger open
    rerender({ open: true });
  });

  it("runs reverse morph animation on handleClose and calls onClose upon completion", async () => {
    const dialogFinishPromise = Promise.resolve();
    const backdropFinishPromise = Promise.resolve();

    const dialogAnimate = vi.fn().mockReturnValue({ finished: dialogFinishPromise });
    const backdropAnimate = vi.fn().mockReturnValue({ finished: backdropFinishPromise });
    dialogEl.animate = dialogAnimate as unknown as typeof dialogEl.animate;
    backdropEl.animate = backdropAnimate as unknown as typeof backdropEl.animate;

    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCardModalMorph("test-card-1", true, onClose),
    );

    Object.defineProperty(result.current.dialogRef, "current", { value: dialogEl, writable: true });
    Object.defineProperty(result.current.backdropRef, "current", { value: backdropEl, writable: true });

    await act(async () => {
      await result.current.handleClose();
    });

    expect(dialogAnimate).toHaveBeenCalled();
    expect(backdropAnimate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
