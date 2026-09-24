// spec-history.tsx — Server Component displaying a Work Item's specification history.
// tasks.md T031, contracts/change-control.md §getSpecHistory.

import type { SpecVersionOrigin } from "../../../generated/prisma";
import type { Actor } from "~/server/auth";
import { getSpecHistory } from "~/server/changes";
import ar from "~/messages/ar.json";

const H = ar.changes.history;
const O: Record<SpecVersionOrigin, string> = ar.changes.origin;

export async function SpecHistory({
  actor,
  workItemId,
}: {
  actor: Actor;
  workItemId: string;
}) {
  const result = await getSpecHistory(actor, { workItemId });

  if (!result.ok) {
    return null;
  }

  const { versions, noHistoryBeforeNow } = result.data;

  return (
    <details className="mt-3 rounded-md border border-border p-3" data-testid="spec-history">
      <summary className="cursor-pointer text-sm font-medium text-primary">
        {H.heading} {versions.length > 0 ? `(${versions.length})` : ""}
      </summary>

      <div className="mt-3 flex flex-col gap-2">
        {noHistoryBeforeNow && (
          <p className="text-xs text-muted-foreground">{H.noHistoryBeforeNow}</p>
        )}

        {versions.length === 0 && !noHistoryBeforeNow && (
          <p className="text-xs text-muted-foreground">{H.empty}</p>
        )}

        {versions.map((v, idx) => {
          const isCurrent = idx === versions.length - 1;
          const originLabel = O[v.origin];
          const authorName = v.createdBy?.name ?? H.unattributed;
          const formattedTime = v.createdAt.toLocaleString("ar-EG", {
            dateStyle: "short",
            timeStyle: "short",
          });

          return (
            <div
              key={v.id}
              className="flex flex-col gap-1 rounded border border-border/60 bg-muted/30 p-2 text-xs"
              data-testid={`spec-version-${v.version}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {H.version} {v.version}
                  </span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                    {originLabel}
                  </span>
                  {isCurrent && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {H.current}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    {H.stateAtCreation}: {v.stateAtCreation}
                  </span>
                  <span>
                    {H.time}: {formattedTime}
                  </span>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground">
                <span>
                  {H.author}: <strong className="text-foreground">{authorName}</strong>
                </span>
                {v.reason && (
                  <span>
                    {H.reason}: <strong className="text-foreground">{v.reason}</strong>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

