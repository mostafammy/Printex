// NavProgressBar — 092-performance T010 (spec FR-004, NB-003).
//
// A thin, top-edge progress indicator for authenticated navigation: when a
// navigation starts, a glint sweeps the top edge; when the route commits it
// stops. It answers the one question the removed overlay answered ("is my
// click going somewhere?") without ever covering content or blocking input.
//
// Design constraints (spec FR-004, NB-003):
//   - `position: fixed`, top edge, ~2px tall — never full-screen.
//   - `pointer-events: none` — input always passes through; the bar can never
//     gate a click, keyboard, or scroll (this is the hard safety rule; the
//     start signal below is decoration only).
//   - Reveal delay (400 ms): a navigation that commits faster than that
//     never draws anything, so instant hops do not flicker. Any navigation
//     slow enough to be noticed by a user shows the bar.
//   - Cleared on ACTUAL route commitment (`usePathname`), never left hanging
//     if a navigation is aborted or redirects back.
//   - `aria-hidden` — decorative feedback, not state (SR-003: no live
//     region, no focus moves).
//   - Sweep animation disabled under `prefers-reduced-motion` (globals.css).
//
// Start signal: a capture-phase click listener on same-origin left-clicks.
// The App Router exposes no global navigation-start signal in Next 15, and
// `useLinkStatus` is per-Link. A click capture is used instead of the
// pointerdown *arming* T004 removed for one reason: nothing is armed that can
// block or delay anything — the overlay, the min-visible hold, and the exit
// animation are all gone. This only starts a 2 s timer.

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A navigation that commits faster than this never draws the bar. Short
 * enough that any noticeably slow navigation shows it (LAN round-trips are
 * ~1 ms; the remote dev pooler and cold compiles are hundreds of ms), long
 * enough that an instant hop does not flicker.
 */
export const NAV_PROGRESS_REVEAL_MS = 400;
/** How long the sweep lingers after the route commits. */
export const NAV_PROGRESS_SETTLE_MS = 400;

export function NavProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const mounted = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReveal = () => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  };

  // The route committed (or the first render happened): stop showing.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    clearReveal();
    setVisible(false);
  }, [pathname]);

  // Navigation start: same-origin left click on a link that leaves the
  // current path. Starts the reveal timer only — nothing is shown yet, and
  // nothing can be interacted with.
  useEffect(() => {
    const onActivate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
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
      if (url.pathname === pathname) return;

      clearReveal();
      revealTimer.current = setTimeout(() => {
        revealTimer.current = null;
        setVisible(true);
      }, NAV_PROGRESS_REVEAL_MS);
    };

    document.addEventListener("click", onActivate, true);
    return () => {
      document.removeEventListener("click", onActivate, true);
      clearReveal();
    };
  }, [pathname]);

  // The sweep fades out shortly after the new route paints.
  useEffect(() => {
    if (!visible) return;
    const settle = setTimeout(() => setVisible(false), NAV_PROGRESS_SETTLE_MS);
    return () => clearTimeout(settle);
  }, [visible]);

  return (
    <div
      aria-hidden="true"
      data-testid="nav-progress"
      data-visible={visible ? "true" : "false"}
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[9999] h-2 overflow-hidden"
    >
      {visible && <div className="nav-progress__fill h-full w-full" />}
    </div>
  );
}
