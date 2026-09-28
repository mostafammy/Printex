"use client";

/**
 * BoardProvider builds the BoardController from RSC snapshot and provides context.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, plan.md S1, S2-D)
 */

import React, { useEffect, useState } from "react";
import {
  getBoardCardsAction,
  getBoardSnapshotAction,
  groupMoveWorkItemsAction,
  moveWorkItemAction,
} from "~/app/(shell)/board/actions";
import { createBoardController } from "~/lib/board/createBoardController";
import type { BoardSnapshot } from "~/lib/board/types";
import { BoardContext } from "./hooks/useBoardController";

export interface BoardProviderProps {
  readonly initialSnapshot: BoardSnapshot;
  readonly children: React.ReactNode;
}

export function BoardProvider({
  initialSnapshot,
  children,
}: BoardProviderProps) {
  const [controller] = useState(() =>
    createBoardController(initialSnapshot, {
      fetchSnapshot: (req) => getBoardSnapshotAction(req),
      moveSender: (req) => moveWorkItemAction(req),
      cardsFetcher: (ids) => getBoardCardsAction(ids),
      groupMoveSender: (req) => groupMoveWorkItemsAction(req),
    }),
  );

  useEffect(() => {
    void controller.initFromPrefs();
    return () => {
      controller.dispose();
    };
  }, [controller]);

  return (
    <BoardContext.Provider value={controller}>
      {children}
    </BoardContext.Provider>
  );
}
