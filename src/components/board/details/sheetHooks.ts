"use client";

/**
 * Custom hooks and helpers for WorkItemDetailsSheet.
 * (specs/017-press-floor-board)
 */

import { useEffect, useState } from "react";
import type { WorkItemFullDetail } from "~/lib/board/types";
import { STATE_PLACEMENT } from "~/lib/board/stations";

export async function defaultFetchDetail(workItemId: string): Promise<WorkItemFullDetail | null> {
  const { getWorkItemDetailAction } = await import("~/app/(shell)/board/actions");
  return getWorkItemDetailAction(workItemId);
}

export function useWorkItemDetail(
  cardId: string | undefined,
  isOpen: boolean,
  fetchDetail: (id: string) => Promise<WorkItemFullDetail | null>,
) {
  const [detail, setDetail] = useState<WorkItemFullDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !cardId) {
      setDetail(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    fetchDetail(cardId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load work item details", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, cardId, fetchDetail]);

  return { detail, loading };
}

export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);
}

export function getStationHref(cardId: string, state: string): string | null {
  const placement = STATE_PLACEMENT[state as keyof typeof STATE_PLACEMENT];
  const stationKey = placement === "OFF_BOARD" ? "reception" : placement?.station;
  if (stationKey === "design") return `/design/${cardId}`;
  if (stationKey === "review") return `/review/${cardId}`;
  if (stationKey === "production") return `/production/${cardId}`;
  return null;
}
