// Shared pagination control for every list page backed by
// `~/server/pagination`'s PageResult (page + nextCursor). Renders through
// the shadcn pagination primitives (~/components/ui/pagination) instead of
// each page hand-rolling its own "next page" link — one Prev/Next/numbered
// bar, one place to fix RTL icon direction or styling.
//
// Server Component-safe: no "use client", no onClick — every control is a
// plain <Link>/<span> styled with the primitives' own `cva` variant
// functions, since every page.tsx this backs is itself a Server Component
// navigating via `?page=N` searchParams, not client state.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationEllipsis } from "~/components/ui/pagination";
import {
  paginationItemVariants,
  paginationNavVariants,
} from "~/components/ui/pagination-variants";
import { cn } from "~/lib/utils";

type PaginationBarProps = {
  /** Route path, no query string (e.g. "/reception"). */
  readonly basePath: string;
  readonly page: number;
  /** From `PageResult.nextCursor !== null` — required even when `totalPages` is known. */
  readonly hasNextPage: boolean;
  /**
   * Total page count, when the caller already has a cheap total row count
   * (e.g. a stats query it fetches anyway). Renders full numbered pages
   * with ellipsis. Omit to render a Previous/Next-only bar — still a
   * (working) previous button, which the old single "next page" link never had.
   */
  readonly totalPages?: number;
  /** Extra query params to preserve across page links (active filters, etc). */
  readonly query?: Readonly<Record<string, string | undefined>>;
};

function buildHref(basePath: string, page: number, query?: Readonly<Record<string, string | undefined>>) {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Same ellipsis-collapsing window as the component's own reference demo, minus device-width branching (server-rendered, no `matchMedia`). */
function visiblePages(page: number, totalPages: number): (number | "ellipsis")[] {
  const delta = 1;
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];
  let start = Math.max(2, page - delta);
  let end = Math.min(totalPages - 1, page + delta);

  if (page <= 2) {
    end = Math.min(totalPages - 1, 1 + delta * 2);
  } else if (page >= totalPages - 1) {
    start = Math.max(2, totalPages - delta * 2);
  }

  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("ellipsis");
  if (totalPages > 1) pages.push(totalPages);

  return pages;
}

export function PaginationBar({ basePath, page, hasNextPage, totalPages, query }: PaginationBarProps) {
  const hasPrevPage = page > 1;
  if (!hasPrevPage && !hasNextPage && (totalPages === undefined || totalPages <= 1)) return null;

  const href = (p: number) => buildHref(basePath, p, query);

  // RTL (Arabic UI): "next" reads forward as pointing start-ward — ChevronLeft
  // for next, ChevronRight for previous, matching every other next-page link
  // already in this codebase (reception/review/admin-users/price-lists).
  const prevControl = hasPrevPage ? (
    <Link href={href(page - 1)} className={paginationNavVariants({})}>
      <ChevronRight className="h-4 w-4" />
      السابق
    </Link>
  ) : (
    <span className={cn(paginationNavVariants({}), "pointer-events-none opacity-40")} aria-disabled>
      <ChevronRight className="h-4 w-4" />
      السابق
    </span>
  );

  const nextControl = hasNextPage ? (
    <Link href={href(page + 1)} className={paginationNavVariants({})}>
      التالي
      <ChevronLeft className="h-4 w-4" />
    </Link>
  ) : (
    <span className={cn(paginationNavVariants({}), "pointer-events-none opacity-40")} aria-disabled>
      التالي
      <ChevronLeft className="h-4 w-4" />
    </span>
  );

  return (
    <Pagination className="flex-wrap">
      {prevControl}
      {totalPages !== undefined &&
        visiblePages(page, totalPages).map((p, index) =>
          p === "ellipsis" ? (
            <PaginationEllipsis key={`ellipsis-${index}`} />
          ) : (
            <Link
              key={p}
              href={href(p)}
              aria-current={p === page ? "page" : undefined}
              className={paginationItemVariants({ state: p === page ? "active" : "default" })}
            >
              {p}
            </Link>
          ),
        )}
      {nextControl}
    </Pagination>
  );
}
