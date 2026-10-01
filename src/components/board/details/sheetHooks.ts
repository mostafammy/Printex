"use client";

/**
 * Custom hooks and helpers for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkItemFullDetail } from "~/lib/board/types";
import { STATE_PLACEMENT } from "~/lib/board/stations";

export async function defaultFetchDetail(
  workItemId: string,
): Promise<WorkItemFullDetail | null> {
  const { getWorkItemDetailAction } =
    await import("~/app/(shell)/board/actions");
  return getWorkItemDetailAction(workItemId);
}

interface InitialLoadArgs {
  readonly cardId: string | undefined;
  readonly isOpen: boolean;
  readonly fetchDetail: (id: string) => Promise<WorkItemFullDetail | null>;
  readonly setDetail: (detail: WorkItemFullDetail | null) => void;
  readonly setLoading: (loading: boolean) => void;
  /** True once the effect that started this load has been cleaned up. */
  readonly isStale: () => boolean;
}

async function loadDetail(args: InitialLoadArgs): Promise<void> {
  const { cardId, isOpen, fetchDetail, setDetail, setLoading, isStale } = args;
  if (!isOpen || !cardId) {
    setDetail(null);
    return;
  }

  setLoading(true);
  try {
    const data = await fetchDetail(cardId);
    if (!isStale()) {
      setDetail(data);
      setLoading(false);
    }
  } catch (err) {
    console.error("Failed to load work item details", err);
    if (!isStale()) setLoading(false);
  }
}

export function useWorkItemDetail(
  cardId: string | undefined,
  isOpen: boolean,
  fetchDetail: (id: string) => Promise<WorkItemFullDetail | null>,
) {
  const [detail, setDetail] = useState<WorkItemFullDetail | null>(null);
  const [loading, setLoading] = useState(false);
  // `refresh()` outlives the effect below, so it needs its own liveness flag
  // rather than the closure-scoped one the initial load uses.
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadDetail({
      cardId,
      isOpen,
      fetchDetail,
      setDetail,
      setLoading,
      isStale: () => cancelled || !mountedRef.current,
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, cardId, fetchDetail, setDetail, setLoading]);

  /**
   * Re-reads the detail WITHOUT flipping `loading`.
   *
   * This is what a mutation inside the sheet calls after it succeeds. Raising the
   * loading flag would blank the whole tab body to "جاري تحميل الملفات..." for one
   * round trip, which reads as "the upload broke something" right after it
   * worked. Refreshing in place is also the only way the freshly uploaded file
   * appears where the user is already looking.
   */
  const refresh = useCallback(async () => {
    if (!cardId) return;
    try {
      const data = await fetchDetail(cardId);
      if (mountedRef.current) setDetail(data);
    } catch (err) {
      console.error("Failed to refresh work item details", err);
    }
  }, [cardId, fetchDetail]);

  return { detail, loading, refresh };
}

export function useEscapeKey(
  isOpen: boolean,
  onClose: () => void | Promise<void>,
) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);
}

const STATION_HREF_BUILDERS: Partial<Record<string, (cardId: string) => string>> = {
  design: (id) => `/design/${id}`,
  review: (id) => `/review/${id}`,
  production: (id) => `/production/${id}`,
  pricing: () => "/pricing",
  reception: () => "/reception",
  collection: () => "/reception",
  delivered: () => "/reception",
};

export function getStationHref(cardId: string, state: string): string | null {
  const placement = STATE_PLACEMENT[state as keyof typeof STATE_PLACEMENT];
  const stationKey = placement === "OFF_BOARD" ? "reception" : placement?.station;
  const buildHref = stationKey ? STATION_HREF_BUILDERS[stationKey] : undefined;
  return buildHref ? buildHref(cardId) : null;
}
