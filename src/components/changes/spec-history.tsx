// spec-history.tsx — Server Component displaying a Work Item's specification history.
// tasks.md T031, T058, contracts/change-control.md §getSpecHistory, §getSpecVersionDiff.
//
// Each version shows its diff from the previous one; a GET form picks any two
// versions to compare (search params, so this stays a Server Component).

import type { SpecVersionOrigin } from "../../../generated/prisma";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import {
  getSpecHistory,
  getSpecVersionDiff,
  productTypeNamesForChanges,
  type SpecFieldChange,
} from "~/server/changes";
import ar from "~/messages/ar.json";
import { getChangeErrorMessage } from "./change-error-messages";
import { SpecDiff } from "./spec-diff";

const H = ar.changes.history;
const D = ar.changes.diff;
const O: Record<SpecVersionOrigin, string> = ar.changes.origin;

/** Search params of the two-version picker (scoped to one Work Item by `specDiffWi`). */
export const SPEC_DIFF_PARAMS = {
  workItem: "specDiffWi",
  from: "specDiffFrom",
  to: "specDiffTo",
} as const;

export type SpecHistorySearchParams = Readonly<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCompare(
  searchParams: SpecHistorySearchParams | undefined,
  workItemId: string,
): { from: number; to: number } | null {
  if (!searchParams || firstParam(searchParams[SPEC_DIFF_PARAMS.workItem]) !== workItemId) {
    return null;
  }
  const from = Number(firstParam(searchParams[SPEC_DIFF_PARAMS.from]));
  const to = Number(firstParam(searchParams[SPEC_DIFF_PARAMS.to]));
  return Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= 1
    ? { from, to }
    : null;
}

const selectCls =
  "rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-ring";

export async function SpecHistory({
  actor,
  workItemId,
  searchParams,
}: {
  actor: Actor;
  workItemId: string;
  /** The page's search params; enables the two-version picker. */
  searchParams?: SpecHistorySearchParams;
}) {
  const compare = parseCompare(searchParams, workItemId);
  const [result, compareResult] = await Promise.all([
    getSpecHistory(actor, { workItemId }),
    compare
      ? getSpecVersionDiff(actor, {
          workItemId,
          fromVersion: compare.from,
          toVersion: compare.to,
        })
      : null,
  ]);

  if (!result.ok) {
    return null;
  }

  const { versions, diffs, noHistoryBeforeNow } = result.data;
  const diffByTo = new Map(diffs.map((d) => [d.to, d.changes]));
  const compareChanges: readonly SpecFieldChange[] =
    compareResult?.ok ? compareResult.data : [];
  const productTypeNames = await productTypeNamesForChanges(db, [
    ...diffs.map((d) => d.changes),
    compareChanges,
  ]);
  const last = versions.at(-1)?.version ?? 1;
  const pickerFrom = compare?.from ?? Math.max(1, last - 1);
  const pickerTo = compare?.to ?? last;

  return (
    <details
      id={`spec-history-${workItemId}`}
      className="mt-3 rounded-md border border-border p-3"
      data-testid="spec-history"
      open={compare !== null}
    >
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

              {diffByTo.has(v.version) && (
                <div className="mt-2 ps-2" data-testid={`spec-version-diff-${v.version}`}>
                  <SpecDiff
                    changes={diffByTo.get(v.version) ?? []}
                    productTypeNames={productTypeNames}
                    caption={D.fromPrevious}
                  />
                </div>
              )}
            </div>
          );
        })}

        {versions.length >= 2 && (
          <div
            className="mt-2 flex flex-col gap-2 rounded border border-border/60 p-2 text-xs"
            data-testid="spec-version-compare"
          >
            <form
              method="get"
              action={`#spec-history-${workItemId}`}
              className="flex flex-wrap items-end gap-2"
            >
              <span className="font-medium text-foreground">{D.compareHeading}</span>
              <input type="hidden" name={SPEC_DIFF_PARAMS.workItem} value={workItemId} />
              <label className="flex flex-col gap-1 text-muted-foreground">
                {D.compareFrom}
                <select name={SPEC_DIFF_PARAMS.from} defaultValue={pickerFrom} className={selectCls}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.version}>
                      {v.version}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-muted-foreground">
                {D.compareTo}
                <select name={SPEC_DIFF_PARAMS.to} defaultValue={pickerTo} className={selectCls}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.version}>
                      {v.version}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md border border-input bg-background px-3 py-1 font-medium hover:bg-muted"
              >
                {D.compareButton}
              </button>
            </form>

            {compare &&
              compareResult &&
              (compareResult.ok ? (
                <SpecDiff
                  changes={compareChanges}
                  productTypeNames={productTypeNames}
                  caption={`${H.version} ${compare.from} ${D.arrow} ${H.version} ${compare.to}`}
                />
              ) : (
                <p className="text-destructive">{getChangeErrorMessage(compareResult.error.code)}</p>
              ))}
          </div>
        )}
      </div>
    </details>
  );
}
