"use client";

/**
 * World-class Apple-grade DetailsModalParts: Subcomponents and layout shells for the WorkItemDetailsModal.
 * (specs/017-press-floor-board)
 */

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative flex h-full max-h-[94vh] w-full max-w-2xl md:max-w-3xl lg:max-w-4xl md:w-[780px] flex-col overflow-hidden rounded-3xl sm:rounded-[28px] border border-border/80 bg-card/95 text-card-foreground shadow-[0_25px_80px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl transition-all sm:max-h-[88vh] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:pointer-events-none"
        data-station={stationKey}
      >
        {children}
      </div>
    </div>
  );
}

export interface DetailsTabContentProps {
  readonly activeTab: DetailTabKey;
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  readonly onClose: () => void;
  readonly onRefresh?: () => void | Promise<void>;
}

export function DetailsTabContent({
  activeTab,
  card,
  detail,
  loading,
  onClose,
  onRefresh,
}: DetailsTabContentProps) {
  if (activeTab === "files") {
    return (
      <DetailsFilesTab
        card={card}
        detail={detail}
        loading={loading}
        onRefresh={onRefresh}
      />
    );
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
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    try {
      void navigator.clipboard.writeText(cardId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/30 px-4 sm:px-6 py-3 backdrop-blur-md">
      <button
        type="button"
        onClick={handleCopyId}
        className="group inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/60 px-3 py-1 text-2xs font-mono text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
        title="نسخ معرف صنف العمل"
      >
        <span>ID: {cardId}</span>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        )}
      </button>

      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 rounded-xl bg-secondary/80 px-4 py-1.5 text-xs font-bold text-secondary-foreground shadow-2xs backdrop-blur-sm transition-all hover:bg-secondary active:scale-95"
      >
        <span>إغلاق (Esc)</span>
      </button>
    </div>
  );
}

export interface ModalBodyProps {
  readonly activeTab: DetailTabKey;
  readonly setActiveTab: (tab: DetailTabKey) => void;
  readonly card: BoardCard;
  readonly detail: WorkItemFullDetail | null;
  readonly loading: boolean;
  readonly onClose: () => void;
  readonly onRefresh?: () => void | Promise<void>;
}

export function ModalBody({
  activeTab,
  setActiveTab,
  card,
  detail,
  loading,
  onClose,
  onRefresh,
}: ModalBodyProps) {
  const reworkCount = detail?.returns.length ?? card.reworkCount;
  const filesCount =
    (detail?.fileAssets?.reduce((sum, a) => sum + a.versions.length, 0) ?? 0) +
    (detail?.designVersions.length ?? 0);

  return (
    <>
      <DetailsTabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        filesCount={filesCount}
        reworkCount={reworkCount}
        showReworkTab={reworkCount > 0}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <DetailsTabContent
          activeTab={activeTab}
          card={card}
          detail={detail}
          loading={loading}
          onClose={onClose}
          onRefresh={onRefresh}
        />
      </div>
      <DetailsFooter cardId={card.id} onClose={onClose} />
    </>
  );
}
