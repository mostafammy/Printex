"use client";

/**
 * useFreshIds: tracks card ids that arrived after first paint so newly
 * appended lane chunks can play a one-time entrance animation. Scroll
 * remounts never replay it.
 */

import { useEffect, useRef, useState } from "react";

const NO_FRESH: readonly string[] = [];

export function useFreshIds(cardIds: readonly string[]): readonly string[] {
  const seenRef = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<readonly string[]>(NO_FRESH);

  useEffect(() => {
    if (!seenRef.current) {
      seenRef.current = new Set(cardIds);
      return;
    }
    const prev = seenRef.current;
    seenRef.current = new Set(cardIds);
    const unseen = cardIds.filter((id) => !prev.has(id));
    if (unseen.length === 0) return;
    setFresh(unseen.slice(0, 24));
    const timer = setTimeout(() => setFresh(NO_FRESH), 700);
    return () => clearTimeout(timer);
  }, [cardIds]);

  return fresh;
}
