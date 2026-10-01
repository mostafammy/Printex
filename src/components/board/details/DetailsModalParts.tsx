"use client";

/**
 * DetailsModalParts: Subcomponents and layout shells for the WorkItemDetailsModal.
 * (specs/017-press-floor-board)
 */

import React from "react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";
import { STATE_AR_LABELS } from "~/lib/board/stations";
import { DetailsTabBar, type DetailTabKey } from "./DetailsTabBar";
import { DetailsHeader } from "./DetailsHeader";
import { DetailsSpecsTab } from "./DetailsSpecsTab";
import { DetailsFilesTab } from "./DetailsFilesTab";
import { DetailsReworkTab } from "./DetailsReworkTab";
import { DetailsTimelineTab } from "./DetailsTimelineTab";
import { getStationHref } from "./sheetHooks";

export interface ModalShellProps {
  readonly orderNumber: number;
  readonly stationKey: string;
  readonly onClose: () => void;
  readonly backdropRef: React.RefObject<HTMLDivElement | null>;
  readonly dialogRef: React.RefObject<HTMLDivElement | null>;
  readonly children: React.ReactNode;
}

interface ModalHeaderProps {
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly onClose: () => void;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
}

/**
 * The sheet's header, plus the two things it derives from the card: the Arabic
 * label for the card's state and the "open this station's page" link. Keeping
 * those derivations here lets the caller pass a card rather than a pile of
 * pre-computed props.
 */
export function ModalHeader({
  card,
  detail,
  onClose,
  onOpenMoveMenu,
}: ModalHeaderProps) {
  return (
    <DetailsHeader
      card={card}
      detail={detail}
      stateLabel={STATE_AR_LABELS[card.state] ?? card.state}
      stationPageHref={getStationHref(card.id, card.state)}
      onClose={onClose}
      onOpenMoveMenu={onOpenMoveMenu}
    />
  );
}

export function ModalShell({
  orderNumber,
  stationKey,
  onClose,
  backdropRef,
  dialogRef,
  children,
}: ModalShellProps) {
  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={`تفاصيل بطاقة العمل #${orderNumber}`}
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-md sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="border-border/80 bg-card text-card-foreground relative flex h-full max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl transition-all sm:max-h-[85vh] md:w-[720px] md:max-w-3xl"
        data-station={stationKey}
      >
        {children}
      </div>
    </div>
  );
}

export function DetailsTabContent({
  activeTab,
  card,
  detail,
  loading,
  onClose,
  onRefreshFiles,
}: {
  readonly activeTab: DetailTabKey;
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  readonly onClose: () => void;
  readonly onRefreshFiles?: () => void | Promise<void>;
}) {
  if (activeTab === "files") {
    return (
      <DetailsFilesTab
        card={card}
        detail={detail}
        loading={loading}
        onRefresh={onRefreshFiles}
      />
    );
  }
  if (activeTab === "rework") {
    return <DetailsReworkTab detail={detail} />;
  }
  if (activeTab === "timeline") {
    return <DetailsTimelineTab detail={detail} loading={loading} />;
  }
  return (
    <DetailsSpecsTab card={card} detail={detail} onExecuteMove={onClose} />
  );
}

export function DetailsFooter({
  cardId,
  onClose,
}: {
  readonly cardId: string;
  readonly onClose: () => void;
}) {
  return (
    <div className="border-border/70 bg-muted/30 flex shrink-0 items-center justify-between border-t p-3 sm:px-5">
      <div className="text-2xs text-muted-foreground font-mono">
        ID: {cardId}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors"
      >
        إغلاق (Esc)
      </button>
    </div>
  );
}

interface ModalBodyProps {
  readonly activeTab: DetailTabKey;
  readonly setActiveTab: (tab: DetailTabKey) => void;
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  readonly onClose: () => void;
  readonly onRefreshFiles?: () => void | Promise<void>;
}

/**
 * Counts every file the Files tab can show — 050's attachments as well as 014's
 * design versions. Counting only the latter made the badge read "0" on a card
 * that had a production file attached, which is the opposite of useful.
 */
function totalFileCount(detail: WorkItemFullDetail | null): number {
  const designVersions = detail?.designVersions.length ?? 0;
  const attachments =
    detail?.fileAssets.reduce((n, asset) => n + asset.versions.length, 0) ?? 0;
  return designVersions + attachments;
}

export function ModalBody({
  activeTab,
  setActiveTab,
  card,
  detail,
  loading,
  onClose,
  onRefreshFiles,
}: ModalBodyProps) {
  const reworkCount = detail?.returns.length ?? card.reworkCount;
  const filesCount = totalFileCount(detail);

  return (
    <>
      <DetailsTabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        filesCount={filesCount}
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
          onRefreshFiles={onRefreshFiles}
        />
      </div>
      <DetailsFooter cardId={card.id} onClose={onClose} />
    </>
  );
}
