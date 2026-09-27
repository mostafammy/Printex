"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingExperience } from "./loading-experience";

export interface AppBootLoaderProps {
  children: React.ReactNode;
}

/**
 * Safety net for a same-tab click whose navigation never lands (e.g. the
 * pathname doesn't actually change, or the request is aborted) so the
 * overlay can't get stuck showing forever.
 */
const NAV_FALLBACK_TIMEOUT_MS = 4000;

/**
 * AppBootLoader wraps the root application shell. It drives `isLoading` from
 * two real signals rather than one instant one:
 * - the initial boot moment (`isBooting`, true until just after first paint)
 * - in-flight client-side route navigations (`isNavigating`), detected from a
 *   pointerdown on an internal same-tab link and cleared once `usePathname()`
 *   reports the new route has actually committed.
 * Children always render immediately underneath the overlay.
 */
export function AppBootLoader({ children }: AppBootLoaderProps) {
  const [isBooting, setIsBooting] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  const rafIdRef = useRef<number | null>(null);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    // Double requestAnimationFrame ensures boot flip fires right after first paint
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

  // The route actually committed: clear any in-flight navigation state.
  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      previousPathnameRef.current = pathname;
      setIsNavigating(false);
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
    }
  }, [pathname]);

  // Anticipate navigation start from pointerdown (fires before click/routing),
  // ignoring anything that won't navigate the current tab to a new route.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === previousPathnameRef.current) return;

      setIsNavigating(true);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        navTimeoutRef.current = null;
        setIsNavigating(false);
      }, NAV_FALLBACK_TIMEOUT_MS);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {children}
      <LoadingExperience isLoading={isBooting || isNavigating} />
    </>
  );
}
