// Admin Product Types page — 011-orders-reception Polish phase (T049).
// Server Component: no "use client". All mutations use inline Server Actions.
// Mirrors src/app/(shell)/admin/departments/page.tsx's pattern.

import { revalidatePath } from "next/cache";
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
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{S.adminProductTypesPageTitle}</h1>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">{S.createProductTypeHeading}</h2>
        <form action={createProductTypeAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{S.productTypeNameLabel}</label>
            <input name="name" type="text" required className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{S.tableHeaderDefaultDepartment}</label>
            <select name="defaultDepartmentId" className={inputCls} defaultValue="">
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="default">
            {S.createProductTypeButton}
          </Button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderProductTypeName}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderDefaultDepartment}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderDepartmentStatus}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {productTypes.map((pt) => (
              <tr key={pt.id} className="bg-card hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{pt.name}</td>
                <td className="px-4 py-3">
                  {pt.defaultDepartmentId ? departmentNameById.get(pt.defaultDepartmentId) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      pt.isActive
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }
                  >
                    {pt.isActive ? S.statusActive : S.statusInactive}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <form action={renameProductTypeAction} className="flex items-end gap-2">
                      <input type="hidden" name="productTypeId" value={pt.id} />
                      <input
                        name="newName"
                        type="text"
                        required
                        defaultValue={pt.name}
                        className="w-40 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                      <Button type="submit" variant="outline" size="sm">
                        {S.renameProductTypeButton}
                      </Button>
                    </form>

                    {pt.isActive && (
                      <form action={deactivateProductTypeAction} className="flex">
                        <input type="hidden" name="productTypeId" value={pt.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          {S.deactivateProductTypeButton}
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
