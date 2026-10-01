"use client";

/**
 * WorkItemDetailsSheet: Comprehensive details sheet/modal for a job ticket on the board.
 * Opens when a card is clicked with a fluid morph transition from the card,
 * and shrinks/minimizes smoothly back into the card upon closing.
 * (specs/017-press-floor-board)
 */

import React, { useState } from "react";
import type { BoardCard, WorkItemFullDetail } from "~/lib/board/types";
import { STATE_AR_LABELS, STATE_PLACEMENT } from "~/lib/board/stations";
import { DetailsHeader } from "./details/DetailsHeader";
import type { DetailTabKey } from "./details/DetailsTabBar";
import { ModalShell, ModalBody } from "./details/DetailsModalParts";
import {
  defaultFetchDetail,
  useWorkItemDetail,
  useEscapeKey,
  getStationHref,
} from "./details/sheetHooks";
import { useCardModalMorph } from "./details/useCardModalMorph";

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
  readonly onRefresh?: () => void | Promise<void>;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
  readonly backdropRef: React.RefObject<HTMLDivElement | null>;
  readonly dialogRef: React.RefObject<HTMLDivElement | null>;
}

function WorkItemDetailsModal(props: ModalProps) {
  const { card, detail, loading, activeTab, setActiveTab, onClose, onRefresh, onOpenMoveMenu, backdropRef, dialogRef } = props;
  const placement = STATE_PLACEMENT[card.state];
  const stationKey = placement === "OFF_BOARD" ? "reception" : placement.station;

  return (
    <ModalShell
      orderNumber={card.orderNumber}
      stationKey={stationKey}
      onClose={onClose}
      backdropRef={backdropRef}
      dialogRef={dialogRef}
    >
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
        onRefresh={onRefresh}
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
  const { detail, loading, refresh } = useWorkItemDetail(card?.id, isOpen, fetchDetail);
  const [activeTab, setActiveTab] = useState<DetailTabKey>("specs");
  const { backdropRef, dialogRef, handleClose } = useCardModalMorph(card?.id, isOpen, onClose);
  useEscapeKey(isOpen, handleClose);

  if (!isOpen || !card) return null;

  return (
    <WorkItemDetailsModal
      card={card}
      detail={detail}
      loading={loading}
      onRefresh={refresh}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onClose={handleClose}
      onOpenMoveMenu={onOpenMoveMenu}
      backdropRef={backdropRef}
      dialogRef={dialogRef}
    />
  );
}
