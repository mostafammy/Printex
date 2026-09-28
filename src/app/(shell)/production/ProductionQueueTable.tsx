"use client";

/**
 * ProductionQueueTable — client component with infinite scroll.
 *
 * Pagination fix: `handleLoadMore` is a stable function (no deps that change
 * during a fetch). The in-flight guard lives in a ref, not in state captured
 * by useCallback, so the IntersectionObserver never reconnects mid-fetch.
 */

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Calendar,
  Flame,
  FileCheck2,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import type { ProductionQueueRow } from "~/server/production";
import { Button } from "~/components/ui/button";
import { InfiniteScrollSentinel } from "~/components/infinite-scroll-sentinel";
import { loadMoreProductionQueueAction } from "./actions";
import ar from "~/messages/ar.json";

const S = ar.ui;

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-EG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function ProductionQueueTable({
  initialRows,
  initialNextCursor,
  totalCount,
}: {
  readonly initialRows: readonly ProductionQueueRow[];
  readonly initialNextCursor: number | null;
  readonly totalCount: number;
}) {
  const [rows, setRows] = useState<readonly ProductionQueueRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);

  // Ref-based in-flight guard: stable across renders, no observer reconnection.
  const isFetchingRef = useRef(false);
  const nextCursorRef = useRef(initialNextCursor);
  nextCursorRef.current = nextCursor;

  // Stable callback — no deps that change during fetch (uses refs for live values).
  const handleLoadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursorRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await loadMoreProductionQueueAction(nextCursorRef.current);
      setRows((prev) => [...prev, ...result.rows]);
      setNextCursor(result.nextCursor);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card shadow-xs flex flex-col items-center justify-center p-12 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-500/15 to-indigo-500/15 text-blue-600 border border-blue-500/20 shadow-xs">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground">{S.productionQueueEmpty}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground leading-relaxed">
          جميع مهام وأوامر التشغيل في خط الإنتاج مكتملة حالياً.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
              <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderCustomer}</th>
              <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderProduct}</th>
              <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderEnteredQueue}</th>
              <th className="px-5 py-4 text-start">{S.productionQueueTableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr
                key={row.workItemId}
                className={`group transition-all duration-200 ${
                  row.priority === "URGENT"
                    ? "bg-rose-500/[0.02] hover:bg-muted/40 shadow-[inset_3px_0_0_#ff3b30]"
                    : "hover:bg-muted/40"
                }`}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-500/15 to-indigo-500/15 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs">
                      {row.customerName.charAt(0) || "ع"}
                    </div>
                    <div>
                      <Link
                        href={`/orders/${row.orderId}`}
                        className="group/link flex items-center gap-1.5 font-bold text-foreground hover:text-primary transition-colors text-sm"
                      >
                        <span>{row.customerName}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-100" />
                      </Link>
                      <div className="mt-0.5 inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                        #{row.orderNumber}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/60 px-3 py-1 text-xs font-semibold text-foreground shadow-2xs">
                    {row.productTypeName ?? S.myQueueNoProductType}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.priority === "URGENT" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500/15 to-orange-500/15 border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-2xs">
                        <Flame className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                        <span>{S.badgeUrgent}</span>
                      </span>
                    )}
                    {row.hasPendingFileRevision && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 shadow-2xs">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        <span>{S.badgeRevisedFile}</span>
                      </span>
                    )}
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{formatDate(row.enteredQueueAt)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Button
                    variant="default"
                    size="sm"
                    className="font-bold shadow-sm hover:-translate-y-0.5"
                    render={<Link href={`/production/${row.workItemId}`} />}
                  >
                    <span>{S.productionQueueOpenButton}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border/70 px-4 py-2">
        <InfiniteScrollSentinel
          hasMore={nextCursor !== null}
          isLoading={isLoading}
          onLoadMore={handleLoadMore}
          endMessage={`تم عرض جميع أوامر التشغيل (${rows.length} من إجمالي ${totalCount})`}
        />
      </div>
    </div>
  );
}
