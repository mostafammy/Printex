"use client";

import { useEffect, useRef, useState } from "react";
import ar from "~/messages/ar.json";
import {
  AWAKENING_MS,
  COMPLETE_MS,
  MIN_VISIBLE_MS,
  SHOW_DELAY_MS,
} from "./loading-config";
import { LoadingGeometry, type LoadingPhase } from "./loading-geometry";

export interface LoadingExperienceProps {
  isLoading: boolean;
}

/**
 * Self-contained app boot and loading experience with a 4-state phase machine:
 * 'hidden' -> 'awakening' -> 'processing' -> 'completing'.
 *
 * Honors fast paths (<180ms produces no visual flash), enforces minimum visible
 * duration (>=500ms) to prevent visual flicker, coordinates smooth exit/convergence
 * transitions (620ms), and respects prefers-reduced-motion.
 */
export function LoadingExperience({ isLoading }: LoadingExperienceProps) {
  // Always starts 'hidden' on initial render, ensuring identical server and client initial markup
  const [phase, setPhase] = useState<LoadingPhase>("hidden");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const phaseRef = useRef<LoadingPhase>("hidden");
  const visibleStartTimeRef = useRef<number | null>(null);

  const showDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awakeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minVisibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transitionTo = (nextPhase: LoadingPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  // Check and listen for prefers-reduced-motion preferences
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  // Drive phase transitions according to isLoading prop
  useEffect(() => {
    if (isLoading) {
      // Clear pending exit timers in case loading was re-triggered
      if (minVisibleTimerRef.current) {
        clearTimeout(minVisibleTimerRef.current);
        minVisibleTimerRef.current = null;
      }
      if (completeTimerRef.current) {
        clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }

      // If already active in awakening or processing, continue running
      if (
        phaseRef.current === "awakening" ||
        phaseRef.current === "processing"
      ) {
        return;
      }

      // If was completing, restore to processing immediately
      if (phaseRef.current === "completing") {
        transitionTo("processing");
        return;
      }

      // Currently 'hidden': wait SHOW_DELAY_MS before revealing
      if (phaseRef.current === "hidden" && !showDelayTimerRef.current) {
        showDelayTimerRef.current = setTimeout(() => {
          showDelayTimerRef.current = null;
          visibleStartTimeRef.current = Date.now();
          transitionTo("awakening");

          awakeningTimerRef.current = setTimeout(() => {
            awakeningTimerRef.current = null;
            transitionTo("processing");
          }, AWAKENING_MS);
        }, SHOW_DELAY_MS);
      }
    } else {
      // isLoading is false
      // Fast path: if still hidden, cancel show delay timer and stay hidden
      if (phaseRef.current === "hidden") {
        if (showDelayTimerRef.current) {
          clearTimeout(showDelayTimerRef.current);
          showDelayTimerRef.current = null;
        }
        visibleStartTimeRef.current = null;
        return;
      }

      // If already completing, let the exit transition finish
      if (phaseRef.current === "completing") {
        return;
      }

      // If currently awakening, allow awakening to finish before or during the visible window
      const now = Date.now();
      const startTime = visibleStartTimeRef.current ?? now;
      const elapsed = now - startTime;
      const remainingVisible = Math.max(0, MIN_VISIBLE_MS - elapsed);

      if (phaseRef.current === "awakening" && !awakeningTimerRef.current) {
        const remainingAwakening = Math.max(0, AWAKENING_MS - elapsed);
        awakeningTimerRef.current = setTimeout(() => {
          awakeningTimerRef.current = null;
          transitionTo("processing");
        }, remainingAwakening);
      }

      minVisibleTimerRef.current = setTimeout(() => {
        minVisibleTimerRef.current = null;

        if (awakeningTimerRef.current) {
          clearTimeout(awakeningTimerRef.current);
          awakeningTimerRef.current = null;
        }

        transitionTo("completing");

        completeTimerRef.current = setTimeout(() => {
          completeTimerRef.current = null;
          visibleStartTimeRef.current = null;
          transitionTo("hidden");
        }, COMPLETE_MS);
      }, remainingVisible);
    }

    return () => {
      if (showDelayTimerRef.current) {
        clearTimeout(showDelayTimerRef.current);
        showDelayTimerRef.current = null;
      }
      if (awakeningTimerRef.current) {
        clearTimeout(awakeningTimerRef.current);
        awakeningTimerRef.current = null;
      }
      if (minVisibleTimerRef.current) {
        clearTimeout(minVisibleTimerRef.current);
        minVisibleTimerRef.current = null;
      }
      if (completeTimerRef.current) {
        clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
    };
  }, [isLoading]);

  // When hidden, completely unmount so no DOM node lingers or intercepts events
  if (phase === "hidden") {
    return null;
  }

  const phaseClass =
    phase === "awakening"
      ? "loading-container--awakening"
      : phase === "completing"
        ? "loading-container--completing"
        : "loading-container--processing";

  return (
    <div
      role="status"
      aria-live="polite"
      data-phase={phase}
      data-reduced-motion={prefersReducedMotion ? "true" : undefined}
      className={`loading-container ${phaseClass} ${
        prefersReducedMotion ? "loading-container--reduced-motion" : ""
      }`}
    >
      <span className="sr-only">{ar.ui.loading}</span>
      <LoadingGeometry phase={phase} reducedMotion={prefersReducedMotion} />
    </div>
  );
}
