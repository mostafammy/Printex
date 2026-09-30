"use client";

/**
 * BoardProvider builds the BoardController from RSC snapshot and provides context.
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, plan.md S1, S2-D)
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBoardCardsAction,
  getBoardLanePageAction,
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
  // 092 T034 / FR-024: SCREEN drops soft-navigate via the App Router —
  // no `window.location.href` full reload. The drop policy builds the
  // destination (path + query) and this is the only place it's executed.
  const router = useRouter();
  const [controller] = useState(() =>
    createBoardController(initialSnapshot, {
      fetchSnapshot: (req) => getBoardSnapshotAction(req),
      fetchLanePage: (req) => getBoardLanePageAction(req),
      moveSender: (req) => moveWorkItemAction(req),
      cardsFetcher: (ids) => getBoardCardsAction(ids),
      groupMoveSender: (req) => groupMoveWorkItemsAction(req),
      navigate: (href) => {
        router.push(href);
      },
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
