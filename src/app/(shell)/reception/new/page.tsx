// Full multi-item order form — 011-orders-reception US2 (T019).
// Server Component: no "use client". Inline Server Action.

import Link from "next/link";
import { redirect } from "next/navigation";
import { PackagePlus, ArrowRight } from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { createOrder, listActiveProductTypes } from "~/server/orders";
import { InteractiveNewOrderWizard } from "~/components/reception/new-order/InteractiveNewOrderWizard";
import ar from "~/messages/ar.json";

const S = ar.ui;

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

      {/* ── World-Class Apple-Grade Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-linear-to-br from-card/80 via-card/50 to-primary/5 p-6 sm:p-8 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-card/40">
        <div className="absolute -top-12 -end-12 h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 via-indigo-500/10 to-teal-400/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -start-16 h-56 w-56 rounded-full bg-gradient-to-tr from-purple-500/10 to-pink-500/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-white shadow-xl shadow-primary/30 ring-4 ring-primary/10">
              <PackagePlus className="h-8 w-8" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-3xs font-black text-primary">
                  مركز الاستقبال وتجهيز الإنتاج
                </span>
                <span className="text-3xs font-bold text-muted-foreground">• الإصدار الذكي 2.0</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {S.newOrderPageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">
                تسجيل طلب تفصيلي متعدد الأصناف وتحديد مسارات التصميم والمطابقة وصالة الطباعة
              </p>
            </div>
          </div>
        </div>
      </div>

      <form action={createOrderAction} className="flex flex-col gap-6">
        <InteractiveNewOrderWizard
          cashCustomer={cashCustomer}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          productTypes={productTypes.map((pt) => ({
            id: pt.id,
            name: pt.name,
            defaultDepartmentId: pt.defaultDepartmentId,
            defaultRequiresDesign: pt.defaultRequiresDesign,
            defaultRequiresReview: pt.defaultRequiresReview,
          }))}
          initialItemsCount={itemCount}
        />
      </form>
    </div>
  );
}
