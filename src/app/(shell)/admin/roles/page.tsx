// Admin Roles page — 001-identity-access-audit (T026).
// Read-only: displays roles and their associated permissions.
// Server Component: no "use client", no Server Actions needed.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { Shield, KeyRound } from "lucide-react";
import { getActor, authorize } from "~/server/auth";
import { listRolesWithPermissions } from "~/server/admin/roles";
import ar from "~/messages/ar.json";

const S = ar.ui;

export default async function AdminRolesPage() {
  const actor = await getActor();
  authorize(actor, "admin.users");

  const roles = await listRolesWithPermissions(actor);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero Admin Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-indigo-500/10 to-purple-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25">
            <Shield className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {S.adminRolesPageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              الأدوار الوظيفية والصلاحيات الممنوحة لكل دور داخل نظام Printex
            </p>
          </div>
        </div>
      </div>

      {/* ── Roles Table Card ── */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderRoleName}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderPermissions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {roles.map((role) => (
                <tr key={role.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-4 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-primary" />
                      <span>{role.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.length > 0 ? (
                        role.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 font-mono text-2xs font-semibold text-foreground shadow-2xs"
                          >
                            {perm}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
