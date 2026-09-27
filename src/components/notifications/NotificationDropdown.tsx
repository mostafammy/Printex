"use client";

// The at-a-glance dropdown panel — contracts/ui.md §NotificationDropdown.
//
// Presentational: it receives the count, rows, and the actions, and owns no
// open/close logic (the bell does) and no fetches (the server does). Clicking
// a row marks it read through the SERVER ACTION and then navigates, so the
// count is already correct when the destination renders. A row with a null
// link is non-navigable — retained but muted — and never fires a broken
// navigation or an error toast (FR-025).

import Link from "next/link";
import type { NotificationView } from "~/server/notifications";
import { toArabicDigits } from "~/lib/ar-format";
import ar from "~/messages/ar.json";
import { SEVERITY_CLASS, relativeTime } from "./notification-list";

const N = ar.notifications;

export interface NotificationDropdownProps {
  readonly count: number;
  readonly rows: readonly NotificationView[];
  readonly markReadAction: (id: string) => Promise<unknown>;
  readonly markAllReadAction: () => Promise<unknown>;
  /** Re-read through the server after a mutation. */
  readonly refresh: () => Promise<void>;
  /** Close the panel (Escape / outside click / a successful row navigation). */
  readonly onClose: () => void;
}

export function NotificationDropdown(props: NotificationDropdownProps) {
  const { count, rows, markReadAction, markAllReadAction, refresh, onClose } = props;
  const now = Date.now();

  const onRowClick = async (row: NotificationView) => {
    if (row.readAt === null) {
      // Mark read BEFORE navigating (contracts/ui.md §Dropdown).
      await markReadAction(row.id);
      await refresh();
    }
    if (row.linkHref) onClose();
  };

  return (
    <div
      role="menu"
      className="absolute end-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card p-2 shadow-lg"
    >
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-sm font-medium">
          {N.title} {count > 0 && `(${toArabicDigits(count)})`}
        </span>
        <form
          action={async () => {
            await markAllReadAction();
            await refresh();
          }}
        >
          <button
            type="submit"
            disabled={count === 0}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {N.markAllRead}
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">{N.empty}</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => void onRowClick(row)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-start text-sm hover:bg-muted ${
                  row.readAt === null ? "bg-muted/50" : ""
                } ${row.linkHref ? "cursor-pointer" : "cursor-default opacity-70"}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    SEVERITY_CLASS[row.severity] ?? SEVERITY_CLASS.INFO
                  }`}
                />
                <span className="flex-1">
                  <span className="block font-medium">{row.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {relativeTime(row.createdAt, now)}
                    {row.linkHref === null && ` — ${N.noLinkHint}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border pt-2 text-center">
        <Link href="/notifications" className="text-xs underline-offset-4 hover:underline">
          {N.viewAll}
        </Link>
      </div>
    </div>
  );
}
