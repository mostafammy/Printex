"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingExperience } from "./loading-experience";

export interface AppBootLoaderProps {
  children: React.ReactNode;
}

/**
 * AppBootLoader wraps the root application shell and drives the loading
 * experience from the INITIAL BOOT MOMENT ONLY (092-performance FR-001,
 * FR-002, FR-003; spec Clarifications 2026-09-29 Option A): `isBooting`
 * stays true until just after first paint (double requestAnimationFrame),
 * then the overlay runs its full reveal/exit once and never again.
 *
 * Client-side navigation no longer arms any overlay — there is no
 * pointerdown listener, no navigation state, and no post-render
 * minimum-visible hold on route changes. Soft navigations surface through
 * the `(shell)` loading boundary instead (FR-005), so nothing opaque ever
 * blocks input after a click. Children always render immediately
 * underneath.
 */
export function AppBootLoader({ children }: AppBootLoaderProps) {
  const [isBooting, setIsBooting] = useState(true);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Double requestAnimationFrame ensures the boot flip fires right after
    // first paint.
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = requestAnimationFrame(() => {
        setIsBooting(false);
      });
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <>
      {children}
      <LoadingExperience isLoading={isBooting} />
    </>
  );
}
