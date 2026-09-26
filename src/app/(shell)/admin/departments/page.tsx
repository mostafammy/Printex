// Admin Departments page — 001-identity-access-audit (T027).
// Server Component: no "use client". All mutations use inline Server Actions.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { revalidatePath } from "next/cache";
import { Building2, PlusCircle, CheckCircle2, XCircle, Pencil, Trash2 } from "lucide-react";
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

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

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
    <div className="flex flex-col gap-6">
      {/* ── Hero Admin Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-indigo-500/10 to-purple-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {S.adminDepartmentsPageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              إدارة أقسام وورش المطبعة ومسارات التوجيه والتنفيذ
            </p>
          </div>
        </div>
      </div>

      {/* ── Add Department Form Card ── */}
      <section className="apple-card p-6 sm:p-7">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{S.addDepartmentHeading}</h2>
            <p className="text-xs text-muted-foreground">إضافة قسم إنتاجي أو إداري جديد للمنشأة</p>
          </div>
        </div>

        <form action={addDepartmentAction} className="flex flex-wrap items-end gap-3 max-w-xl">
          <div className="flex flex-1 flex-col gap-1.5 min-w-[240px]">
            <label className="text-xs font-semibold text-foreground">
              {S.departmentNameLabel}
            </label>
            <input
              name="name"
              type="text"
              required
              className={inputCls}
              placeholder="مثال: قسم الليزر والقص الرقمي..."
            />
          </div>
          <Button type="submit" variant="default">
            <PlusCircle className="h-4 w-4" />
            <span>{S.addDepartmentButton}</span>
          </Button>
        </form>
      </section>

      {/* ── Departments Table Card ── */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderDepartmentName}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderDepartmentStatus}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {departments.map((dept) => (
                <tr key={dept.id} className="transition-colors hover:bg-muted/30">
                  {/* Name */}
                  <td className="px-5 py-4 font-bold text-foreground">{dept.name}</td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                        dept.isActive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}
                    >
                      {dept.isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      <span>{dept.isActive ? S.statusActive : S.statusInactive}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Rename form */}
                      <form action={renameDepartmentAction} className="flex items-center gap-2">
                        <input type="hidden" name="departmentId" value={dept.id} />
                        <input
                          name="newName"
                          type="text"
                          required
                          defaultValue={dept.name}
                          className="w-40 rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                        />
                        <Button type="submit" variant="outline" size="xs">
                          <Pencil className="h-3 w-3" />
                          <span>{S.renameDepartmentButton}</span>
                        </Button>
                      </form>

                      {/* Deactivate — only shown when active */}
                      {dept.isActive && (
                        <form action={deactivateDepartmentAction}>
                          <input type="hidden" name="departmentId" value={dept.id} />
                          <Button type="submit" variant="destructive" size="xs">
                            <Trash2 className="h-3 w-3" />
                            <span>{S.deactivateDepartmentButton}</span>
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
    </div>
  );
}
