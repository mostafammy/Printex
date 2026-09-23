// Admin Departments page — 001-identity-access-audit (T027).
// Server Component: no "use client". All mutations use inline Server Actions.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import {
  addDepartment,
  renameDepartment,
  deactivateDepartment,
} from "~/server/admin/departments";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

// ── Input class reused from login page recipe ──────────────────────────────
const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// FormDataEntryValue is `string | File`; File has no custom toString(), so
// String(v) trips @typescript-eslint/no-base-to-string. These form fields
// are never files — narrow explicitly instead of coercing.
function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

// ── Server Actions ─────────────────────────────────────────────────────────

async function addDepartmentAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const name = formStr(formData.get("name")).trim();
  if (!name) return;
  await addDepartment(actor, name);
  revalidatePath("/admin/departments");
}

async function renameDepartmentAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const departmentId = formStr(formData.get("departmentId"));
  const newName = formStr(formData.get("newName")).trim();
  if (!departmentId || !newName) return;
  await renameDepartment(actor, departmentId, newName);
  revalidatePath("/admin/departments");
}

async function deactivateDepartmentAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const departmentId = formStr(formData.get("departmentId"));
  await deactivateDepartment(actor, departmentId);
  revalidatePath("/admin/departments");
}

// ── Page Component ─────────────────────────────────────────────────────────

export default async function AdminDepartmentsPage() {
  const actor = await getActor();
  authorize(actor, "admin.config");

  const departments = await db.department.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{S.adminDepartmentsPageTitle}</h1>

      {/* ── Add Department Form ────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">{S.addDepartmentHeading}</h2>
        <form action={addDepartmentAction} className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-sm font-medium text-foreground">
              {S.departmentNameLabel}
            </label>
            <input
              name="name"
              type="text"
              required
              className={inputCls}
              placeholder={S.departmentNameLabel}
            />
          </div>
          <Button type="submit" variant="default">
            {S.addDepartmentButton}
          </Button>
        </form>
      </section>

      {/* ── Departments Table ──────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderDepartmentName}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderDepartmentStatus}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {departments.map((dept) => (
              <tr key={dept.id} className="bg-card hover:bg-muted/30">
                {/* Name */}
                <td className="px-4 py-3 font-medium">{dept.name}</td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={
                      dept.isActive
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }
                  >
                    {dept.isActive ? S.statusActive : S.statusInactive}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-end gap-3">
                    {/* Rename form */}
                    <form action={renameDepartmentAction} className="flex items-end gap-2">
                      <input type="hidden" name="departmentId" value={dept.id} />
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">
                          {S.departmentNameLabel}
                        </label>
                        <input
                          name="newName"
                          type="text"
                          required
                          defaultValue={dept.name}
                          className="w-40 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                        />
                      </div>
                      <Button type="submit" variant="outline" size="sm">
                        {S.renameDepartmentButton}
                      </Button>
                    </form>

                    {/* Deactivate — only shown when active */}
                    {dept.isActive && (
                      <form action={deactivateDepartmentAction} className="flex">
                        <input type="hidden" name="departmentId" value={dept.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          {S.deactivateDepartmentButton}
                        </Button>
                      </form>
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
