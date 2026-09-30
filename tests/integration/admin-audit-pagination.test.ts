// tests/integration/admin-audit-pagination.test.ts — 092 T056.
//
// investigation §7.8 / T056 acceptance: `/admin/audit` stopped loading 200
// joined rows unpaginated and now routes through `~/server/pagination`:
//   1. one fetch returns AT MOST one page of rows (skip/take+1 overfetch,
//      no `take: 200` anywhere in the page source);
//   2. `?page=N` reaches strictly older rows, disjoint from page 1;
//   3. filters reach BOTH the page query and the count, only matching rows
//      render, page links preserve every filter, the clear link resets all.
//
// The page's `~/server/db` is mocked (vi.mock factory pattern from
// tests/integration/*): the mock implements `skip`/`take` slicing over a
// fixture so the assertions prove PageRequest math + filter pass-through
// without seeding the shared test DB (and without touching the
// audit-append-only contract surface). `~/server/auth` is mocked because
// `getActor()` needs a Next request context the test process has none of.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("~/server/auth", () => ({
  getActor: vi.fn(async () => ({ userId: "audit-page-test-actor" })),
  authorize: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    auditEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { db } from "~/server/db";
import AdminAuditPage from "~/app/(shell)/admin/audit/page";
import { PaginationBar } from "~/components/pagination-bar";
import { DEFAULT_PAGE_SIZE } from "~/server/pagination";

const findMany = db.auditEvent.findMany as unknown as Mock;
const count = db.auditEvent.count as unknown as Mock;

// ── Fixture ────────────────────────────────────────────────────────────────

interface FixtureRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  before: null;
  after: null;
  createdAt: Date;
  actor: { username: string } | null;
}

/** 30 rows, createdAt strictly descending — ids 01..30, newest first. */
const FIXTURE: FixtureRow[] = Array.from({ length: 30 }, (_, i) => ({
  id: `audit-evt-${String(i + 1).padStart(2, "0")}`,
  // First 26 rows share one action so the filtered count (26) exceeds one
  // page (25) and the pagination bar must render with filters attached.
  action: i + 1 <= 26 ? "evtaction.match" : "evtaction.other",
  entityType: "T056Audit",
  entityId: `ent-${i + 1}`,
  reason: null,
  before: null,
  after: null,
  createdAt: new Date(Date.UTC(2026, 8, 30, 12, 0, 0) - i * 60_000),
  actor: null,
}));

/** Minimal matcher for exactly the `where` shapes this page builds. */
function matchesWhere(row: FixtureRow, where: Record<string, any> | undefined): boolean {
  if (!where) return true;
  const contains = (haystack: string | null | undefined, needle?: string) =>
    needle === undefined ||
    (haystack ?? "").toLowerCase().includes(String(needle).toLowerCase());
  if (typeof where.entityType === "object" && !contains(row.entityType, where.entityType?.contains))
    return false;
  if (typeof where.action === "object" && !contains(row.action, where.action?.contains))
    return false;
  if (typeof where.entityId === "string" && row.entityId !== where.entityId) return false;
  if (
    typeof where.actor === "object" &&
    !contains(row.actor?.username, where.actor?.username?.contains)
  )
    return false;
  if (typeof where.createdAt === "object") {
    if (where.createdAt?.gte && row.createdAt < where.createdAt.gte) return false;
    if (where.createdAt?.lte && row.createdAt > where.createdAt.lte) return false;
  }
  return true;
}

const filtered = (where?: Record<string, any>) =>
  FIXTURE.filter((row) => matchesWhere(row, where));

// ── React element-tree walk (the page returns JSX, nothing renders) ───────

type Elem = { type: unknown; key: string | null; props: Record<string, any> };

function isElement(node: unknown): node is Elem {
  return (
    typeof node === "object" &&
    node !== null &&
    "$$typeof" in node &&
    "props" in node &&
    "type" in node
  );
}

function walk(node: unknown, visit: (el: Elem) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!isElement(node)) return;
  visit(node);
  walk(node.props?.children, visit);
}

/** Event rows are the only keyed `<tr>`s (header/empty rows are unkeyed). */
function eventRows(tree: unknown): Elem[] {
  const rows: Elem[] = [];
  walk(tree, (el) => {
    if (el.type === "tr" && el.key !== null) rows.push(el);
  });
  return rows;
}

function hrefs(tree: unknown): string[] {
  const out: string[] = [];
  walk(tree, (el) => {
    if (typeof el.props?.href === "string") out.push(el.props.href);
    // The bar is a child Server Component — the tree only holds the
    // unexecuted element, so run it to reach its <Link> hrefs.
    if (el.type === PaginationBar) {
      const rendered = (el.type as unknown as (p: unknown) => unknown)(el.props);
      out.push(...hrefs(rendered));
    }
  });
  return out;
}

function render(searchParams: Record<string, string | undefined>) {
  return AdminAuditPage({ searchParams: Promise.resolve(searchParams) });
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  findMany.mockReset().mockImplementation(async (args: any) => {
    const skip = args?.skip ?? 0;
    const take = args?.take ?? FIXTURE.length;
    return filtered(args?.where).slice(skip, skip + take);
  });
  count.mockReset().mockImplementation(async (args: any) => filtered(args?.where).length);
});

describe("admin/audit server-side pagination (T056)", () => {
  it("one fetch returns at most one page of rows — PageRequest overfetch, no take:200", async () => {
    const tree = await render({ entityType: "T056Audit" });
    const rows = eventRows(tree);

    expect(rows.length).toBe(DEFAULT_PAGE_SIZE);
    expect(rows.length).toBeLessThanOrEqual(DEFAULT_PAGE_SIZE);
    expect(rows.map((r) => r.key)).toEqual(
      FIXTURE.slice(0, DEFAULT_PAGE_SIZE).map((r) => r.id),
    );

    // Exactly one page query, overfetched by exactly one row for hasMore.
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0]![0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(DEFAULT_PAGE_SIZE + 1);
    // One count, carrying the SAME filter as the page query.
    expect(count).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0]![0].where).toEqual(args.where);

    // Source-level: the old unpaginated 200-row load is gone.
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/admin/audit/page.tsx"),
      "utf8",
    );
    expect(source).toContain("paginateQuery");
    expect(source).not.toMatch(/take:\s*200/);
  });

  it("?page=2 reaches strictly older rows, disjoint from page 1", async () => {
    const page1 = eventRows(await render({ entityType: "T056Audit" }));
    findMany.mockClear();
    const page2 = eventRows(await render({ entityType: "T056Audit", page: "2" }));

    const ids1 = page1.map((r) => r.key);
    const ids2 = page2.map((r) => r.key);

    expect(ids1).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(ids2).toHaveLength(FIXTURE.length - DEFAULT_PAGE_SIZE); // 5
    expect(ids2.filter((id) => ids1.includes(id))).toEqual([]);
    // Page 2 holds exactly the OLDER rows, still newest-first within page.
    expect(ids2).toEqual(FIXTURE.slice(DEFAULT_PAGE_SIZE).map((r) => r.id));

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0]![0];
    expect(args.skip).toBe(DEFAULT_PAGE_SIZE);
    expect(args.take).toBe(DEFAULT_PAGE_SIZE + 1);
  });

  it("filters reach both queries, only matching rows render, links keep filters, clear resets", async () => {
    const tree = await render({
      entityType: "T056Audit",
      action: "evtaction.match",
    });
    const rows = eventRows(tree);

    // 26 fixture rows match; one page renders 25 of them.
    expect(rows).toHaveLength(DEFAULT_PAGE_SIZE);
    const matchingIds = filtered({ action: { contains: "evtaction.match" } }).map((r) => r.id);
    expect(new Set(rows.map((r) => r.key)).size).toBe(DEFAULT_PAGE_SIZE);
    for (const row of rows) expect(matchingIds).toContain(row.key);
    // The 4 non-matching rows never render.
    expect(rows.map((r) => r.key)).not.toContain("audit-evt-27");

    const args = findMany.mock.calls[0]![0];
    expect(args.where.entityType).toEqual({ contains: "T056Audit", mode: "insensitive" });
    expect(args.where.action).toEqual({ contains: "evtaction.match", mode: "insensitive" });
    expect(count).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0]![0].where).toEqual(args.where);
    expect(count.mock.calls[0]![0].where.action).toEqual({
      contains: "evtaction.match",
      mode: "insensitive",
    });

    const links = hrefs(tree);
    // Clear-filter link: bare path, no query residue.
    expect(links).toContain("/admin/audit");
    // Next-page link preserves both active filters alongside ?page=2.
    const next = links.find((href) => href.includes("page=2"));
    expect(next).toBeDefined();
    expect(next).toContain("entityType=T056Audit");
    expect(next).toContain("action=evtaction.match");
  });
});
