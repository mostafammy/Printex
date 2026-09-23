// Admin Roles page — 001-identity-access-audit (T026).
// Read-only: displays roles and their associated permissions.
// Server Component: no "use client", no Server Actions needed.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

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
      <h1 className="text-xl font-semibold">{S.adminRolesPageTitle}</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderRoleName}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderPermissions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roles.map((role) => (
              <tr key={role.id} className="bg-card hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{role.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.length > 0 ? (
                      role.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground"
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
  );
}
