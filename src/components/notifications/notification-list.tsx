"use client";

// The `/notifications` page's row list, plus the two display helpers shared
// with the bell's dropdown (severity dot, relative time) — contracts/ui.md.
//
// `SEVERITY_CLASS` and `relativeTime` live here rather than duplicated in
// each component so a severity renders the same colour in the dropdown and
// on the page, and so the bell file stays free of row-rendering logic it
// does not use. Import direction is strictly one-way (bell -> dropdown ->
// list), so there is no cycle.
//
// The mark-read mutations are SERVER ACTIONS, so no client state can drift
// from the server's read state (constitution V) — the client never writes
// a read flag, it asks the server to.
//
// RTL: logical properties only (`ms-/me-/ps-/pe-/start-/end-`), enforced by
// the repo's ESLint rule (constitution IX, SC-007).

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationView } from "~/server/notifications";
import { toArabicDigits } from "~/server/notifications";
import ar from "~/messages/ar.json";

const N = ar.notifications;

export const SEVERITY_CLASS: Record<string, string> = {
  INFO: "bg-muted-foreground/40",
  ACTION: "bg-amber-500",
  URGENT: "bg-red-500",
};

/** Coarse relative time, Arabic, no library. */
export function relativeTime(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return N.relativeNow;
  if (minutes < 60) return N.relativeMinutes.replace("{count}", toArabicDigits(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return N.relativeHours.replace("{count}", toArabicDigits(hours));
  const days = Math.floor(hours / 24);
  return N.relativeDays.replace("{count}", toArabicDigits(days));
}

/** The `/notifications` page's row list. Server-rendered; the toggle is an action. */
export function NotificationList({
  rows,
  markReadAction,
  markUnreadAction,
  revalidate,
}: {
  readonly rows: readonly NotificationView[];
  readonly markReadAction: (id: string) => Promise<unknown>;
  readonly markUnreadAction: (id: string) => Promise<unknown>;
  readonly revalidate?: () => Promise<void>;
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{N.empty}</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {rows.map((row) => {
        const body = (
          <>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  SEVERITY_CLASS[row.severity] ?? SEVERITY_CLASS.INFO
                }`}
              />
              <span className="font-medium">{row.title}</span>
            </span>
            {row.body && <span className="mt-1 block text-sm text-muted-foreground">{row.body}</span>}
            <span className="mt-1 block text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString("ar-EG")}
              {row.linkHref === null && ` — ${N.noLinkHint}`}
            </span>
          </>
        );

        return (
          <li key={row.id} className={row.readAt === null ? "bg-muted/40" : ""}>
            <div className="flex items-start justify-between gap-3 p-4">
              {row.linkHref ? (
                <Link href={row.linkHref} className="flex-1 hover:underline">
                  {body}
                </Link>
              ) : (
                // Out of scope or hard-removed: retained, not navigable, and
                // never a broken link (FR-025).
                <span className="flex-1">{body}</span>
              )}

              <form
                action={async () => {
                  if (row.readAt === null) await markReadAction(row.id);
                  else await markUnreadAction(row.id);
                  await revalidate?.();
                  router.refresh();
                }}
              >
                <button type="submit" className="text-xs text-muted-foreground hover:underline">
                  {row.readAt === null ? N.markRead : N.markUnread}
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
