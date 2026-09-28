"use server";

import { getActor } from "~/server/auth";
import { getOperatorQueuePage, type ProductionQueueRow } from "~/server/production";

export async function loadMoreProductionQueueAction(page: number): Promise<{
  rows: ProductionQueueRow[];
  nextCursor: number | null;
}> {
  const actor = await getActor();
  const result = await getOperatorQueuePage(actor, { page });
  return {
    rows: [...result.rows],
    nextCursor: result.nextCursor,
  };
}
