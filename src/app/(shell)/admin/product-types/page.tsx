// Admin Product Types page — 011-orders-reception Polish phase (T049).
// Server Component: no "use client". All mutations use inline Server Actions.
// Mirrors src/app/(shell)/admin/departments/page.tsx's pattern.

import { revalidatePath } from "next/cache";
import { Tag, PlusCircle, CheckCircle2, XCircle, Pencil, Trash2, Building2 } from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import {
  createProductType,
  renameProductType,
  deactivateProductType,
  DomainOrderError,
} from "~/server/orders";
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

async function createProductTypeAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const name = formStr(formData.get("name")).trim();
  const defaultDepartmentId = formStr(formData.get("defaultDepartmentId"));
  if (!name) return;
  try {
    await createProductType(actor, {
      name,
      defaultDepartmentId: defaultDepartmentId || undefined,
    });
  } catch (caught) {
    if (caught instanceof DomainOrderError) return; // DUPLICATE_NAME
    throw caught;
  }
  revalidatePath("/admin/product-types");
}

async function renameProductTypeAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const productTypeId = formStr(formData.get("productTypeId"));
  const newName = formStr(formData.get("newName")).trim();
  if (!productTypeId || !newName) return;
  try {
    await renameProductType(actor, productTypeId, newName);
  } catch (caught) {
    if (caught instanceof DomainOrderError) return;
    throw caught;
  }
  revalidatePath("/admin/product-types");
}

async function deactivateProductTypeAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const productTypeId = formStr(formData.get("productTypeId"));
  await deactivateProductType(actor, productTypeId);
  revalidatePath("/admin/product-types");
}

export default async function AdminProductTypesPage() {
  const actor = await getActor();
  authorize(actor, "admin.config");

  const [productTypes, departments] = await Promise.all([
    db.productType.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero Admin Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-indigo-500/10 to-purple-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25">
            <Tag className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {S.adminProductTypesPageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              تعريف وتخصيص أنواع المنتجات والورق ومسارات الأقسام الافتراضية
            </p>
          </div>
        </div>
      </div>

      {/* ── Add Product Type Form Card ── */}
      <section className="apple-card p-6 sm:p-7">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{S.createProductTypeHeading}</h2>
            <p className="text-xs text-muted-foreground">إضافة نوع منتج جديد وربطه بالقسم الافتراضي</p>
          </div>
        </div>

        <form action={createProductTypeAction} className="flex flex-wrap items-end gap-3 max-w-2xl">
          <div className="flex flex-1 flex-col gap-1.5 min-w-[200px]">
            <label className="text-xs font-semibold text-foreground">{S.productTypeNameLabel}</label>
            <input name="name" type="text" required placeholder="مثال: كروت شخصية فاخرة..." className={inputCls} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 min-w-[180px]">
            <label className="text-xs font-semibold text-foreground">{S.tableHeaderDefaultDepartment}</label>
            <select name="defaultDepartmentId" className={inputCls} defaultValue="">
              <option value="">— {S.productTypeNone} —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="default">
            <PlusCircle className="h-4 w-4" />
            <span>{S.createProductTypeButton}</span>
          </Button>
        </form>
      </section>

      {/* ── Product Types Table Card ── */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderProductTypeName}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderDefaultDepartment}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderDepartmentStatus}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {productTypes.map((pt) => (
                <tr key={pt.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-4 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span>{pt.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {pt.defaultDepartmentId ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span>{departmentNameById.get(pt.defaultDepartmentId)}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                        pt.isActive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}
                    >
                      {pt.isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      <span>{pt.isActive ? S.statusActive : S.statusInactive}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <form action={renameProductTypeAction} className="flex items-center gap-2">
                        <input type="hidden" name="productTypeId" value={pt.id} />
                        <input
                          name="newName"
                          type="text"
                          required
                          defaultValue={pt.name}
                          className="w-36 rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                        />
                        <Button type="submit" variant="outline" size="xs">
                          <Pencil className="h-3 w-3" />
                          <span>{S.renameProductTypeButton}</span>
                        </Button>
                      </form>

                      {pt.isActive && (
                        <form action={deactivateProductTypeAction}>
                          <input type="hidden" name="productTypeId" value={pt.id} />
                          <Button type="submit" variant="destructive" size="xs">
                            <Trash2 className="h-3 w-3" />
                            <span>{S.deactivateProductTypeButton}</span>
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
