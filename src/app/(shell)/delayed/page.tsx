// The delayed-work list — contracts/ui.md §Delayed-work list (US6).
//
// A row is a LINK, not a button that opens a modal: the shop's instinct is to
// go to the Order, and PRD §60 asks for minimal clicks.
//
// The age cell is server-computed and rendered by the ONE shared formatter the
// catalog uses, so a delay shows identically here, in the notification body,
// and on 090's dashboard (SC-012). The value is never computed in the client.

import Link from "next/link";
import { getActor } from "~/server/auth";
import {
  DELAY_PHASES,
  formatAge,
  getDelayedWorkItems,
  isDelayPhase,
  type DelayPhase,
} from "~/server/notifications";
import ar from "~/messages/ar.json";

const N = ar.notifications;

const PHASE_LABEL: Record<DelayPhase, string> = {
  DESIGN: N.phaseDesign,
  REVIEW: N.phaseReview,
  PRICING: N.phasePricing,
  PRODUCTION: N.phaseProduction,
  COLLECTION: N.phaseCollection,
};

export default async function DelayedPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string; page?: string }>;
}) {
  const actor = await getActor();
  const params = await searchParams;
  const phase = params.phase && isDelayPhase(params.phase) ? params.phase : undefined;
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await getDelayedWorkItems(actor, { phase, page, pageSize: 50 });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{N.delayedTitle}</h1>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/delayed"
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
            href={`/delayed?phase=${candidate}`}
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

      {result.rows.length === 0 ? (
        // Two distinct empty states, so "no threshold is enabled for this
        // phase" is never reported as "nothing is late" — contracts/ui.md.
        <p className="py-8 text-center text-sm text-muted-foreground">
          {phase ? N.delayedEmpty : N.delayedEmptyNoThresholds}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{ar.ui.tableHeaderOrderNumber}</th>
                <th className="px-4 py-3 text-start font-medium">{ar.ui.tableHeaderCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{N.delayedPhaseHeader}</th>
                <th className="px-4 py-3 text-start font-medium">{N.delayedAgeHeader}</th>
                <th className="px-4 py-3 text-start font-medium">{N.delayedDepartmentHeader}</th>
                <th className="px-4 py-3 text-start font-medium">{ar.ui.tableHeaderPriority}</th>
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
                  <td className="px-4 py-3">{PHASE_LABEL[row.phase]}</td>
                  <td className="px-4 py-3">{formatAge(row.waitingAgeMinutes)}</td>
                  <td className="px-4 py-3">{row.responsibleDepartmentName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.priority === "URGENT" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        {ar.ui.badgeUrgent}
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
            <Link href={`/delayed?${new URLSearchParams({ ...(phase ? { phase } : {}), page: String(page - 1) })}`} className="underline-offset-4 hover:underline">
              {N.prev}
            </Link>
          ) : (
            <span className="opacity-50">{N.prev}</span>
          )}
          <span className="text-muted-foreground">
            {N.page} {page}
          </span>
          {result.nextPage ? (
            <Link href={`/delayed?${new URLSearchParams({ ...(phase ? { phase } : {}), page: String(result.nextPage) })}`} className="underline-offset-4 hover:underline">
              {N.next}
            </Link>
          ) : (
            <span className="opacity-50">{N.next}</span>
          )}
        </div>
      )}
    </div>
  );
}
