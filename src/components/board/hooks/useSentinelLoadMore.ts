"use client";

/**
 * useSentinelLoadMore: IntersectionObserver sentinel that fires one callback
 * each time the user reaches a lane's end. Internal guard prevents overlap;
 * the loader itself no-ops exhausted lanes.
 */

import { useEffect, useRef } from "react";

export function useSentinelLoadMore(
  parentRef: React.RefObject<HTMLDivElement | null>,
  sentinelRef: React.RefObject<HTMLDivElement | null>,
  onReachEnd: () => Promise<void>,
): void {
  const callbackRef = useRef(onReachEnd);
  callbackRef.current = onReachEnd;
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const root = parentRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (!visible || isFetchingRef.current) return;
        isFetchingRef.current = true;
        // One lane chunk per intersection; the loader no-ops exhausted lanes.
        void callbackRef.current().finally(() => {
          isFetchingRef.current = false;
        });
      },
      { root, rootMargin: "100px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [parentRef, sentinelRef]);
}
