// The delayed-work list — contracts/ui.md §Delayed-work list (US6).
//
// A row is a LINK, not a button that opens a modal: the shop's instinct is to
// go to the Order, and PRD §60 asks for minimal clicks.
//
// The age cell is server-computed and rendered by the ONE shared formatter the
// catalog uses, so a delay shows identically here, in the notification body,
// and on 090's dashboard (SC-012). The value is never computed in the client.
//
// Filters (phase, priority, department, date range) are URL search params,
// server-rendered like the rest of the app. Every control rebuilds the FULL
// query, so one filter never silently drops another, and a filter change
// resets pagination.

import Link from "next/link";
import { Suspense } from "react";
import { getActor } from "~/server/auth";
import { db } from "~/server/db";
import {
  DELAY_PHASES,
  formatAge,
  getDelayedWorkItems,
  isDelayPhase,
  type DelayPhase,
} from "~/server/notifications";
import { Skeleton } from "~/components/ui/skeleton";
import ar from "~/messages/ar.json";

const N = ar.notifications;
const S = ar.ui;

// Same input recipe as admin/audit's filter form (001 T033).
const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const PHASE_LABEL: Record<DelayPhase, string> = {
  DESIGN: N.phaseDesign,
  REVIEW: N.phaseReview,
  PRICING: N.phasePricing,
  PRODUCTION: N.phaseProduction,
  COLLECTION: N.phaseCollection,
};

type DelayedFilters = Parameters<typeof getDelayedWorkItems>[1];

/**
 * 092 T051 (investigation §12c): the dept-gated main list. The department
 * list read gates this child (its ids validate `departmentId` in the page),
 * and this read now runs behind a shimmer skeleton while the title, phase
 * pills and filter form above have painted. Query order unchanged:
 * departments still resolve before this runs.
 */
async function DelayedResults({
  actor,
  filters,
  page,
  hasFilter,
  hrefWith,
}: {
  actor: Parameters<typeof getDelayedWorkItems>[0];
  filters: DelayedFilters;
  page: number;
  hasFilter: boolean;
  hrefWith: (patch: Record<string, string | undefined>) => string;
}) {
  const result = await getDelayedWorkItems(actor, filters);

  return (
    <>
      {result.rows.length === 0 ? (
        // Two distinct empty states (contracts/ui.md): WITH any filter the
        // generic "nothing is late"; with NO filters at all, the no-threshold
        // explanation — so "thresholds are off" is never reported as "nothing
        // is late" and vice versa.
        <p className="py-8 text-center text-sm text-muted-foreground">
          {hasFilter ? N.delayedEmpty : N.delayedEmptyNoThresholds}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderOrderNumber}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderProductType}</th>
                <th className="px-4 py-3 text-start font-medium">{N.delayedPhaseHeader}</th>
                <th className="px-4 py-3 text-start font-medium">{N.delayedAgeHeader}</th>
                <th className="px-4 py-3 text-start font-medium">{N.delayedDepartmentHeader}</th>
                <th className="px-4 py-3 text-start font-medium">{S.tableHeaderPriority}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr key={row.workItemId} className="bg-card hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/orders/${row.orderId}`} className="hover:underline">
                      #{row.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.customerName}</td>
                  <td className="px-4 py-3">{row.productTypeName ?? "—"}</td>
                  <td className="px-4 py-3">{PHASE_LABEL[row.phase]}</td>
                  <td className="px-4 py-3">{formatAge(row.waitingAgeMinutes)}</td>
                  <td className="px-4 py-3">{row.responsibleDepartmentName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.priority === "URGENT" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        {S.badgeUrgent}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.total > 50 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={hrefWith({ page: String(page - 1) })} className="underline-offset-4 hover:underline">
              {N.prev}
            </Link>
          ) : (
            <span className="opacity-50">{N.prev}</span>
          )}
          <span className="text-muted-foreground">
            {N.page} {page}
          </span>
          {result.nextPage ? (
            <Link href={hrefWith({ page: String(result.nextPage) })} className="underline-offset-4 hover:underline">
              {N.next}
            </Link>
          ) : (
            <span className="opacity-50">{N.next}</span>
          )}
        </div>
      )}
    </>
  );
}

export default async function DelayedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const params = await searchParams;

  // Narrow each param: a string[] or "" means "no filter".
  const str = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  // Dates must parse, or the service would hand Prisma an Invalid Date.
  const dateStr = (key: string): string | undefined => {
    const value = str(key);
    return value !== undefined && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
  };

  const phaseRaw = str("phase");
  const phase = phaseRaw !== undefined && isDelayPhase(phaseRaw) ? phaseRaw : undefined;
  const priorityRaw = str("priority");
  const priority =
    priorityRaw === "NORMAL" || priorityRaw === "URGENT" ? priorityRaw : undefined;
  const from = dateStr("from");
  const to = dateStr("to");
  const parsedPage = Number.parseInt(str("page") ?? "1", 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const departments = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  const departmentIdParam = str("departmentId");
  // An unknown/inactive id is treated as "no filter" rather than an id the
  // service would never match (or that no longer exists).
  const departmentId = departments.some((dept) => dept.id === departmentIdParam)
    ? departmentIdParam
    : undefined;

  const hasFilter =
    phase !== undefined ||
    priority !== undefined ||
    departmentId !== undefined ||
    from !== undefined ||
    to !== undefined;

  const filters: DelayedFilters = {
    phase,
    priority,
    departmentId,
    from,
    to,
    page,
    pageSize: 50,
  };

  // Every control rebuilds the WHOLE query: a phase pill keeps the priority
  // and date filters, a form submit keeps the phase (via its hidden input),
  // and `page` is only ever added by the pagination links — so any filter
  // change resets to page 1.
  const hrefWith = (patch: Record<string, string | undefined>): string => {
    const merged: Record<string, string | undefined> = {
      phase,
      priority,
      departmentId,
      from,
      to,
      ...patch,
    };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/delayed?${qs}` : "/delayed";
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{N.delayedTitle}</h1>

      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefWith({ phase: undefined })}
          aria-current={phase === undefined ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-sm ${
            phase === undefined
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {N.filterAll}
        </Link>
        {DELAY_PHASES.map((candidate) => (
          <Link
            key={candidate}
            href={hrefWith({ phase: candidate })}
            aria-current={phase === candidate ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${
              phase === candidate
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {PHASE_LABEL[candidate]}
          </Link>
        ))}
      </div>

      {/* Priority / department / date range — plain GET form, so the result
          stays server-rendered and the URL is the whole state. */}
      <form method="get" action="/delayed" className="flex flex-wrap items-end gap-3">
        {phase !== undefined && <input type="hidden" name="phase" value={phase} />}

        <div className="flex w-40 flex-col gap-1.5">
          <label htmlFor="delayed-priority" className="text-sm font-medium">
            {S.priorityLabel}
          </label>
          <select
            id="delayed-priority"
            name="priority"
            defaultValue={priority ?? ""}
            className={inputCls}
          >
            <option value="">{N.filterAll}</option>
            <option value="NORMAL">{S.priorityNormal}</option>
            <option value="URGENT">{S.priorityUrgent}</option>
          </select>
        </div>

        <div className="flex w-48 flex-col gap-1.5">
          <label htmlFor="delayed-department" className="text-sm font-medium">
            {S.departmentsLabel}
          </label>
          <select
            id="delayed-department"
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className={inputCls}
          >
            <option value="">{N.filterAll}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-44 flex-col gap-1.5">
          <label htmlFor="delayed-from" className="text-sm font-medium">
            {S.auditFilterDateFrom}
          </label>
          <input
            id="delayed-from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className={inputCls}
          />
        </div>

        <div className="flex w-44 flex-col gap-1.5">
          <label htmlFor="delayed-to" className="text-sm font-medium">
            {S.auditFilterDateTo}
          </label>
          <input
            id="delayed-to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {S.auditFilterSubmitButton}
        </button>
        {hasFilter && (
          <Link
            href="/delayed"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {S.auditFilterClearButton}
          </Link>
        )}
      </form>

      {/* 092 T051 (investigation §12c): the dept-gated list streams behind a
          shimmer skeleton — title, phase pills and the filter form above have
          already painted. Query order unchanged. */}
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <DelayedResults
          actor={actor}
          filters={filters}
          page={page}
          hasFilter={hasFilter}
          hrefWith={hrefWith}
        />
      </Suspense>
    </div>
  );
}
