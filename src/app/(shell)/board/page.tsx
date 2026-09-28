/**
 * Press Floor Board RSC page loading snapshot and rendering BoardProvider.
 * (specs/017-press-floor-board/plan.md §Project Structure, contracts/board-server.md, plan.md S1)
 */

import { getActor } from "~/server/auth";
import { getBoardSnapshot } from "~/server/board";
import { Board } from "~/components/board/Board";
import { BoardProvider } from "~/components/board/BoardProvider";
import { DndBridge } from "~/components/board/dnd/DndBridge";

export default async function BoardPage() {
  const actor = await getActor();
  const snapshot = await getBoardSnapshot(actor);

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
