/**
 * Press Floor Board RSC page loading snapshot and rendering BoardProvider.
 * (specs/017-press-floor-board/plan.md §Project Structure, contracts/board-server.md, plan.md S1)
 */

import { getActor } from "~/server/auth";
import { getBoardSnapshot } from "~/server/board";
import type { SliceId } from "~/lib/board/types";
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
  const pageParam = Array.isArray(params?.page) ? params.page[0] : params?.page;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const sliceParam = Array.isArray(params?.slice) ? params.slice[0] : params?.slice;

  const snapshot = await getBoardSnapshot(actor, {
    slice: (sliceParam as SliceId) || undefined,
    pagination: { page, pageSize: 50 },
  });

  return (
    <BoardProvider initialSnapshot={snapshot}>
      {/* Full-bleed: the board is the page, not a card on a page. The shell
          wraps this in p-6 sm:p-8 md:p-10 + max-w-7xl, and the board was
          additionally drawing its own border — two frames around one surface,
          which cost workspace twice before a single ticket was drawn. */}
      <div className="-m-6 flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden sm:-m-8 md:-m-10">
        <DndBridge>
          <Board />
        </DndBridge>
      </div>
    </BoardProvider>
  );
}
