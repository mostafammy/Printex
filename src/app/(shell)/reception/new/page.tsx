// Full multi-item order form — 011-orders-reception US2 (T019).
// Server Component: no "use client". Inline Server Action.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PackagePlus,
  ArrowRight,
  Plus,
  Trash2,
  Layers,
  Calendar,
  User,
  Radio,
  Flame,
} from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { createOrder, listActiveProductTypes } from "~/server/orders";
import { Button } from "~/components/ui/button";
import { CustomerSelectField } from "~/components/customers";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

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

  const [cashCustomerRow, departments, productTypes] = await Promise.all([
    db.customer.findFirst({ where: { isCashCustomer: true }, select: { id: true } }),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    listActiveProductTypes(actor),
  ]);
  const cashCustomer = cashCustomerRow
    ? { id: cashCustomerRow.id, label: S.cashCustomerOption }
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Breadcrumb ── */}
      <div>
        <Link
          href="/reception"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>العودة لطابور الاستقبال</span>
        </Link>
      </div>

      {/* ── Hero Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-primary/10 to-indigo-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-indigo-600 text-white shadow-md shadow-primary/25">
            <PackagePlus className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {S.newOrderPageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              تسجيل طلب تفصيلي متعدد الأصناف وتحديد مسارات التصميم والإنتاج
            </p>
          </div>
        </div>
      </div>

      <form action={createOrderAction} className="flex max-w-4xl flex-col gap-6">
        <input type="hidden" name="itemCount" value={itemCount} />

        {/* ── Order Metadata Section ── */}
        <section className="apple-card p-6 sm:p-7">
          <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
            <h2 className="text-sm font-bold text-foreground">بيانات الطلب العامة</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
              <label htmlFor="customerId" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{S.customerLabel}</span>
              </label>
              <CustomerSelectField name="customerId" required cashCustomer={cashCustomer} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="channel" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-primary" />
                <span>{S.channelLabel}</span>
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
              <label htmlFor="priority" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-rose-500" />
                <span>{S.priorityLabel}</span>
              </label>
              <select id="priority" name="priority" className={inputCls} defaultValue="NORMAL">
                <option value="NORMAL">{S.priorityNormal}</option>
                <option value="URGENT">{S.priorityUrgent}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="mode" className="text-xs font-semibold text-foreground">
                {S.orderModeLabel}
              </label>
              <select id="mode" name="mode" className={inputCls} defaultValue="GROUPED">
                <option value="GROUPED">{S.orderModeGrouped}</option>
                <option value="SEPARATE">{S.orderModeSeparate}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="dueDate" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{S.orderDueDateLabel}</span>
              </label>
              <input id="dueDate" name="dueDate" type="date" className={inputCls} />
            </div>
          </div>
        </section>

        {/* ── Work Items Section ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">{S.workItemsHeading}</h2>
            </div>
            <Link
              href={`/reception/new?items=${itemCount + 1}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted transition-colors"
              aria-disabled={itemCount >= MAX_ITEMS}
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>{S.addWorkItemRowButton}</span>
            </Link>
          </div>

          {Array.from({ length: itemCount }, (_, i) => (
            <div key={i} className="apple-card p-6 sm:p-7 relative">
              <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                  صنف #{i + 1}
                </span>
                {itemCount > 1 && (
                  <Link
                    href={`/reception/new?items=${itemCount - 1}`}
                    className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{S.removeWorkItemRowButton}</span>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{S.productTypeLabel}</label>
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
                  <label className="text-xs font-semibold text-foreground">{S.quantityLabel}</label>
                  <input name={`item.${i}.quantity`} type="number" min={1} step={1} required placeholder="1" className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{S.dimensionUnitLabel}</label>
                  <select name={`item.${i}.dimensionUnit`} className={inputCls} defaultValue="CM">
                    <option value="MM">MM (مليمتر)</option>
                    <option value="CM">CM (سنتيمتر)</option>
                    <option value="M">M (متر)</option>
                    <option value="IN">IN (بوصة)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{S.widthLabel}</label>
                  <input name={`item.${i}.widthValue`} type="number" min={0.01} step="0.01" required placeholder="العرض..." className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{S.heightLabel}</label>
                  <input name={`item.${i}.heightValue`} type="number" min={0.01} step="0.01" required placeholder="الارتفاع..." className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{S.departmentOverrideLabel}</label>
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
                  <label className="text-xs font-semibold text-foreground">{S.materialLabel}</label>
                  <input name={`item.${i}.material`} type="text" placeholder="نوع الورق أو الخامة..." className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-foreground">{S.finishNotesLabel}</label>
                  <input name={`item.${i}.finishNotes`} type="text" placeholder="سلوفان، ريجة، تكسير، بصمة..." className={inputCls} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">{S.itemDueDateLabel}</label>
                  <input name={`item.${i}.dueDate`} type="date" className={inputCls} />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    id={`item.${i}.requiresDesign`}
                    name={`item.${i}.requiresDesign`}
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  <label htmlFor={`item.${i}.requiresDesign`} className="text-xs font-semibold text-foreground cursor-pointer">
                    {S.requiresDesignLabel}
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    id={`item.${i}.requiresReview`}
                    name={`item.${i}.requiresReview`}
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  <label htmlFor={`item.${i}.requiresReview`} className="text-xs font-semibold text-foreground cursor-pointer">
                    {S.requiresReviewLabel}
                  </label>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className="text-xs font-semibold text-foreground">{S.descriptionLabel}</label>
                  <input name={`item.${i}.description`} type="text" placeholder="وصف تفصيلي لصنف العمل..." className={inputCls} />
                </div>
              </div>

              <p className="mt-4 text-2xs text-muted-foreground">{S.filesPlaceholderNote}</p>
            </div>
          ))}
        </section>

        <div className="pt-2">
          <Button type="submit" variant="default" className="w-full sm:w-auto">
            <PackagePlus className="h-4 w-4" />
            <span>{S.createOrderSubmitButton}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
