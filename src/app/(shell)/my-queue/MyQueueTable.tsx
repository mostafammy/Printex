"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { InfiniteScrollSentinel } from "~/components/infinite-scroll-sentinel";
import { MyQueueRowItem } from "./MyQueueRowItem";
import {
  loadMoreMyQueueAction,
  type MyQueueRowWithDurations,
} from "./actions";
import ar from "~/messages/ar.json";

const S = ar.ui;

export function MyQueueTable({
  initialRowsWithDurations,
  initialNextCursor,
  totalCount,
}: {
  readonly initialRowsWithDurations: readonly MyQueueRowWithDurations[];
  readonly initialNextCursor: number | null;
  readonly totalCount: number;
}) {
  const [items, setItems] = useState<readonly MyQueueRowWithDurations[]>(initialRowsWithDurations);
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);

  // Ref-based in-flight guard: stable across renders, no observer reconnection.
  const isFetchingRef = useRef(false);
  const nextCursorRef = useRef(initialNextCursor);
  nextCursorRef.current = nextCursor;

  // Stable callback — uses refs for live values, so the observer never re-subscribes.
  const handleLoadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursorRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await loadMoreMyQueueAction(nextCursorRef.current);
      setItems((prev) => [...prev, ...result.rows]);
      setNextCursor(result.nextCursor);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card shadow-xs flex flex-col items-center justify-center p-12 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/10 via-indigo-500/10 to-transparent border border-primary/20 shadow-xs">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">{S.myQueueEmpty}</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
          جميع مهامك الحالية منجزة بنجاح. يمكنك استعراض طلبات الاستقبال أو مراجعة الطلبات الجديدة.
        </p>
        <div className="mt-6">
          <Button variant="outline" size="sm" render={<Link href="/reception" />}>
            الانتقال إلى قسم الاستقبال
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
              <th className="px-5 py-4 text-start">{S.myQueueTableHeaderCustomer}</th>
              <th className="px-5 py-4 text-start">{S.myQueueTableHeaderProduct}</th>
              <th className="px-5 py-4 text-start">{S.myQueueTableHeaderDueDate}</th>
              <th className="px-5 py-4 text-start">{S.myQueueTableHeaderStatus}</th>
              <th className="px-5 py-4 text-start">{S.myQueueTableHeaderElapsed}</th>
              <th className="px-5 py-4 text-start">{S.myQueueTableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((item) => (
              <MyQueueRowItem key={item.row.workItemId} item={item} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border/70 px-4 py-2">
        <InfiniteScrollSentinel
          hasMore={nextCursor !== null}
          isLoading={isLoading}
          onLoadMore={handleLoadMore}
          endMessage={`تم عرض جميع المهام (${items.length} من إجمالي ${totalCount})`}
        />
      </div>
    </div>
  );
}
