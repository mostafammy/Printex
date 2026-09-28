"use client";

/**
 * useBoardSelector subscribing to BoardStore topics via useSyncExternalStore.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R1, R8, plan.md S1)
 */

import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import type { BoardStore } from "~/lib/board/store/BoardStore";
import { BoardContext } from "./useBoardController";

/**
 * Reads a derived value off the store.
 *
 * Falls back to `fallback` when no BoardProvider is mounted, so a component
 * that can render standalone (a ticket in a test asserting its anatomy) does
 * not need the whole provider wrapped around it just to read one number. The
 * early return before the store hooks is safe because a mounted provider never
 * unmounts for a component's lifetime, so hook order is stable either way.
 */
export function useBoardSelector<T>(
  topic: string,
  selector: (store: BoardStore) => T,
  fallback: T,
): T {
  const controller = useContext(BoardContext);
  const store = controller?.store;

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const cacheRef = useRef<{ value: T; initialized: boolean }>({
    value: undefined as unknown as T,
    initialized: false,
  });

  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const getSnapshot = useCallback(() => {
    if (!store) return fallbackRef.current;
    const nextVal = selectorRef.current(store);
    if (!cacheRef.current.initialized || !Object.is(nextVal, cacheRef.current.value)) {
      cacheRef.current = { value: nextVal, initialized: true };
    }
    return cacheRef.current.value;
  }, [store]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => (store ? store.subscribe(topic, onStoreChange) : () => {}),
    [store, topic],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
