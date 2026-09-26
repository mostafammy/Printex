// Admin Database Health page — single-glance snapshot of table volumes and
// Postgres vitals, built for a customer demo: accurate, cheap to render, and
// as simple as it can be while still looking like real engineering.
// Read-only Server Component; the only mutation is the "Refresh" button,
// which is a plain server action that busts the 60s cache (see
// `~/server/admin/health`), not a database write.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import {
  HeartPulse,
  Database,
  Gauge,
  Server,
  Clock,
  RefreshCw,
  Layers,
} from "lucide-react";
import { getActor, authorize } from "~/server/auth";
import { getDatabaseHealth, refreshDatabaseHealth } from "~/server/admin/health";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 ميجابايت";
  const units = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت", "تيرابايت"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${units[exponent]}`;
}

function formatCount(n: number): string {
  return n.toLocaleString("ar-EG");
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days} يوم و${hours} ساعة`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} ساعة و${minutes} دقيقة`;
  return `${minutes} دقيقة`;
}

function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "الآن";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  return `منذ ${hours} ساعة`;
}

const TABLE_COLORS = [
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-blue-500",
  "bg-slate-500",
];

export default async function AdminHealthPage() {
  const actor = await getActor();
  authorize(actor, "admin.config");

  const health = await getDatabaseHealth();

  const cacheHitLabel =
    health.cacheHitRatio === null ? "—" : `${(health.cacheHitRatio * 100).toFixed(1)}٪`;

  const stats = [
    {
      label: "إجمالي السجلات",
      value: formatCount(health.totalRowEstimate),
      icon: Layers,
      color: "from-indigo-500 to-purple-600",
    },
    {
      label: "حجم قاعدة البيانات",
      value: formatBytes(health.databaseSizeBytes),
      icon: Database,
      color: "from-cyan-500 to-blue-600",
    },
    {
      label: "نسبة إصابة الذاكرة المؤقتة",
      value: cacheHitLabel,
      icon: Gauge,
      color: "from-emerald-500 to-teal-600",
    },
    {
      label: "الاتصالات النشطة",
      value: formatCount(health.activeConnections),
      icon: Server,
      color: "from-amber-500 to-orange-600",
    },
    {
      label: "مدة التشغيل",
      value: formatUptime(health.uptimeSeconds),
      icon: Clock,
      color: "from-rose-500 to-pink-600",
    },
  ];

  const maxBytes = Math.max(1, ...health.tables.map((t) => t.totalBytes), health.otherTables.totalBytes);

  async function refresh() {
    "use server";
    await refreshDatabaseHealth();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-emerald-500/10 to-cyan-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-cyan-600 text-white shadow-md shadow-emerald-500/25">
              <HeartPulse className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {S.adminHealthPageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">
                لمحة سريعة عن حجم البيانات وصحة قاعدة بيانات Printex — {health.postgresVersion}
              </p>
              <p className="text-2xs text-muted-foreground/70">
                آخر تحديث: {formatRelativeTime(health.generatedAt)}
              </p>
            </div>
          </div>

          <form action={refresh}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>تحديث البيانات</span>
            </Button>
          </form>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="apple-card flex flex-col gap-3 p-5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br ${stat.color} text-white shadow-sm`}
            >
              <stat.icon className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold tracking-tight text-foreground">{stat.value}</span>
              <span className="text-2xs font-medium text-muted-foreground">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Breakdown Card ── */}
      <div className="apple-card overflow-hidden p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">حجم البيانات حسب الجدول</h2>
        </div>

        <div className="flex flex-col gap-4">
          {health.tables.map((table, i) => (
            <div key={table.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{table.label}</span>
                <span className="text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">
                    {formatCount(table.rowEstimate)}
                  </span>{" "}
                  سجل · {formatBytes(table.totalBytes)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={`h-full rounded-full ${TABLE_COLORS[i % TABLE_COLORS.length]}`}
                  style={{ width: `${Math.max(2, (table.totalBytes / maxBytes) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          {health.otherTables.count > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">
                  جداول أخرى ({formatCount(health.otherTables.count)})
                </span>
                <span className="text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">
                    {formatCount(health.otherTables.rowEstimate)}
                  </span>{" "}
                  سجل · {formatBytes(health.otherTables.totalBytes)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-muted-foreground/40"
                  style={{
                    width: `${Math.max(2, (health.otherTables.totalBytes / maxBytes) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
