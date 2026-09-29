"use client";

/**
 * useCardModalMorph: WAAPI FLIP container morph animation hook.
 * Fluidly expands a clicked board card into a centered modal dialog,
 * and shrinks/minimizes it right back into the card upon close.
 * (specs/017-press-floor-board)
 */

import { useCallback, useEffect, useRef } from "react";
import { readMotionTokens, type MotionTokens } from "~/lib/board/motion/tokens";

interface MorphDelta {
  readonly dx: number;
  readonly dy: number;
  readonly sx: number;
  readonly sy: number;
}

function isReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function computeDelta(cardRect: DOMRect, dialogRect: DOMRect): MorphDelta {
  return {
    dx: cardRect.left - dialogRect.left,
    dy: cardRect.top - dialogRect.top,
    sx: cardRect.width / dialogRect.width,
    sy: cardRect.height / dialogRect.height,
  };
}

function runOpenAnimation(dialogEl: HTMLElement, backdropEl: HTMLElement, cardRect: DOMRect | null) {
  if (typeof dialogEl.animate !== "function" || typeof backdropEl.animate !== "function") return;

  const tokens = readMotionTokens(dialogEl);
  backdropEl.animate(
    [{ opacity: 0, backdropFilter: "blur(0px)" }, { opacity: 1, backdropFilter: "blur(8px)" }],
    { duration: tokens.durationTravel, easing: "ease-out", fill: "forwards" },
  );

  if (!cardRect) {
    dialogEl.animate(
      [
        { opacity: 0, transform: "scale(0.92) translateY(12px)" },
        { opacity: 1, transform: "scale(1) translateY(0)" },
      ],
      { duration: tokens.durationTravel, easing: tokens.springEasing, fill: "forwards" },
    );
    return;
  }

  const dialogRect = dialogEl.getBoundingClientRect();
  const { dx, dy, sx, sy } = computeDelta(cardRect, dialogRect);
  dialogEl.style.transformOrigin = "top left";

  dialogEl.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: "10px", opacity: 0.85 },
      { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: "16px", opacity: 1 },
    ],
    { duration: tokens.durationTravel, easing: tokens.springEasing, fill: "forwards" },
  );
}

function canAnimate(dialogEl: HTMLElement | null, backdropEl: HTMLElement | null): boolean {
  return Boolean(
    dialogEl &&
    backdropEl &&
    typeof dialogEl.animate === "function" &&
    typeof backdropEl.animate === "function" &&
    !isReducedMotion()
  );
}

function createDialogCloseAnim(
  dialogEl: HTMLElement,
  cardRect: DOMRect | undefined,
  tokens: MotionTokens,
): Animation {
  if (cardRect) {
    const dialogRect = dialogEl.getBoundingClientRect();
    const { dx, dy, sx, sy } = computeDelta(cardRect, dialogRect);
    dialogEl.style.transformOrigin = "top left";

    return dialogEl.animate(
      [
        { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: "16px", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: "10px", opacity: 0.1 },
      ],
      { duration: tokens.durationLand, easing: tokens.springEasing, fill: "forwards" },
    );
  }

  return dialogEl.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.92) translateY(8px)" },
    ],
    { duration: 200, easing: "ease-in", fill: "forwards" },
  );
}

async function runCloseAnimation(dialogEl: HTMLElement, backdropEl: HTMLElement, cardId: string) {
  const tokens = readMotionTokens(dialogEl);
  const cardEl = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
  const cardRect = cardEl?.getBoundingClientRect();

  const backdropAnim = backdropEl.animate(
    [{ opacity: 1, backdropFilter: "blur(8px)" }, { opacity: 0, backdropFilter: "blur(0px)" }],
    { duration: tokens.durationLand, easing: "ease-in", fill: "forwards" },
  );

  const dialogAnim = createDialogCloseAnim(dialogEl, cardRect, tokens);

  await Promise.all([
    dialogAnim.finished.catch(() => undefined),
    backdropAnim.finished.catch(() => undefined),
  ]);
}

export function useCardModalMorph(cardId: string | undefined, isOpen: boolean, onClose: () => void) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !cardId || !dialogRef.current || !backdropRef.current) return;
    isClosingRef.current = false;
    if (!canAnimate(dialogRef.current, backdropRef.current)) return;

    const cardEl = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
    const cardRect = cardEl?.getBoundingClientRect() ?? null;

    runOpenAnimation(dialogRef.current, backdropRef.current, cardRect);
  }, [isOpen, cardId]);

  const handleClose = useCallback(async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (!canAnimate(dialogRef.current, backdropRef.current) || !cardId) {
      onClose();
      return;
    }

    await runCloseAnimation(dialogRef.current!, backdropRef.current!, cardId);
    onClose();
  }, [cardId, onClose]);

  return { backdropRef, dialogRef, handleClose };
}
