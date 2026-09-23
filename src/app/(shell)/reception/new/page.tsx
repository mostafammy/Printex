// Full multi-item order form — 011-orders-reception US2 (T019).
// Server Component: no "use client". Inline Server Action.
//
// Work Item rows are controlled via a `?items=N` search param (a plain link
// re-requests the page with N+1 rows) rather than client-side state — this
// keeps the page a pure Server Component per plan.md's pattern; no row data
// is preserved across an add/remove since this is a first-fill form, not a
// draft editor.

import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { createOrder, listActiveProductTypes } from "~/server/orders";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const MAX_ITEMS = 20;

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function parseItemsCount(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_ITEMS);
}

async function createOrderAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "order.create");

  const customerId = formStr(formData.get("customerId"));
  const channel = formStr(formData.get("channel"));
  const priority = formStr(formData.get("priority"));
  const mode = formStr(formData.get("mode"));
  const dueDateRaw = formStr(formData.get("dueDate"));
  const itemCount = Number(formStr(formData.get("itemCount"))) || 1;
  if (!customerId) return;

  const workItems = Array.from({ length: itemCount }, (_, i) => {
    const productTypeId = formStr(formData.get(`item.${i}.productTypeId`));
    const quantity = Number(formStr(formData.get(`item.${i}.quantity`)));
    const widthValue = Number(formStr(formData.get(`item.${i}.widthValue`)));
    const heightValue = Number(formStr(formData.get(`item.${i}.heightValue`)));
    const dimensionUnit = formStr(formData.get(`item.${i}.dimensionUnit`));
    const material = formStr(formData.get(`item.${i}.material`)).trim();
    const finishNotes = formStr(formData.get(`item.${i}.finishNotes`)).trim();
    const departmentId = formStr(formData.get(`item.${i}.departmentId`));
    const itemDueDateRaw = formStr(formData.get(`item.${i}.dueDate`));
    const description = formStr(formData.get(`item.${i}.description`)).trim();

    return {
      productTypeId: productTypeId || undefined,
      quantity,
      widthValue,
      heightValue,
      dimensionUnit: (dimensionUnit || "CM") as "MM" | "CM" | "M" | "IN",
      material: material || undefined,
      finishNotes: finishNotes || undefined,
      requiresDesign: formData.get(`item.${i}.requiresDesign`) === "on",
      requiresReview: formData.get(`item.${i}.requiresReview`) === "on",
      departmentId: departmentId || undefined,
      dueDate: itemDueDateRaw ? new Date(itemDueDateRaw) : undefined,
      description: description || undefined,
    };
  }).filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

  if (workItems.length === 0) return;

  const { orderId } = await createOrder(actor, {
    customerId,
    channel: (channel || "WALK_IN") as "WALK_IN" | "WHATSAPP" | "PHONE" | "RETURNING" | "DIRECT_TO_DESIGNER",
    priority: priority === "URGENT" ? "URGENT" : "NORMAL",
    mode: mode === "SEPARATE" ? "SEPARATE" : "GROUPED",
    dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    workItems,
  });

  redirect(`/orders/${orderId}`);
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  authorize(actor, "order.create");

  const params = await searchParams;
  const itemCount = parseItemsCount(params.items);

  const [customers, departments, productTypes] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    listActiveProductTypes(actor),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{S.newOrderPageTitle}</h1>

      <form action={createOrderAction} className="flex max-w-3xl flex-col gap-6">
        <input type="hidden" name="itemCount" value={itemCount} />

        <section className="rounded-lg border border-border bg-card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customerId" className="text-sm font-medium text-foreground">
                {S.customerLabel}
              </label>
              <select id="customerId" name="customerId" required className={inputCls} defaultValue="">
                <option value="" disabled>
                  {S.customerLabel}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isCashCustomer ? S.cashCustomerOption : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="channel" className="text-sm font-medium text-foreground">
                {S.channelLabel}
              </label>
              <select id="channel" name="channel" className={inputCls} defaultValue="WALK_IN">
                <option value="WALK_IN">{S.channelWalkIn}</option>
                <option value="WHATSAPP">{S.channelWhatsapp}</option>
                <option value="PHONE">{S.channelPhone}</option>
                <option value="RETURNING">{S.channelReturning}</option>
                <option value="DIRECT_TO_DESIGNER">{S.channelDirectToDesigner}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="priority" className="text-sm font-medium text-foreground">
                {S.priorityLabel}
              </label>
              <select id="priority" name="priority" className={inputCls} defaultValue="NORMAL">
                <option value="NORMAL">{S.priorityNormal}</option>
                <option value="URGENT">{S.priorityUrgent}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="mode" className="text-sm font-medium text-foreground">
                {S.orderModeLabel}
              </label>
              <select id="mode" name="mode" className={inputCls} defaultValue="GROUPED">
                <option value="GROUPED">{S.orderModeGrouped}</option>
                <option value="SEPARATE">{S.orderModeSeparate}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="dueDate" className="text-sm font-medium text-foreground">
                {S.orderDueDateLabel}
              </label>
              <input id="dueDate" name="dueDate" type="date" className={inputCls} />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{S.workItemsHeading}</h2>
            <Link
              href={`/reception/new?items=${itemCount + 1}`}
              className="text-sm font-medium text-primary hover:underline"
              aria-disabled={itemCount >= MAX_ITEMS}
            >
              + {S.addWorkItemRowButton}
            </Link>
          </div>

          {Array.from({ length: itemCount }, (_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">#{i + 1}</span>
                {itemCount > 1 && (
                  <Link
                    href={`/reception/new?items=${itemCount - 1}`}
                    className="text-xs text-destructive hover:underline"
                  >
                    {S.removeWorkItemRowButton}
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.productTypeLabel}</label>
                  <select name={`item.${i}.productTypeId`} className={inputCls} defaultValue="">
                    <option value="">{S.productTypeNone}</option>
                    {productTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.quantityLabel}</label>
                  <input name={`item.${i}.quantity`} type="number" min={1} step={1} required className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.dimensionUnitLabel}</label>
                  <select name={`item.${i}.dimensionUnit`} className={inputCls} defaultValue="CM">
                    <option value="MM">MM</option>
                    <option value="CM">CM</option>
                    <option value="M">M</option>
                    <option value="IN">IN</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.widthLabel}</label>
                  <input name={`item.${i}.widthValue`} type="number" min={0.01} step="0.01" required className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.heightLabel}</label>
                  <input name={`item.${i}.heightValue`} type="number" min={0.01} step="0.01" required className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.departmentOverrideLabel}</label>
                  <select name={`item.${i}.departmentId`} className={inputCls} defaultValue="">
                    <option value="">{S.productTypeNone}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.materialLabel}</label>
                  <input name={`item.${i}.material`} type="text" className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">{S.finishNotesLabel}</label>
                  <input name={`item.${i}.finishNotes`} type="text" className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{S.itemDueDateLabel}</label>
                  <input name={`item.${i}.dueDate`} type="date" className={inputCls} />
                </div>

                <div className="flex items-center gap-2">
                  <input id={`item.${i}.requiresDesign`} name={`item.${i}.requiresDesign`} type="checkbox" defaultChecked />
                  <label htmlFor={`item.${i}.requiresDesign`} className="text-sm text-foreground">
                    {S.requiresDesignLabel}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input id={`item.${i}.requiresReview`} name={`item.${i}.requiresReview`} type="checkbox" defaultChecked />
                  <label htmlFor={`item.${i}.requiresReview`} className="text-sm text-foreground">
                    {S.requiresReviewLabel}
                  </label>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className="text-sm font-medium text-foreground">{S.descriptionLabel}</label>
                  <input name={`item.${i}.description`} type="text" className={inputCls} />
                </div>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">{S.filesPlaceholderNote}</p>
            </div>
          ))}
        </section>

        <Button type="submit" variant="default" className="self-start">
          {S.createOrderSubmitButton}
        </Button>
      </form>
    </div>
  );
}
