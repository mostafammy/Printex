// Admin Audit Log page — 001-identity-access-audit (T033).
// Read-only Server Component: no "use client", no mutations, no Server Actions. Filters via plain GET <form>.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { History, Filter, X, ChevronDown, User } from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-xs text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  authorize(actor, "audit.view");

  const params = await searchParams;

  const entityType =
    typeof params.entityType === "string" && params.entityType !== ""
      ? params.entityType
      : undefined;
  const entityId =
    typeof params.entityId === "string" && params.entityId !== ""
      ? params.entityId
      : undefined;
  const actorFilter =
    typeof params.actor === "string" && params.actor !== ""
      ? params.actor
      : undefined;
  const action =
    typeof params.action === "string" && params.action !== ""
      ? params.action
      : undefined;
  const dateFrom =
    typeof params.dateFrom === "string" && params.dateFrom !== ""
      ? params.dateFrom
      : undefined;
  const dateTo =
    typeof params.dateTo === "string" && params.dateTo !== ""
      ? params.dateTo
      : undefined;

  const where: {
    entityType?: { contains: string; mode: "insensitive" };
    entityId?: { equals: string };
    action?: { contains: string; mode: "insensitive" };
    actor?: { username: { contains: string; mode: "insensitive" } };
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (entityType !== undefined) {
    where.entityType = { contains: entityType, mode: "insensitive" };
  }
  if (entityId !== undefined) {
    where.entityId = { equals: entityId };
  }
  if (action !== undefined) {
    where.action = { contains: action, mode: "insensitive" };
  }
  if (actorFilter !== undefined) {
    where.actor = { username: { contains: actorFilter, mode: "insensitive" } };
  }

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (dateFrom !== undefined) {
    const d = new Date(dateFrom);
    if (!isNaN(d.getTime())) createdAtFilter.gte = d;
  }
  if (dateTo !== undefined) {
    const d = new Date(dateTo);
    if (!isNaN(d.getTime())) createdAtFilter.lte = d;
  }
  if (createdAtFilter.gte !== undefined || createdAtFilter.lte !== undefined) {
    where.createdAt = createdAtFilter;
  }

  const events = await db.auditEvent.findMany({
    where,
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero Admin Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-indigo-500/10 to-purple-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25">
            <History className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {S.adminAuditPageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              سجل التدقيق والمراقبة المباشر لجميع العمليات الحساسة في النظام
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter Form Card ── */}
      <section className="apple-card p-6 sm:p-7">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">خيارات الفلترة والبحث المتقدم</h2>
        </div>

        <form className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">
                {S.auditFilterEntityType}
              </label>
              <input
                name="entityType"
                type="text"
                defaultValue={typeof params.entityType === "string" ? params.entityType : ""}
                className={inputCls}
                placeholder="نوع الكيان..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">
                {S.auditFilterEntityId}
              </label>
              <input
                name="entityId"
                type="text"
                defaultValue={typeof params.entityId === "string" ? params.entityId : ""}
                className={inputCls}
                placeholder="معرف الكيان..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">
                {S.auditFilterActor}
              </label>
              <input
                name="actor"
                type="text"
                defaultValue={typeof params.actor === "string" ? params.actor : ""}
                className={inputCls}
                placeholder="اسم المستخدم..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">
                {S.auditFilterAction}
              </label>
              <input
                name="action"
                type="text"
                defaultValue={typeof params.action === "string" ? params.action : ""}
                className={inputCls}
                placeholder="نوع العملية..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">
                {S.auditFilterDateFrom}
              </label>
              <input
                name="dateFrom"
                type="date"
                defaultValue={typeof params.dateFrom === "string" ? params.dateFrom : ""}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-2xs font-semibold text-muted-foreground">
                {S.auditFilterDateTo}
              </label>
              <input
                name="dateTo"
                type="date"
                defaultValue={typeof params.dateTo === "string" ? params.dateTo : ""}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" variant="default" size="sm">
              <Filter className="h-3.5 w-3.5" />
              <span>{S.auditFilterSubmitButton}</span>
            </Button>
            <a
              href="/admin/audit"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>{S.auditFilterClearButton}</span>
            </a>
          </div>
        </form>
      </section>

      {/* ── Audit Events Table Card ── */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderDate}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderAction}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderEntity}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderActor}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderDetails}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    {S.auditNoResults}
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                      {event.createdAt.toLocaleString("ar-EG")}
                    </td>

                    <td className="px-5 py-3.5 font-bold text-foreground">
                      <span className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-2xs font-semibold">
                        {event.action}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground">
                      {event.entityType} / <span className="font-mono">{event.entityId}</span>
                    </td>

                    <td className="px-5 py-3.5 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {event.actor
                            ? (event.actor.displayUsername ?? event.actor.username)
                            : S.auditUnknownActor}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <details className="group">
                        <summary className="cursor-pointer text-2xs font-semibold text-primary hover:underline list-none flex items-center gap-1">
                          <span>{S.tableHeaderDetails}</span>
                          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 max-w-sm">
                          {event.reason !== null && event.reason !== undefined && (
                            <p className="text-2xs">
                              <strong className="font-semibold text-foreground">{S.auditDetailReason}: </strong>
                              <span className="text-muted-foreground">{event.reason}</span>
                            </p>
                          )}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-2xs font-bold text-muted-foreground">{S.auditDetailBefore}</span>
                              <pre className="overflow-x-auto rounded-lg bg-background p-2 font-mono text-2xs border border-border/50">
                                {event.before !== null && event.before !== undefined
                                  ? JSON.stringify(event.before, null, 2)
                                  : "—"}
                              </pre>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-2xs font-bold text-muted-foreground">{S.auditDetailAfter}</span>
                              <pre className="overflow-x-auto rounded-lg bg-background p-2 font-mono text-2xs border border-border/50">
                                {event.after !== null && event.after !== undefined
                                  ? JSON.stringify(event.after, null, 2)
                                  : "—"}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
