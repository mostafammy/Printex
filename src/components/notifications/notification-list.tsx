"use client";

// The bell and its dropdown — contracts/ui.md.
//
// A Server Component shell that fetches the count, wrapped around a small
// Client Component that owns only the open/closed state and the keyboard
// handling. The mark-read mutations are SERVER ACTIONS, so no client state can
// drift from the server's read state (constitution V) — the client never
// writes a read flag, it asks the server to.
//
// RTL: logical properties only (`ms-/me-/ps-/pe-/start-/end-`), enforced by the
// repo's ESLint rule (constitution IX, SC-007).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import type { NotificationView } from "~/server/notifications";
import { formatBadge } from "~/server/notifications";
import { toArabicDigits } from "~/server/notifications";
import ar from "~/messages/ar.json";
import { useNotificationStream } from "./use-notification-stream";

const N = ar.notifications;

const SEVERITY_CLASS: Record<string, string> = {
  INFO: "bg-muted-foreground/40",
  ACTION: "bg-amber-500",
  URGENT: "bg-red-500",
};

/** Coarse relative time, Arabic, no library. */
function relativeTime(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return N.relativeNow;
  if (minutes < 60) return N.relativeMinutes.replace("{count}", toArabicDigits(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return N.relativeHours.replace("{count}", toArabicDigits(hours));
  const days = Math.floor(hours / 24);
  return N.relativeDays.replace("{count}", toArabicDigits(days));
}

export interface NotificationBellProps {
  readonly initialCount: number;
  readonly initialRows: readonly NotificationView[];
  /** A Server Action; marking read is the server's call, not the client's. */
  readonly markReadAction: (id: string) => Promise<unknown>;
  readonly markAllReadAction: () => Promise<unknown>;
  /**
   * Re-reads list + count after a mutation or a stream signal. Optional: a
   * server-rendered page revalidates through its own Server Action, so it has
   * nothing to re-read client-side.
   */
  readonly revalidate?: () => Promise<void>;
}

export function NotificationBell(props: NotificationBellProps) {
  const { initialCount, initialRows, markReadAction, markAllReadAction, revalidate } = props;

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [rows, setRows] = useState<NotificationView[]>([...initialRows]);
  const now = Date.now();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Re-read through the server on any invalidation. Never trusting the
  // client's own count: the server is the only authority for read state
  // (constitution V, FR-010).
  const refresh = useCallback(async () => {
    await revalidate?.();
    router.refresh();
  }, [revalidate, router]);

  useNotificationStream({
    onNotification: () => {
      void refresh();
    },
    onCountChange: setCount,
  });

  useEffect(() => {
    setCount(initialCount);
    setRows([...initialRows]);
  }, [initialCount, initialRows]);

  // Close on Escape or an outside click, per the contract.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const onRowClick = async (row: NotificationView) => {
    if (row.readAt === null) {
      // Mark read BEFORE navigating, so the count is already correct when the
      // destination renders (contracts/ui.md §Dropdown).
      await markReadAction(row.id);
      await refresh();
    }
    // A row with no link is non-navigable and must not fire a broken
    // navigation or an error toast (FR-025).
    if (row.linkHref) setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={N.unreadBadgeAria.replace("{count}", toArabicDigits(count))}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden="true" />
        {count > 0 && (
          <span
            // The aria-label carries the number, so the badge must not be
            // announced twice.
            aria-hidden="true"
            className="absolute -end-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-medium leading-4 text-destructive-foreground"
          >
            {formatBadge(count)}
          </span>
        )}
      </button>

      {open && (
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
      )}
    </div>
  );
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
