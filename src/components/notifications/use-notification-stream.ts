"use client";

// The client half of contracts/notification-stream.md §Client contract.
//
// The contract's central claim is that the FALLBACK IS A COMPLETE DELIVERY
// PATH, because delivery is persisted server-side and the stream only signals
// invalidation. So this hook is not a best-effort optimisation with a degraded
// twin — the polling branch is a first-class path that happens to be slower,
// and a user on it loses nothing but immediacy (FR-034, SC-009).
//
// `connected` and `transport` are DISPLAY ONLY. A user on the polling path is
// fully functional; the indicator is not a warning state (FR-030).

import { useCallback, useEffect, useRef, useState } from "react";

export type Transport = "live" | "polling";

export interface UseNotificationStreamOptions {
  /** Re-read list + count through the server. Called on any signal. */
  readonly onNotification: () => void;
  /** The exact unread total, so the bell needs no second request. */
  readonly onCountChange?: (count: number) => void;
  /**
   * Overridable for tests. The production default is the constant the
   * notification-stream contract fixes: a shop LAN does not need it tuned, and
   * one more knob is one more thing to get wrong.
   */
  readonly pollSeconds?: number;
}

export interface UseNotificationStreamResult {
  readonly connected: boolean;
  readonly transport: Transport;
  /** Force a re-read through the server, for the bell's manual refresh. */
  readonly refresh: () => void;
}

const DEFAULT_POLL_SECONDS = 15;

export function useNotificationStream(
  opts: UseNotificationStreamOptions,
): UseNotificationStreamResult {
  const { onNotification, onCountChange, pollSeconds = DEFAULT_POLL_SECONDS } = opts;

  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState<Transport>("polling");

  // Held in refs so the effect's dependencies stay stable. A `useCallback`
  // parent that changes identity every render would otherwise tear down and
  // rebuild the stream on every render — reconnecting constantly, and
  // hammering the server on a LAN that is meant to be quiet.
  const onNotificationRef = useRef(onNotification);
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onNotificationRef.current = onNotification;
    onCountChangeRef.current = onCountChange;
  });

  // Polling is active whenever the transport is "polling" OR the stream has
  // not yet come up. Starting in "polling" means the very first load already
  // has a working path, and the stream is an upgrade on top of it rather than
  // a prerequisite.
  const pollActive = transport === "polling";

  useEffect(() => {
    if (!pollActive) return;

    const tick = () => {
      onNotificationRef.current();
    };
    const interval = setInterval(tick, pollSeconds * 1000);
    return () => clearInterval(interval);
  }, [pollActive, pollSeconds]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      // No SSE in this browser at all. Polling already covers it.
      return;
    }

    let source: EventSource | null = null;
    let closed = false;

    const open = () => {
      if (closed) return;
      source = new EventSource("/api/notifications/stream");

      source.addEventListener("ready", () => {
        setConnected(true);
        setTransport("live");
      });

      source.addEventListener("notification", () => {
        // The payload carries identifiers and severity only. The client
        // re-reads through the server, so the read path stays the single
        // authority for content and scope (constitution V).
        onNotificationRef.current();
      });

      source.addEventListener("count", (event) => {
        try {
          // EventSource's listener payload is untyped, so `data` is narrowed
          // to a string before parsing rather than trusting the cast.
          const raw: unknown = event.data;
          if (typeof raw !== "string") return;
          const parsed: unknown = JSON.parse(raw);
          if (typeof parsed !== "object" || parsed === null || !("count" in parsed)) return;
          // The `in` check above already narrows `count`; no cast needed.
          const count: unknown = parsed.count;
          if (typeof count === "number") onCountChangeRef.current?.(count);
        } catch {
          // A malformed frame is not worth surfacing: the next poll produces
          // the correct count anyway.
        }
      });

      source.onerror = () => {
        // FR-029/FR-030: ANY stream error falls back to polling. EventSource
        // reconnects on its own, so the transport flips back to "live" if it
        // recovers; nothing here tries to manage that.
        setConnected(false);
        setTransport("polling");
      };
    };

    open();

    return () => {
      closed = true;
      source?.close();
    };
  }, []);

  // A tab waking from sleep should show current data immediately rather than
  // waiting out the poll interval — otherwise a receptionist who locks their
  // screen at lunch comes back to a stale bell (contract §Client contract 4).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") onNotificationRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const refresh = useCallback(() => onNotificationRef.current(), []);

  return { connected, transport, refresh };
}
