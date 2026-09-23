// Admin Audit Log page — 001-identity-access-audit (T033).
// Read-only Server Component: no "use client", no mutations, no Server Actions. Filters via plain GET <form>.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

// ── Input class (same recipe as users/page.tsx) ────────────────────────────
const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// ── Page Component ─────────────────────────────────────────────────────────

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  authorize(actor, "audit.view");

  const params = await searchParams;

  // Narrow each param: treat string[] or undefined as "no filter".
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

  // Build Prisma where clause incrementally.
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

  // Date range — skip any bound that fails to parse.
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

  // Simple cap at 200 rows — not real pagination (pagination is out of scope for T033).
  const events = await db.auditEvent.findMany({
    where,
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{S.adminAuditPageTitle}</h1>

      {/* ── Filter Form ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6">
        <form className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Entity Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.auditFilterEntityType}
              </label>
              <input
                name="entityType"
                type="text"
                defaultValue={
                  typeof params.entityType === "string" ? params.entityType : ""
                }
                className={inputCls}
                placeholder={S.auditFilterEntityType}
              />
            </div>

            {/* Entity ID */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.auditFilterEntityId}
              </label>
              <input
                name="entityId"
                type="text"
                defaultValue={
                  typeof params.entityId === "string" ? params.entityId : ""
                }
                className={inputCls}
                placeholder={S.auditFilterEntityId}
              />
            </div>

            {/* Actor (username filter) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.auditFilterActor}
              </label>
              <input
                name="actor"
                type="text"
                defaultValue={
                  typeof params.actor === "string" ? params.actor : ""
                }
                className={inputCls}
                placeholder={S.auditFilterActor}
              />
            </div>

            {/* Action */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.auditFilterAction}
              </label>
              <input
                name="action"
                type="text"
                defaultValue={
                  typeof params.action === "string" ? params.action : ""
                }
                className={inputCls}
                placeholder={S.auditFilterAction}
              />
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.auditFilterDateFrom}
              </label>
              <input
                name="dateFrom"
                type="date"
                defaultValue={
                  typeof params.dateFrom === "string" ? params.dateFrom : ""
                }
                className={inputCls}
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.auditFilterDateTo}
              </label>
              <input
                name="dateTo"
                type="date"
                defaultValue={
                  typeof params.dateTo === "string" ? params.dateTo : ""
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="default">
              {S.auditFilterSubmitButton}
            </Button>
            <a
              href="/admin/audit"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {S.auditFilterClearButton}
            </a>
          </div>
        </form>
      </section>

      {/* ── Audit Events Table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">
                {S.tableHeaderDate}
              </th>
              <th className="px-4 py-3 text-start font-medium">
                {S.tableHeaderAction}
              </th>
              <th className="px-4 py-3 text-start font-medium">
                {S.tableHeaderEntity}
              </th>
              <th className="px-4 py-3 text-start font-medium">
                {S.tableHeaderActor}
              </th>
              <th className="px-4 py-3 text-start font-medium">
                {S.tableHeaderDetails}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.length === 0 ? (
              <tr className="bg-card">
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  {S.auditNoResults}
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="bg-card hover:bg-muted/30">
                  {/* Date */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {event.createdAt.toLocaleString("ar-EG")}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 font-medium">
                    <span className="font-mono text-xs">{event.action}</span>
                  </td>

                  {/* Entity */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {event.entityType} / {event.entityId}
                  </td>

                  {/* Actor */}
                  <td className="px-4 py-3">
                    {event.actor
                      ? (event.actor.displayUsername ?? event.actor.username)
                      : S.auditUnknownActor}
                  </td>

                  {/* Details — native disclosure, no client JS */}
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs text-primary">
                        {S.tableHeaderDetails}
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        {event.reason !== null && event.reason !== undefined && (
                          <p className="text-xs">
                            <span className="font-medium">
                              {S.auditDetailReason}:{" "}
                            </span>
                            {event.reason}
                          </p>
                        )}
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {S.auditDetailBefore}
                            </span>
                            <pre className="max-w-xs overflow-x-auto rounded bg-muted p-2 text-xs">
                              {event.before !== null && event.before !== undefined
                                ? JSON.stringify(event.before, null, 2)
                                : "—"}
                            </pre>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {S.auditDetailAfter}
                            </span>
                            <pre className="max-w-xs overflow-x-auto rounded bg-muted p-2 text-xs">
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
  );
}
