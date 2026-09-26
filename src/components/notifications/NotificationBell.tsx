"use client";

// The shell affordance — contracts/ui.md §NotificationBell.
//
// Owns exactly the state a dropdown needs: open/closed, the unread count,
// and the first page of rows. The count is refreshed from the SERVER on any
// invalidation (stream signal, mark-read, mark-all) — the client never
// computes or trusts its own tally (constitution V, FR-010). The live
// transport comes from `useNotificationStream`, whose fallback polling path
// makes the bell correct even when SSE never connects (FR-034).
//
// Accessibility: the button's aria-label carries the count (Arabic),
// `aria-hidden` on the badge so the number is not announced twice; the
// panel is a role="menu" closed by Escape / outside click.
//
// RTL: logical properties only (constitution IX, SC-007).

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import type { NotificationView } from "~/server/notifications";
import { formatBadge, toArabicDigits } from "~/server/notifications";
import ar from "~/messages/ar.json";
import { NotificationDropdown } from "./NotificationDropdown";
import { useNotificationStream } from "./use-notification-stream";

const N = ar.notifications;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Re-read through the server on any invalidation. Never trusting the
  // client's own count: the server is the only authority for read state.
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
        <NotificationDropdown
          count={count}
          rows={rows}
          markReadAction={markReadAction}
          markAllReadAction={markAllReadAction}
          refresh={refresh}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
