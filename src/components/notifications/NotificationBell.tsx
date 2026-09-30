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

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import type { NotificationView } from "~/server/notifications";
import { formatBadge, toArabicDigits } from "~/lib/ar-format";
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
   * The targeted server re-read (092 contract notification-refresh §1): a
   * no-input Server Action returning `{ count, rows }` for the CALLER. The
   * payload IS the delivery channel for a successful re-read — the bell
   * applies it to local state, so no route refresh is ever needed (FR-019,
   * FR-020). Optional: a server-rendered page revalidates through its own
   * Server Action, so it has nothing to re-read client-side.
   */
  readonly revalidate?: () => Promise<{ count: number; rows: NotificationView[] }>;
}

export function NotificationBell(props: NotificationBellProps) {
  const { initialCount, initialRows, markReadAction, markAllReadAction, revalidate } = props;

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [rows, setRows] = useState<NotificationView[]>([...initialRows]);
  // A genuine re-read failure (the Server Action rejected), surfaced next to
  // the bell with a retry — contracts/ui.md §Dropdown error state. Not a
  // transport warning: that is the polling dot below.
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 092 contract notification-refresh §3 — latest-response-wins. Monotonic id
  // of the newest ISSUED re-read: only its outcome may apply state or drive
  // the error surface; a late older response is discarded silently.
  const requestIdRef = useRef(0);

  // Re-read through the server on any invalidation, then apply the returned
  // {count, rows} locally. Never trusting the client's own count: the server
  // is the only authority for read state — and NO route refresh on any
  // success path (FR-019, FR-020, contract §2.2).
  const refresh = useCallback(async () => {
    if (!revalidate) return;
    const requestId = ++requestIdRef.current;
    try {
      const payload = await revalidate();
      // Superseded while in flight: the newest issued request wins, so an
      // older response must not overwrite newer local state (§3.1) or an
      // error already surfaced by the latest one (§3.2).
      if (requestId !== requestIdRef.current) return;
      setCount(payload.count);
      setRows([...payload.rows]);
      setError(false);
    } catch {
      // Only the latest issued request's outcome drives the error surface.
      if (requestId !== requestIdRef.current) return;
      setError(true);
    }
  }, [revalidate]);

  const retry = () => {
    setError(false);
    void refresh();
  };

  const { transport } = useNotificationStream({
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
    <div className="relative flex items-center gap-1.5" ref={containerRef}>
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

      {/* FR-030: transport is display-only — a muted dot with a tooltip,
          never a warning colour or an alert. */}
      {transport === "polling" && (
        <span
          aria-hidden="true"
          title={N.transportPolling}
          className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
        />
      )}

      {/* The genuine read-failure surface: message + retry, inline so it
          never overlaps the dropdown and stays a header widget. */}
      {error && (
        <span role="status" className="flex items-center gap-1.5 whitespace-nowrap text-xs">
          <span className="text-muted-foreground">{N.loadError}</span>
          <button type="button" onClick={retry} className="underline-offset-4 hover:underline">
            {N.retry}
          </button>
        </span>
      )}

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
