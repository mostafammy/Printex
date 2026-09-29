"use client";

/**
 * WorkItemDetailsSheet: Comprehensive details sheet/modal for a job ticket on the board.
 * Opens when a card is clicked, presenting all specifications, assigned staff,
 * production notes, files, rework history, and timeline.
 * (specs/017-press-floor-board)
 */

import React, { useState } from "react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";
import { STATE_AR_LABELS, STATE_PLACEMENT } from "~/lib/board/stations";
import { DetailsHeader } from "./details/DetailsHeader";
import { DetailsTabBar, type DetailTabKey } from "./details/DetailsTabBar";
import { DetailsSpecsTab } from "./details/DetailsSpecsTab";
import { DetailsFilesTab } from "./details/DetailsFilesTab";
import { DetailsReworkTab } from "./details/DetailsReworkTab";
import { DetailsTimelineTab } from "./details/DetailsTimelineTab";
import {
  defaultFetchDetail,
  useWorkItemDetail,
  useEscapeKey,
  getStationHref,
} from "./details/sheetHooks";

export interface WorkItemDetailsSheetProps {
  readonly card: BoardCard | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
  readonly fetchDetail?: (workItemId: string) => Promise<WorkItemFullDetail | null>;
}

interface ModalProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  readonly activeTab: DetailTabKey;
  readonly setActiveTab: (tab: DetailTabKey) => void;
  readonly onClose: () => void;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
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

function DetailsFooter({ cardId, onClose }: { readonly cardId: string; readonly onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/30 p-3 sm:px-5">
      <div className="font-mono text-2xs text-muted-foreground">ID: {cardId}</div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg bg-secondary px-4 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
      >
        إغلاق (Esc)
      </button>
    </div>
  );
}

function ModalShell({
  orderNumber,
  stationKey,
  onClose,
  children,
}: {
  readonly orderNumber: number;
  readonly stationKey: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تفاصيل بطاقة العمل #${orderNumber}`}
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
        {children}
      </div>
    </div>
  );
}

function ModalBody({
  activeTab,
  setActiveTab,
  card,
  detail,
  loading,
  onClose,
}: {
  readonly activeTab: DetailTabKey;
  readonly setActiveTab: (tab: DetailTabKey) => void;
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  readonly onClose: () => void;
}) {
  const reworkCount = detail?.returns.length ?? card.reworkCount;

  return (
    <>
      <DetailsTabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        filesCount={detail?.designVersions.length ?? 0}
        reworkCount={reworkCount}
        showReworkTab={reworkCount > 0}
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
      <DetailsFooter cardId={card.id} onClose={onClose} />
    </>
  );
}

function WorkItemDetailsModal({
  card,
  detail,
  loading,
  activeTab,
  setActiveTab,
  onClose,
  onOpenMoveMenu,
}: ModalProps) {
  const placement = STATE_PLACEMENT[card.state];
  const stationKey = placement === "OFF_BOARD" ? "reception" : placement.station;

  return (
    <ModalShell orderNumber={card.orderNumber} stationKey={stationKey} onClose={onClose}>
      <DetailsHeader
        card={card}
        detail={detail}
        stateLabel={STATE_AR_LABELS[card.state] ?? card.state}
        stationPageHref={getStationHref(card.id, card.state)}
        onClose={onClose}
        onOpenMoveMenu={onOpenMoveMenu}
      />
      <ModalBody
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        card={card}
        detail={detail}
        loading={loading}
        onClose={onClose}
      />
    </ModalShell>
  );
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

  return (
    <WorkItemDetailsModal
      card={card}
      detail={detail}
      loading={loading}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onClose={onClose}
      onOpenMoveMenu={onOpenMoveMenu}
    />
  );
}
