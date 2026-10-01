// Full multi-item order form — 011-orders-reception US2 (T019).
// Server Component: no "use client". Inline Server Action.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PackagePlus,
  ArrowRight,
  Plus,
  Layers,
  Calendar,
  User,
  Radio,
  Flame,
} from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { createOrder, listActiveProductTypes } from "~/server/orders";
import { listActiveFinishingServices, setProductionSpec } from "~/server/production-spec";
import { Button } from "~/components/ui/button";
import { CustomerSelectField } from "~/components/customers";
import { WorkItemRow, type RowGovernance } from "./_components/WorkItemRow";
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

function formStrs(values: FormDataEntryValue[]): string[] {
  return values.filter((v): v is string => typeof v === "string" && v !== "");
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

  // 093: the production specification travels alongside the item it belongs to.
  // It is kept in a parallel array keyed by the SAME form index rather than
  // smuggled into the work-item payload, because `createOrder` validates and
  // re-orders what it is given — pairing a quote back to its work item by array
  // position after the fact is how a 570 EGP price ends up on the wrong banner.
  type SpecEntry = {
    readonly workItemId: string;
    readonly customerWidthCm: string;
    readonly heightM: string;
    readonly quantity: number;
    readonly baseRatePerSqm: string;
    readonly finishingCodes: string[];
  };
  const pendingSpecs = new Map<number, Omit<SpecEntry, "workItemId">>();

  const drafts = Array.from({ length: itemCount }, (_, i) => {
    const productTypeId = formStr(formData.get(`item.${i}.productTypeId`));
    const quantity = Number(formStr(formData.get(`item.${i}.quantity`)));
    const widthValue = Number(formStr(formData.get(`item.${i}.widthValue`)));
    const heightValue = Number(formStr(formData.get(`item.${i}.heightValue`)));
    const dimensionUnit = formStr(formData.get(`item.${i}.dimensionUnit`));
    const material = formStr(formData.get(`item.${i}.material`)).trim();
    const finishNotes = formStr(formData.get(`item.${i}.finishNotes`)).trim();
    const itemDueDateRaw = formStr(formData.get(`item.${i}.dueDate`));
    const description = formStr(formData.get(`item.${i}.description`)).trim();

    // A governed row always sends these; a free-text row never does.
    const specWidth = formStr(formData.get(`item.${i}.spec.customerWidthCm`)).trim();
    const specHeight = formStr(formData.get(`item.${i}.spec.heightM`)).trim();
    const specRate = formStr(formData.get(`item.${i}.spec.baseRatePerSqm`)).trim();
    const specFinishings = formStrs(formData.getAll(`item.${i}.spec.finishingCodes`));

    if (specWidth && specHeight && specRate) {
      pendingSpecs.set(i, {
        customerWidthCm: specWidth,
        heightM: specHeight,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        baseRatePerSqm: specRate,
        finishingCodes: specFinishings,
      });
    }

    return {
      formIndex: i,
      productTypeId: productTypeId || undefined,
      quantity,
      widthValue,
      heightValue,
      dimensionUnit: (dimensionUnit || "CM") as "MM" | "CM" | "M" | "IN",
      material: material || undefined,
      finishNotes: finishNotes || undefined,
      requiresDesign: formData.get(`item.${i}.requiresDesign`) === "on",
      requiresReview: formData.get(`item.${i}.requiresReview`) === "on",
      // No department: `createOrder` resolves it from the product type.
      dueDate: itemDueDateRaw ? new Date(itemDueDateRaw) : undefined,
      description: description || undefined,
    };
  });

  const workItems = drafts
    .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0)
    // The row index is not part of the domain payload; `pendingSpecs` keys off
    // the surviving drafts' own index, so it must be dropped before the call.
    .map(({ formIndex: _formIndex, ...item }) => item);

  if (workItems.length === 0) return;

  const { orderId, workItemIds } = await createOrder(actor, {
    customerId,
    channel: (channel || "WALK_IN") as "WALK_IN" | "WHATSAPP" | "PHONE" | "RETURNING" | "DIRECT_TO_DESIGNER",
    priority: priority === "URGENT" ? "URGENT" : "NORMAL",
    mode: mode === "SEPARATE" ? "SEPARATE" : "GROUPED",
    dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    workItems,
  });

  // `workItemIds` is index-aligned with the array handed to `createOrder` (its
  // Zod schema is a plain `z.array`, so nothing is reordered or dropped there).
  const surviving = drafts.filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

  for (const [position, draft] of surviving.entries()) {
    const spec = pendingSpecs.get(draft.formIndex);
    const workItemId = workItemIds[position];
    if (!spec || !workItemId) continue;

    try {
      await setProductionSpec(actor, { workItemId, ...spec });
    } catch (error) {
      // The order exists and the work item does too; a rejected specification
      // must not silently disappear. The item stays in reception (NEW) with no
      // frozen quote, which is exactly what the pipeline gate then refuses to
      // release — the data is missing visibly, not quietly.
      console.error(
        `[reception/new] order ${orderId}: could not freeze the production specification for work item ${workItemId}`,
        error,
      );
    }
  }

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

  // No `department` query: a work item's department IS its product type's
  // department, so the only department data this page needs is the name that
  // `listActiveProductTypes` resolves alongside each type.
  const [cashCustomerRow, productTypes, finishings, widthRules] = await Promise.all([
    db.customer.findFirst({ where: { isCashCustomer: true }, select: { id: true } }),
    listActiveProductTypes(actor),
    listActiveFinishingServices(),
    // 093: the width ladder and rate band are CONFIGURATION (data-model §2.3),
    // so the form reads them the same way it reads product types. A product
    // type absent from this map simply is not governed, and its row renders the
    // ordinary free-text fields — no branching on product name anywhere.
    db.productionWidthRule.findMany({
      select: {
        productTypeId: true,
        ladderCm: true,
        maxHeightM: true,
        minRatePerSqm: true,
        maxRatePerSqm: true,
      },
    }),
  ]);
  const cashCustomer = cashCustomerRow
    ? { id: cashCustomerRow.id, label: S.cashCustomerOption }
    : null;

  const governance: Record<string, RowGovernance> = {};
  for (const rule of widthRules) {
    const min = Number(rule.minRatePerSqm);
    const max = Number(rule.maxRatePerSqm);
    governance[rule.productTypeId] = {
      ladderCm: rule.ladderCm,
      maxHeightM: rule.maxHeightM.toString(),
      minRatePerSqm: rule.minRatePerSqm.toString(),
      maxRatePerSqm: rule.maxRatePerSqm.toString(),
      // Midpoint, so the field opens on a valid rate. Rounded to 2 dp because a
      // band like 80–120 gives 100, but a band like 85–115 gives 100 only after
      // rounding — and an un-rounded 100.000000000000014 would look broken.
      suggestedRatePerSqm: (Math.round(((min + max) / 2) * 100) / 100).toString(),
    };
  }

  const rowFinishings = finishings.map((f) => ({
    id: f.id,
    code: f.code,
    labelAr: f.labelAr,
    ratePerSqm: f.ratePerSqm,
  }));

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
      <div className="rounded-xl border border-border/70 bg-card shadow-xs relative overflow-hidden p-6 sm:p-8">
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
        <section className="rounded-xl border border-border/70 bg-card shadow-xs p-6 sm:p-7">
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
            <WorkItemRow
              key={i}
              index={i}
              isFirst={i === 0}
              removeHref={`/reception/new?items=${itemCount - 1}`}
              productTypes={productTypes.map((pt) => ({
                id: pt.id,
                name: pt.name,
                defaultDepartmentName: pt.defaultDepartmentName,
                defaultRequiresDesign: pt.defaultRequiresDesign,
                defaultRequiresReview: pt.defaultRequiresReview,
              }))}
              governance={governance}
              finishings={rowFinishings}
            />
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
