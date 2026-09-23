// My queue — 012-designer-assignment-timers US3 (T027).
// Server Component: no "use client". All mutations use inline Server
// Actions. Elapsed time is re-derived from `phaseDurations` at render time
// (constitution III) — never a client-side stopwatch.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getActor } from "~/server/auth";
import { getMyQueue, startTimer, pauseTimer, phaseDurations } from "~/server/designers";
import type { MyQueueRow } from "~/server/designers";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(date);
}

/** `ms` -> "H:MM:SS" — re-derived from persisted timestamps at every render. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ── Server Actions ──────────────────────────────────────────────────────────

async function startTimerAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  await startTimer(actor, workItemId);
  revalidatePath("/my-queue");
}

async function pauseTimerAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  await pauseTimer(actor, workItemId);
  revalidatePath("/my-queue");
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function MyQueuePage() {
  const actor = await getActor();
  const rows = await getMyQueue(actor);

  const rowsWithDurations = await Promise.all(
    rows.map(async (row) => ({ row, durations: await phaseDurations(actor, row.workItemId) })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{S.myQueuePageTitle}</h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{S.myQueueEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{S.myQueueTableHeaderCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{S.myQueueTableHeaderProduct}</th>
                <th className="px-4 py-3 text-start font-medium">{S.myQueueTableHeaderDueDate}</th>
                <th className="px-4 py-3 text-start font-medium">{S.myQueueTableHeaderStatus}</th>
                <th className="px-4 py-3 text-start font-medium">{S.myQueueTableHeaderElapsed}</th>
                <th className="px-4 py-3 text-start font-medium">{S.myQueueTableHeaderActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rowsWithDurations.map(({ row, durations }: { row: MyQueueRow; durations: Awaited<ReturnType<typeof phaseDurations>> }) => (
                <tr key={row.workItemId} className="bg-card hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/orders/${row.orderId}`} className="hover:underline">
                      {row.customerName}
                    </Link>
                    <div className="text-xs text-muted-foreground">#{row.orderNumber}</div>
                  </td>
                  <td className="px-4 py-3">{row.productTypeName ?? S.myQueueNoProductType}</td>
                  <td className="px-4 py-3">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.priority === "URGENT" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          {S.badgeUrgent}
                        </span>
                      )}
                      {row.isRework && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          {S.myQueueBadgeRework}
                        </span>
                      )}
                    </div>
                    {row.rejectionDetails && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.rejectionDetails.explanation ?? row.rejectionDetails.category}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatDuration(durations.activeTimeMs)}</td>
                  <td className="px-4 py-3">
                    <form
                      action={row.hasOpenTimer ? pauseTimerAction : startTimerAction}
                      className="flex"
                    >
                      <input type="hidden" name="workItemId" value={row.workItemId} />
                      <Button type="submit" variant={row.hasOpenTimer ? "outline" : "default"} size="sm">
                        {row.hasOpenTimer
                          ? S.myQueuePauseButton
                          : row.state === "IN_DESIGN"
                            ? S.myQueueResumeButton
                            : S.myQueueStartButton}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
