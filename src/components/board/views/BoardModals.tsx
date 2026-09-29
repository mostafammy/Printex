"use client";

/**
 * The board's overlay layer: sheets, the move menu, the group-move result,
 * and the live connection pill. Mounted once by Board for the whole board,
 * independent of which view is on screen.
 */

import React from "react";
import dynamic from "next/dynamic";
import type { BoardCard, GroupMoveResult } from "~/lib/board/types";
import { SheetHost } from "../SheetHost";
import { MoveToMenu } from "../MoveToMenu";
import { GroupResultSheet } from "../GroupResultSheet";
import { LiveIndicator } from "../LiveIndicator";

const WorkItemDetailsSheet = dynamic(
  () => import("../WorkItemDetailsSheet").then((m) => ({ default: m.WorkItemDetailsSheet })),
  { ssr: false },
);

export interface BoardModalsProps {
  readonly card: BoardCard | null;
  readonly onCloseMenu: () => void;
  readonly detailsCard?: BoardCard | null;
  readonly onCloseDetails?: () => void;
  readonly onOpenMoveMenu?: (card: BoardCard) => void;
  readonly groupResult: GroupMoveResult | null;
  readonly onCloseGroup: () => void;
}

const NOOP = () => undefined;

export function BoardModals({
  card,
  onCloseMenu,
  detailsCard = null,
  onCloseDetails,
  onOpenMoveMenu,
  groupResult,
  onCloseGroup,
}: BoardModalsProps) {
  return (
    <>
      <SheetHost />
      <MoveToMenu card={card} isOpen={Boolean(card)} onClose={onCloseMenu} />
      <WorkItemDetailsSheet
        card={detailsCard}
        isOpen={Boolean(detailsCard)}
        onClose={onCloseDetails ?? NOOP}
        onOpenMoveMenu={onOpenMoveMenu}
      />
      <GroupResultSheet result={groupResult} isOpen={Boolean(groupResult)} onClose={onCloseGroup} />
      <LiveIndicator />
    </>
  );
}
