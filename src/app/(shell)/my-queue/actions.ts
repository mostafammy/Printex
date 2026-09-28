"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import {
  getMyQueuePage,
  startTimer,
  pauseTimer,
  phaseDurations,
  type MyQueueRow,
  type PhaseDurations,
} from "~/server/designers";

export interface MyQueueRowWithDurations {
  row: MyQueueRow;
  durations: PhaseDurations;
}

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function startTimerAction(formData: FormData) {
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  await startTimer(actor, workItemId);
  revalidatePath("/my-queue");
}

export async function pauseTimerAction(formData: FormData) {
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  await pauseTimer(actor, workItemId);
  revalidatePath("/my-queue");
}

export async function loadMoreMyQueueAction(page: number): Promise<{
  rows: MyQueueRowWithDurations[];
  nextCursor: number | null;
}> {
  const actor = await getActor();
  const { rows, nextCursor } = await getMyQueuePage(actor, { page });
  const rowsWithDurations = await Promise.all(
    rows.map(async (row) => ({
      row,
      durations: await phaseDurations(actor, row.workItemId),
    })),
  );
  return { rows: rowsWithDurations, nextCursor };
}
