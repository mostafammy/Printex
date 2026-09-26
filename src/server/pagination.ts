// Shared pagination engine.
//
// Originally the identical page/pageSize/take+1/hasMore logic duplicated
// across finance/expenses.ts, finance/payments.ts and finance/costs.ts;
// now the single engine every list/search endpoint in this codebase uses
// instead of fetching a table unbounded.
//
// Design (SOLID):
//   - `PageRequest` / `PageResult` are immutable value objects — construction
//     is the only place raw input is validated/clamped or overfetch is
//     collapsed into a cursor, so no call site re-implements that math
//     (Single Responsibility).
//   - `Paginator<T>` is a small Strategy interface. `OffsetPaginator` is the
//     only implementation today, but a future keyset/cursor-based strategy
//     for a table that outgrows OFFSET can be added as a new class without
//     touching `PageRequest`, `PageResult`, or any existing caller
//     (Open/Closed, Liskov — any `Paginator<T>` is a drop-in substitute).
//   - `OffsetPaginator` depends on an injected `fetchPage` callback, not on
//     Prisma or `~/server/db` (Dependency Inversion) — this file has zero
//     import-time coupling to the database layer, so it's plain, unit-
//     testable pagination math reusable for any `skip`/`take`-shaped source.
//   - `paginateQuery` is the ergonomic entry point call sites actually use:
//     it hides "construct a PageRequest, build an OffsetPaginator, call
//     .paginate()" behind one function call (Interface Segregation — most
//     callers never need to see `Paginator`/`OffsetPaginator` directly).
//
// Usage (Prisma `findMany`):
//   const page = await paginateQuery(input, (skip, take) =>
//     db.user.findMany({ where, orderBy, skip, take }),
//   );
//   return page.map((user) => toDto(user));

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface PageInput {
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Immutable value object: a validated page request. `page`/`pageSize` are
 * clamped once, here, so nothing downstream has to re-validate raw input.
 */
export class PageRequest {
  private constructor(
    public readonly page: number,
    public readonly pageSize: number,
  ) {}

  static of(input: PageInput = {}): PageRequest {
    const pageSize = Math.min(
      Math.max(Math.trunc(input.pageSize ?? DEFAULT_PAGE_SIZE), 1),
      MAX_PAGE_SIZE,
    );
    const page = Math.max(Math.trunc(input.page ?? 1), 1);
    return new PageRequest(page, pageSize);
  }

  /** Pass straight through to Prisma's `skip`. */
  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  /** One extra row over `pageSize`, so `PageResult` can detect `hasMore`
   *  without a second `count()` query. Pass straight through to `take`. */
  get take(): number {
    return this.pageSize + 1;
  }
}

/**
 * Immutable value object: one page of results plus the cursor to the next
 * page, or `null` at the end. `nextCursor` is a plain page number (not an
 * opaque token) — every caller in this codebase renders a `?page=N` link.
 */
export class PageResult<T> {
  private constructor(
    public readonly rows: readonly T[],
    public readonly nextCursor: number | null,
  ) {}

  /** Builds a result from a row array fetched with `request.take`
   *  (i.e. overfetched by one row — see `PageRequest.take`). */
  static fromOverfetch<T>(rows: readonly T[], request: PageRequest): PageResult<T> {
    const hasMore = rows.length > request.pageSize;
    const pageRows = hasMore ? rows.slice(0, request.pageSize) : rows;
    return new PageResult(pageRows, hasMore ? request.page + 1 : null);
  }

  static empty<T>(): PageResult<T> {
    return new PageResult<T>([], null);
  }

  /** Reshapes rows (e.g. Prisma model -> API DTO) without touching the cursor. */
  map<U>(fn: (row: T) => U): PageResult<U> {
    return new PageResult(this.rows.map(fn), this.nextCursor);
  }
}

/**
 * Strategy interface (OCP/DIP): anything that can turn a validated
 * `PageRequest` into a `PageResult`.
 */
export interface Paginator<T> {
  paginate(request: PageRequest): Promise<PageResult<T>>;
}

/**
 * Offset-based strategy — the only one this codebase needs today. Takes
 * ownership of nothing but the fetch callback; all pagination math lives in
 * `PageRequest`/`PageResult`.
 */
export class OffsetPaginator<T> implements Paginator<T> {
  constructor(private readonly fetchPage: (skip: number, take: number) => Promise<T[]>) {}

  async paginate(request: PageRequest): Promise<PageResult<T>> {
    const rows = await this.fetchPage(request.skip, request.take);
    return PageResult.fromOverfetch(rows, request);
  }
}

/**
 * Convenience entry point for the common case — pass everything BUT
 * `skip`/`take`; this builds a one-shot `OffsetPaginator` and runs it.
 */
export async function paginateQuery<T>(
  input: PageInput,
  fetchPage: (skip: number, take: number) => Promise<T[]>,
): Promise<PageResult<T>> {
  const request = PageRequest.of(input);
  return new OffsetPaginator(fetchPage).paginate(request);
}

/**
 * Strategy for a sort key that spans more than one relation/derived value
 * and so can't be expressed as a single Prisma `orderBy` (e.g. this
 * codebase's several "urgent-first, then oldest by a transition timestamp"
 * queues, where "urgent" lives on the related Order and "oldest" is derived
 * from a Work Item's transition history, not a stored column). The full
 * candidate set has to be fetched and sorted in memory before it can be
 * sliced into pages.
 *
 * This is safe ONLY when `fetchAll`'s own filter already keeps the
 * candidate set small (a queue's current backlog, not "every row ever") —
 * it is not a way to paginate an actually-unbounded scan; use
 * `OffsetPaginator` for that.
 */
export class InMemoryPaginator<T> implements Paginator<T> {
  constructor(private readonly fetchAll: () => Promise<T[]>) {}

  async paginate(request: PageRequest): Promise<PageResult<T>> {
    const all = await this.fetchAll();
    const slice = all.slice(request.skip, request.skip + request.take);
    return PageResult.fromOverfetch(slice, request);
  }
}

/** Convenience entry point mirroring `paginateQuery`, for `InMemoryPaginator`. */
export async function paginateInMemory<T>(
  input: PageInput,
  fetchAll: () => Promise<T[]>,
): Promise<PageResult<T>> {
  const request = PageRequest.of(input);
  return new InMemoryPaginator(fetchAll).paginate(request);
}
