// Approver queue — 016-change-control US3 (T051), contracts/change-control.md
// §listPendingChangeRequests. Urgent first, then oldest first; cursor-paginated
// through the `cursor` search param. Authorization is the query's own
// `change.approve` check (FORBIDDEN renders a friendly notice).
// Server Component: no "use client". RTL: logical Tailwind properties only.

import Link from "next/link";
import { getActor } from "~/server/auth";
import { listPendingChangeRequests } from "~/server/changes";
import {
  formatAge,
  getChangeErrorMessage,
  specFieldLabel,
} from "~/components/changes";
import ar from "~/messages/ar.json";

const Q = ar.changes.queue;

export default async function ChangeRequestQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cursor =
    typeof params.cursor === "string" && params.cursor !== ""
      ? params.cursor
      : undefined;
  const actor = await getActor();

  const result = await listPendingChangeRequests(actor, { cursor });

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{Q.pageTitle}</h1>
        <p className="text-muted-foreground" role="alert">
          {result.error.code === "FORBIDDEN"
            ? Q.forbidden
            : getChangeErrorMessage(result.error.code)}
        </p>
      </div>
    );
  }

  const { rows, nextCursor } = result.data;
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{Q.pageTitle}</h1>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{Q.empty}</p>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th scope="col" className="p-3 text-start">
                  {Q.orderHeader}
                </th>
                <th scope="col" className="p-3 text-start">
                  {Q.priorityHeader}
                </th>
                <th scope="col" className="p-3 text-start">
                  {Q.workItemHeader}
                </th>
                <th scope="col" className="p-3 text-start">
                  {Q.changedFieldsHeader}
                </th>
                <th scope="col" className="p-3 text-start">
                  {Q.requesterHeader}
                </th>
                <th scope="col" className="p-3 text-start">
                  {Q.ageHeader}
                </th>
                <th scope="col" className="p-3">
                  <span className="sr-only">{Q.openLink}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.changeRequestId}
                  className="border-border border-b last:border-0"
                >
                  <td className="p-3">
                    <Link
                      href={`/orders/${row.orderId}`}
                      className="text-primary font-medium hover:underline"
                    >
                      #{row.orderNumber}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {row.customerName}
                    </div>
                  </td>
                  <td className="p-3">
                    {row.priority === "URGENT" ? (
                      <span className="bg-destructive rounded-full px-2 py-0.5 text-xs font-medium text-white">
                        {Q.urgentBadge}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {Q.normalPriority}
                      </span>
                    )}
                  </td>
                  <td className="p-3">{row.productTypeName ?? "—"}</td>
                  <td className="p-3">
                    {row.changedFields.map(specFieldLabel).join("، ")}
                  </td>
                  <td className="p-3">{row.requestedByName}</td>
                  <td className="text-muted-foreground p-3 whitespace-nowrap">
                    <time dateTime={row.createdAt.toISOString()}>
                      {formatAge(row.createdAt, now)}
                    </time>
                  </td>
                  <td className="p-3 text-end">
                    <Link
                      href={`/changes/${row.changeRequestId}`}
                      className="text-primary hover:underline"
                    >
                      {Q.openLink}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(cursor !== undefined || nextCursor !== null) && (
        <nav className="flex items-center justify-between gap-2 text-sm">
          {cursor ? (
            <Link href="/changes" className="text-primary hover:underline">
              {Q.firstPage}
            </Link>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Link
              href={`/changes?cursor=${encodeURIComponent(nextCursor)}`}
              className="text-primary hover:underline"
            >
              {Q.nextPage}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
