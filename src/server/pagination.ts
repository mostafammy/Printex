// Shared offset-pagination helper — extracted from the identical page/
// pageSize/take+1/hasMore logic duplicated across finance/expenses.ts,
// finance/payments.ts, and finance/costs.ts (and now reused by orders/
// customers/admin list queries that previously fetched whole tables).
//
// Usage:
//   const { page, pageSize, skip, take } = normalizePage(filter);
//   const rows = await db.x.findMany({ where, skip, take, orderBy });
//   return paginateRows(rows, page, pageSize);

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface PageInput {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedPage {
  readonly page: number;
  readonly pageSize: number;
  /** Pass straight through to Prisma's `skip`. */
  readonly skip: number;
  /** Pass straight through to Prisma's `take` — one extra row over
   *  `pageSize` so `paginateRows` can detect `hasMore` without a second
   *  `count()` query. */
  readonly take: number;
}

export interface PageResult<T> {
  readonly rows: readonly T[];
  readonly nextCursor: number | null;
}

export function normalizePage(input: PageInput): NormalizedPage {
  const pageSize = Math.min(Math.max(input.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(input.page ?? 1, 1);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize + 1 };
}

/** `rows` must have been fetched with `take: pageSize + 1` (i.e. `NormalizedPage.take`). */
export function paginateRows<T>(rows: readonly T[], page: number, pageSize: number): PageResult<T> {
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  return { rows: pageRows, nextCursor: hasMore ? page + 1 : null };
}
