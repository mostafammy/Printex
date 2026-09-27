// The full notification page — contracts/ui.md §/notifications.
//
// Server Component, no "use client". Filters live in URL search params so a
// view is shareable and the back button works; the list is server-rendered
// because the server is the only authority for what this user may see
// (constitution V).
//
// The page is the DURABLE view: a user who dismissed the dropdown without
// reading still finds the notification here (spec US3).

import Link from "next/link";
import { getActor } from "~/server/auth";
import { canonicalTypes, listNotifications } from "~/server/notifications";
import { NotificationList } from "~/components/notifications/notification-list";
import ar from "~/messages/ar.json";
import { markAllReadAction, markReadAction, markUnreadAction } from "./actions";

const N = ar.notifications;

type FilterState = "all" | "unread" | "read";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ read?: string; type?: string; page?: string }>;
}) {
  const actor = await getActor();
  const params = await searchParams;

  const read =
    params.read === "unread" || params.read === "read" ? (params.read as FilterState) : "all";
  // An empty `type` param means "no filter", not "filter by the empty type".
  const type = params.type && params.type.length > 0 ? params.type : undefined;
  const page = Number.parseInt(params.page ?? "1", 10);
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;

  const result = await listNotifications(actor, {
    read: read === "all" ? undefined : read,
    type,
    page: currentPage,
    pageSize: 20,
  });

  const emptyMessage =
    read === "unread" ? N.emptyUnread : read === "read" ? N.emptyRead : N.empty;

  function filterHref(next: { read?: FilterState; type?: string; page?: number }): string {
    const query = new URLSearchParams();
    const nextRead = next.read ?? read;
    if (nextRead !== "all") query.set("read", nextRead);
    if (next.type ?? type) query.set("type", next.type ?? type!);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const qs = query.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{N.title}</h1>
        <form action={markAllReadAction}>
          <button
            type="submit"
            disabled={result.unreadTotal === 0}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {N.markAllRead}
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "unread", "read"] as const).map((state) => (
          <Link
            key={state}
            href={filterHref({ read: state, page: 1 })}
            aria-current={read === state ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${
              read === state ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {state === "all" ? N.filterAll : state === "unread" ? N.filterUnread : N.filterRead}
          </Link>
        ))}

        <form className="ms-2 flex items-center gap-2">
          <label htmlFor="type" className="text-sm text-muted-foreground">
            {N.filterType}
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">{N.filterAll}</option>
            {canonicalTypes().map((canonical) => (
              <option key={canonical} value={canonical}>
                {canonical}
              </option>
            ))}
          </select>
          <button type="submit" className="text-sm underline-offset-4 hover:underline">
            {N.filterType}
          </button>
        </form>
      </div>

      {result.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <NotificationList
          rows={result.rows}
          markReadAction={markReadAction}
          markUnreadAction={markUnreadAction}
        />
      )}

      {result.total > 20 && (
        <div className="flex items-center justify-between text-sm">
          <Link
            href={filterHref({ page: Math.max(currentPage - 1, 1) })}
            aria-disabled={currentPage === 1}
            className={`underline-offset-4 hover:underline ${
              currentPage === 1 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {N.prev}
          </Link>
          <span className="text-muted-foreground">
            {N.page} {currentPage}
          </span>
          {result.nextPage ? (
            <Link href={filterHref({ page: result.nextPage })} className="underline-offset-4 hover:underline">
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
