"use client";

/**
 * DetailsModalParts: Subcomponents and layout shells for the WorkItemDetailsModal.
 * (specs/017-press-floor-board)
 */

import React from "react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";
import { DetailsTabBar, type DetailTabKey } from "./DetailsTabBar";
import { DetailsSpecsTab } from "./DetailsSpecsTab";
import { DetailsFilesTab } from "./DetailsFilesTab";
import { DetailsReworkTab } from "./DetailsReworkTab";
import { DetailsTimelineTab } from "./DetailsTimelineTab";

export interface ModalShellProps {
  readonly orderNumber: number;
  readonly stationKey: string;
  readonly onClose: () => void;
  readonly backdropRef: React.RefObject<HTMLDivElement | null>;
  readonly dialogRef: React.RefObject<HTMLDivElement | null>;
  readonly children: React.ReactNode;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative flex h-full max-h-[92vh] w-full max-w-2xl md:max-w-3xl md:w-[720px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl transition-all sm:max-h-[85vh]"
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

export function DetailsFooter({ cardId, onClose }: { readonly cardId: string; readonly onClose: () => void }) {
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

export function ModalBody({
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
