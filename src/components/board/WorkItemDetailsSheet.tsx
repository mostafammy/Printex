"use client";

/**
 * WorkItemDetailsSheet: Comprehensive details sheet/modal for a job ticket on the board.
 * Opens when a card is clicked, presenting all specifications, assigned staff,
 * production notes, files, rework history, and timeline.
 * (specs/017-press-floor-board)
 */

import React, { useEffect, useState } from "react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";
import { STATE_AR_LABELS, STATE_PLACEMENT } from "~/lib/board/stations";
import { DetailsHeader } from "./details/DetailsHeader";
import { DetailsTabBar, type DetailTabKey } from "./details/DetailsTabBar";
import { DetailsSpecsTab } from "./details/DetailsSpecsTab";
import { DetailsFilesTab } from "./details/DetailsFilesTab";
import { DetailsReworkTab } from "./details/DetailsReworkTab";
import { DetailsTimelineTab } from "./details/DetailsTimelineTab";

async function defaultFetchDetail(workItemId: string): Promise<WorkItemFullDetail | null> {
  const { getWorkItemDetailAction } = await import("~/app/(shell)/board/actions");
  return getWorkItemDetailAction(workItemId);
}

export interface WorkItemDetailsSheetProps {
  readonly card: BoardCard | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
  readonly fetchDetail?: (workItemId: string) => Promise<WorkItemFullDetail | null>;
}

function useWorkItemDetail(
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

function useEscapeKey(isOpen: boolean, onClose: () => void) {
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

function getStationHref(cardId: string, state: string): string | null {
  const placement = STATE_PLACEMENT[state as keyof typeof STATE_PLACEMENT];
  const stationKey = placement === "OFF_BOARD" ? "reception" : placement?.station;
  if (stationKey === "design") return `/design/${cardId}`;
  if (stationKey === "review") return `/review/${cardId}`;
  if (stationKey === "production") return `/production/${cardId}`;
  return null;
}

function DetailsTabContent({
  activeTab,
  card,
  detail,
  loading,
  onClose,
}: {
  readonly activeTab: DetailTabKey;
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  readonly onClose: () => void;
}) {
  if (activeTab === "files") {
    return <DetailsFilesTab card={card} detail={detail} loading={loading} />;
  }
  if (activeTab === "rework") {
    return <DetailsReworkTab detail={detail} />;
  }
  if (activeTab === "timeline") {
    return <DetailsTimelineTab detail={detail} loading={loading} />;
  }
  return <DetailsSpecsTab card={card} detail={detail} onExecuteMove={onClose} />;
}

export function WorkItemDetailsSheet({
  card,
  isOpen,
  onClose,
  onOpenMoveMenu,
  fetchDetail = defaultFetchDetail,
}: WorkItemDetailsSheetProps) {
  const { detail, loading } = useWorkItemDetail(card?.id, isOpen, fetchDetail);
  const [activeTab, setActiveTab] = useState<DetailTabKey>("specs");
  useEscapeKey(isOpen, onClose);

  if (!isOpen || !card) return null;

  const placement = STATE_PLACEMENT[card.state];
  const stationKey = placement === "OFF_BOARD" ? "reception" : placement.station;
  const stateLabel = STATE_AR_LABELS[card.state] ?? card.state;
  const stationPageHref = getStationHref(card.id, card.state);

  const reworkCount = detail?.returns.length ?? card.reworkCount;
  const showReworkTab = reworkCount > 0 || (detail?.returns.length ?? 0) > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تفاصيل بطاقة العمل #${card.orderNumber}`}
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-xs sm:p-4 md:justify-end animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex h-full max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl transition-all sm:max-h-[90vh] md:h-full md:max-h-none md:w-[600px] md:rounded-none md:rounded-s-2xl"
        data-station={stationKey}
      >
        <DetailsHeader
          card={card}
          detail={detail}
          stateLabel={stateLabel}
          stationPageHref={stationPageHref}
          onClose={onClose}
          onOpenMoveMenu={onOpenMoveMenu}
        />

        <DetailsTabBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          filesCount={detail?.designVersions.length ?? 0}
          reworkCount={reworkCount}
          showReworkTab={showReworkTab}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <DetailsTabContent
            activeTab={activeTab}
            card={card}
            detail={detail}
            loading={loading}
            onClose={onClose}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/30 p-3 sm:px-5">
          <div className="font-mono text-2xs text-muted-foreground">ID: {card.id}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            إغلاق (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
