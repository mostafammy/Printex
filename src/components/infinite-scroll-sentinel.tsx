"use client";

/**
 * InfiniteScrollSentinel — IntersectionObserver-based load trigger.
 *
 * Design decisions to prevent the "fires immediately / fires repeatedly" bugs:
 * 1. Uses a `useRef` loading flag (not state) so the observer callback always
 *    sees the current value without re-subscribing on every state change.
 * 2. The observer is set up once (deps: [hasMore]) and torn down only when
 *    `hasMore` changes — not on every render.
 * 3. `rootMargin: "0px"` — sentinel must actually intersect the viewport,
 *    not just be within 250px of it (that caused immediate firing on page load).
 * 4. A stable `onLoadMore` ref is captured so the callback never goes stale.
 */

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

export interface InfiniteScrollSentinelProps {
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly onLoadMore: () => void;
  readonly endMessage?: string;
}

export function InfiniteScrollSentinel({
  hasMore,
  isLoading,
  onLoadMore,
  endMessage,
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Keep a stable ref to the callback — avoids tearing down the observer
  // every render when `onLoadMore` is a new inline/callback function.
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  // Track whether a fetch is in-flight — a ref, not state, so the observer
  // callback reads the live value without needing to re-subscribe.
  const fetchingRef = useRef(false);
  fetchingRef.current = isLoading;

  useEffect(() => {
    if (!hasMore) return;
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Guard: only fire when truly intersecting AND no fetch in-flight.
        if (entries[0]?.isIntersecting && !fetchingRef.current) {
          fetchingRef.current = true; // pessimistic lock until state update arrives
          onLoadMoreRef.current();
        }
      },
      // rootMargin "0px" — sentinel must actually enter the viewport,
      // not just be nearby (prevents immediate firing on page load).
      { rootMargin: "0px", threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
    // Only re-subscribe when `hasMore` changes (e.g. false → true impossible,
    // but true → false stops observing naturally when sentinel unmounts).
  }, [hasMore]);

  if (!hasMore) {
    if (!endMessage) return null;
    return (
      <div className="py-4 text-center text-xs text-muted-foreground select-none" aria-live="polite">
        {endMessage}
      </div>
    );
  }

  return (
    <div ref={sentinelRef} className="flex items-center justify-center py-6" aria-hidden="true">
      {isLoading && (
        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>جارٍ تحميل المزيد...</span>
        </div>
      )}
    </div>
  );
}
