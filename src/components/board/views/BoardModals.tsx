"use client";

/**
 * The board's overlay layer: sheets, the move menu, the group-move result,
 * and the live connection pill. Mounted once by Board for the whole board,
 * independent of which view is on screen.
 */

import React from "react";
import type { BoardCard, GroupMoveResult } from "~/lib/board/types";
import { SheetHost } from "../SheetHost";
import { MoveToMenu } from "../MoveToMenu";
import { GroupResultSheet } from "../GroupResultSheet";
import { LiveIndicator } from "../LiveIndicator";

export interface BoardModalsProps {
  readonly card: BoardCard | null;
  readonly onCloseMenu: () => void;
  readonly groupResult: GroupMoveResult | null;
  readonly onCloseGroup: () => void;
}

export function BoardModals({
  card,
  onCloseMenu,
  groupResult,
  onCloseGroup,
}: BoardModalsProps) {
  return (
    <>
      <SheetHost />
      <MoveToMenu card={card} isOpen={Boolean(card)} onClose={onCloseMenu} />
      <GroupResultSheet result={groupResult} isOpen={Boolean(groupResult)} onClose={onCloseGroup} />
      <LiveIndicator />
    </>
  );
}
