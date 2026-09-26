// Database health snapshot — admin-only diagnostics (admin.config).
//
// Deliberately reads Postgres catalog statistics (pg_stat_user_tables,
// pg_stat_database) instead of `COUNT(*)` per table: catalog stats are
// maintained incrementally by the server and cost a metadata lookup, not a
// table scan, so this stays cheap no matter how large the tables grow.
// The result is not actor-specific, so it is safe to cache across all
// admins with `unstable_cache` — the page calling this must still call
// `authorize()` itself before rendering anything from it.
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "~/server/db";

export interface TableHealth {
  readonly name: string;
  readonly label: string;
  readonly rowEstimate: number;
  readonly totalBytes: number;
}

export interface DatabaseHealth {
  readonly generatedAt: string;
  readonly databaseSizeBytes: number;
  readonly postgresVersion: string;
  readonly activeConnections: number;
  readonly uptimeSeconds: number;
  readonly cacheHitRatio: number | null;
  readonly totalRowEstimate: number;
  readonly tables: readonly TableHealth[];
  readonly otherTables: {
    readonly count: number;
    readonly rowEstimate: number;
    readonly totalBytes: number;
  };
}

export const DB_HEALTH_CACHE_TAG = "db-health";

// Business-relevant tables surfaced individually, in display order. `name`
// is the actual Postgres relation name (models with `@@map(...)` in the
// schema, e.g. User/AuditEvent, are snake_case — see prisma/schema/identity.prisma).
// Anything not listed here is rolled up into `otherTables` rather than
// growing this page every time a new model is added to the schema.
const FEATURED_TABLES: readonly { name: string; label: string }[] = [
  { name: "user", label: "المستخدمون" },
  { name: "Customer", label: "العملاء" },
  { name: "Order", label: "الطلبات" },
  { name: "WorkItem", label: "عناصر العمل" },
  { name: "Payment", label: "المدفوعات" },
  { name: "Expense", label: "المصروفات" },
  { name: "FileAsset", label: "الملفات" },
  { name: "audit_event", label: "سجل التدقيق" },
];

async function loadDatabaseHealth(): Promise<DatabaseHealth> {
  const [tableStats, dbSizeRows, versionRows, connRows, uptimeRows, cacheRows] =
    await Promise.all([
      db.$queryRaw<{ table_name: string; row_estimate: bigint; total_bytes: bigint }[]>`
        SELECT relname AS table_name,
               GREATEST(n_live_tup, 0)::bigint AS row_estimate,
               pg_total_relation_size(relid)::bigint AS total_bytes
        FROM pg_stat_user_tables
        -- This is a Supabase-hosted Postgres instance: pg_stat_user_tables
        -- also carries Supabase's own auth/storage/realtime/vault schemas
        -- (~40 tables, mostly empty). Restricting to 'public' keeps this
        -- page scoped to Printex's own application data.
        WHERE schemaname = 'public'
      `,
      db.$queryRaw<{ size: bigint }[]>`
        SELECT pg_database_size(current_database())::bigint AS size
      `,
      db.$queryRaw<{ version: string }[]>`SELECT version() AS version`,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `,
      db.$queryRaw<{ started_at: Date }[]>`
        SELECT pg_postmaster_start_time() AS started_at
      `,
      db.$queryRaw<{ hits: bigint; reads: bigint }[]>`
        SELECT sum(blks_hit)::bigint AS hits, sum(blks_read)::bigint AS reads
        FROM pg_stat_database
        WHERE datname = current_database()
      `,
    ]);

  const statsByName = new Map(tableStats.map((row) => [row.table_name, row]));

  const tables: TableHealth[] = FEATURED_TABLES.map(({ name, label }) => {
    const row = statsByName.get(name);
    return {
      name,
      label,
      rowEstimate: Number(row?.row_estimate ?? 0n),
      totalBytes: Number(row?.total_bytes ?? 0n),
    };
  });

  const featuredNames = new Set(FEATURED_TABLES.map((t) => t.name));
  let otherCount = 0;
  let otherRows = 0n;
  let otherBytes = 0n;
  let totalRows = 0n;
  for (const row of tableStats) {
    totalRows += row.row_estimate;
    if (!featuredNames.has(row.table_name)) {
      otherCount += 1;
      otherRows += row.row_estimate;
      otherBytes += row.total_bytes;
    }
  }

  const hits = Number(cacheRows[0]?.hits ?? 0n);
  const reads = Number(cacheRows[0]?.reads ?? 0n);
  const cacheHitRatio = hits + reads > 0 ? hits / (hits + reads) : null;

  const startedAt = uptimeRows[0]?.started_at;
  const uptimeSeconds = startedAt
    ? Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000)
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    databaseSizeBytes: Number(dbSizeRows[0]?.size ?? 0n),
    postgresVersion: (versionRows[0]?.version ?? "unknown").split(" on ")[0] ?? "unknown",
    activeConnections: Number(connRows[0]?.count ?? 0n),
    uptimeSeconds,
    cacheHitRatio,
    totalRowEstimate: Number(totalRows),
    tables,
    otherTables: { count: otherCount, rowEstimate: Number(otherRows), totalBytes: Number(otherBytes) },
  };
}

// Cached for 60s across all requests/admins — a health page is read far more
// often than the underlying counts meaningfully change, and this keeps every
// page view from re-hitting Postgres.
export const getDatabaseHealth = unstable_cache(loadDatabaseHealth, ["db-health"], {
  revalidate: 60,
  tags: [DB_HEALTH_CACHE_TAG],
});

export async function refreshDatabaseHealth(): Promise<void> {
  revalidateTag(DB_HEALTH_CACHE_TAG);
}
