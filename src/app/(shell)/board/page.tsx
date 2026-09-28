/**
 * Press Floor Board RSC page loading snapshot and rendering BoardProvider.
 * (specs/017-press-floor-board/plan.md §Project Structure, contracts/board-server.md, plan.md S1)
 */

import { getActor } from "~/server/auth";
import { getBoardSnapshot } from "~/server/board";
import type { SliceId } from "~/lib/board/types";
import { BOARD_LANE_PAGE_SIZE } from "~/lib/board/types";
import { Board } from "~/components/board/Board";
import { BoardProvider } from "~/components/board/BoardProvider";
import { DndBridge } from "~/components/board/dnd/DndBridge";

export default async function BoardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const params = await searchParams;
  const sliceParam = Array.isArray(params?.slice) ? params.slice[0] : params?.slice;

  const snapshot = await getBoardSnapshot(actor, {
    slice: (sliceParam as SliceId) || undefined,
    lanePageSize: BOARD_LANE_PAGE_SIZE,
  });

  return (
    <BoardProvider initialSnapshot={snapshot}>
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
        <DndBridge>
          <Board />
        </DndBridge>
      </div>
    </BoardProvider>
  );
}
