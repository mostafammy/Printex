"use client";

/**
 * useBoardSelector subscribing to BoardStore topics via useSyncExternalStore.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, R1, R8, plan.md S1)
 */

import { useCallback, useRef, useSyncExternalStore } from "react";
import type { BoardStore } from "~/lib/board/store/BoardStore";
import { useBoardController } from "./useBoardController";

export function useBoardSelector<T>(
  topic: string,
  selector: (store: BoardStore) => T,
): T {
  const controller = useBoardController();
  const store = controller.store;

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const cacheRef = useRef<{ value: T; initialized: boolean }>({
    value: undefined as unknown as T,
    initialized: false,
  });

  const getSnapshot = useCallback(() => {
    const nextVal = selectorRef.current(store);
    if (!cacheRef.current.initialized || !Object.is(nextVal, cacheRef.current.value)) {
      cacheRef.current = { value: nextVal, initialized: true };
    }
    return cacheRef.current.value;
  }, [store]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(topic, onStoreChange),
    [store, topic],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
