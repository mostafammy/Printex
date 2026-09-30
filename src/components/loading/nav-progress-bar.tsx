// NavProgressBar — 092-performance T010 (spec FR-004, NB-003).
//
// A thin, top-edge progress indicator for authenticated navigation. It
// appears once a navigation starts and stays until the streamed CONTENT has
// replaced the loading skeletons — not merely until the route commits.
// Committing only swaps in `loading.tsx`; the page keeps streaming behind it,
// so a bar that stops at commit reports progress while the user still stares
// at a skeleton.
//
// One armed → committed → released cycle per navigation (single state
// machine, deliberately): an earlier version hid the bar as soon as it saw
// a content-free DOM during the pre-commit window, then brought it back when
// the loading boundary mounted — a visible "launch" twice per click.
//
//   armed      same-origin left click on a link to a different path
//              (the App Router exposes no nav-start signal in Next 15; the
//              click only arms timers — nothing is shown, nothing is
//              interactive)
//   committed  usePathname changed after the click
//   released   content has been skeleton-free for the quiet window
//
// Never blocks: `pointer-events: none`, `aria-hidden`, top edge only, 4px.
// It is feedback, never an input gate — the hard rule the old overlay broke.
// The sweep is disabled under `prefers-reduced-motion`.

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** Content must still be missing this long after a nav starts to draw. */
export const NAV_PROGRESS_REVEAL_MS = 300;
/** Content must stay skeleton-free this long before the bar releases. */
export const CONTENT_QUIET_MS = 250;
/** Safety net: release a bar whose navigation never committed or aborted. */
export const NAV_PROGRESS_MAX_MS = 12000;

/** The `(shell)` loading boundary, plus every shimmer panel fallback. */
const LOADING_SELECTOR = '[data-testid="shell-loading"], [data-slot="skeleton"]';

function contentSettled(): boolean {
  return document.querySelector(LOADING_SELECTOR) === null;
}

export function NavProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const armed = useRef(false);
  const committed = useRef(false);
  const mounted = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  };

  const show = () => setVisible(true);

  const release = () => {
    armed.current = false;
    committed.current = false;
    clearTimers();
    setVisible(false);
  };

  // ── Navigation start ────────────────────────────────────────────────────
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

      clearTimers();
      armed.current = true;
      committed.current = false;

      revealTimer.current = setTimeout(() => {
        revealTimer.current = null;
        if (armed.current) show();
      }, NAV_PROGRESS_REVEAL_MS);

      // A navigation that never commits (aborted link, download handled by
      // the browser) must not leave the bar stuck on screen.
      safetyTimer.current = setTimeout(() => {
        safetyTimer.current = null;
        if (armed.current) release();
      }, NAV_PROGRESS_MAX_MS);
    };

    document.addEventListener("click", onActivate, true);
    return () => {
      document.removeEventListener("click", onActivate, true);
      clearTimers();
    };
  }, [pathname]);

  // ── Route committed: the page is still streaming behind its skeletons ───
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!armed.current) return; // not a navigation this bar started

    committed.current = true;
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    // Content is still missing (or already showing): hold the bar up. If the
    // content already landed within the reveal window, stay hidden.
    if (!contentSettled()) show();
  }, [pathname]);

  // ── Hold while anything is still loading, release once it is not ───────
  useEffect(() => {
    if (!visible) return;

    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        quietTimer = null;
        // Still navigating: the loading boundary has not mounted yet, so the
        // DOM legitimately looks content-free. Keep the bar up.
        if (!committed.current) return;
        if (contentSettled()) release();
      }, CONTENT_QUIET_MS);
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    check();

    return () => {
      observer.disconnect();
      if (quietTimer) clearTimeout(quietTimer);
    };
  }, [visible, pathname]);

  return (
    <div
      aria-hidden="true"
      data-testid="nav-progress"
      data-visible={visible ? "true" : "false"}
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[9999] h-1 overflow-hidden"
    >
      {visible && <div className="nav-progress__fill h-full w-full" />}
    </div>
  );
}