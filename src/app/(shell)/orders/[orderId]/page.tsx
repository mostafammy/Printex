// Order detail page — 011-orders-reception US4 (T027, T028), with US6 cancel
// actions (T038), US7 add-Work-Item (T042), and US8 edit-Work-Item (T046)
// all layered onto this one page, since all three share it (plan.md).
// Server Component: no "use client". Inline Server Actions.

import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  ArrowRight,
  User,
  MessageSquare,
  Sparkles,
  Flame,
  Layers,
  Ruler,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Package,
  Plus,
  XCircle,
  FileEdit,
  History,
  Info,
  Footprints,
  PhoneCall,
  Palette,
} from "lucide-react";
import { db } from "~/server/db";
import { getActor } from "~/server/auth";
import {
  getOrderDetail,
  cancelWorkItem,
  cancelOrder,
  addWorkItem,
  editWorkItem,
  DomainOrderError,
  WorkItemTransitionError,
} from "~/server/orders";
import { getEligibleDesigners, assignDesigner, DomainDesignerError } from "~/server/designers";
import type { EligibleDesigner } from "~/server/designers";
import { OrderFinancePanel } from "~/components/finance/order-finance-panel";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: S.orderStatusNotStarted,
  IN_PRODUCTION: S.orderStatusInProduction,
  PARTIALLY_READY: S.orderStatusPartiallyReady,
  DELIVERED: S.orderStatusDelivered,
  COMPLETED: S.orderStatusCompleted,
  CANCELLED: S.orderStatusCancelled,
};

const CHANNEL_LABELS: Record<string, string> = {
  WALK_IN: S.channelWalkIn,
  WHATSAPP: S.channelWhatsapp,
  PHONE: S.channelPhone,
  RETURNING: S.channelReturning,
  DIRECT_TO_DESIGNER: S.channelDirectToDesigner,
};

const PRE_DESIGN_EDITABLE = new Set(["NEW", "ASSIGNED"]);

// contracts/designer-assignment.md `getEligibleDesigners`/`assignDesigner`
// step 2 — the only states a Work Item may be (re)assigned a designer from.
const DESIGNER_ASSIGNABLE_STATES = new Set(["NEW", "ASSIGNED", "REWORK_REQUIRED", "IN_DESIGN"]);

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function missingFields(wi: {
  productTypeId: string | null;
  quantity: number | null;
  widthValue: unknown;
  heightValue: unknown;
  dimensionUnit: string | null;
  departmentId: string | null;
}): string[] {
  const missing: string[] = [];
  if (wi.productTypeId === null) missing.push(S.missingFieldProductType);
  if (wi.quantity === null) missing.push(S.missingFieldQuantity);
  if (wi.widthValue === null) missing.push(S.missingFieldWidth);
  if (wi.heightValue === null) missing.push(S.missingFieldHeight);
  if (wi.dimensionUnit === null) missing.push(S.missingFieldDimensionUnit);
  if (wi.departmentId === null) missing.push(S.missingFieldDepartment);
  return missing;
}

const WORKFLOW_STATIONS = [
  { key: "RECEPTION", label: "الاستقبال", desc: "تأكيد الطلب" },
  { key: "DESIGN", label: "التصميم", desc: "إعداد الملفات" },
  { key: "REVIEW", label: "المراجعة", desc: "اعتماد البروفة" },
  { key: "PRODUCTION", label: "الطباعة", desc: "التشغيل والإنتاج" },
  { key: "DELIVERY", label: "التسليم", desc: "جاهز للعميل" },
];

function getActiveStepIndex(orderStatus: string, workItems: readonly { state: string }[]): number {
  if (orderStatus === "COMPLETED" || orderStatus === "DELIVERED") return 4;
  if (orderStatus === "PARTIALLY_READY") return 3;
  if (orderStatus === "CANCELLED") return -1;

  const hasPrinting = workItems.some(
    (wi) =>
      wi.state === "IN_PRODUCTION" ||
      wi.state === "READY_FOR_PRODUCTION" ||
      wi.state === "PRODUCTION_COMPLETED",
  );
  if (hasPrinting) return 3;

  const hasReview = workItems.some(
    (wi) => wi.state === "WAITING_REVIEW" || wi.state === "APPROVED",
  );
  if (hasReview) return 2;

  const hasDesign = workItems.some(
    (wi) =>
      wi.state === "IN_DESIGN" ||
      wi.state === "ASSIGNED" ||
      wi.state === "REWORK_REQUIRED",
  );
  if (hasDesign) return 1;

  return 0; // Reception
}

// ── Server Actions ──────────────────────────────────────────────────────────

async function cancelWorkItemAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  const orderId = formStr(formData.get("orderId"));
  const reason = formStr(formData.get("reason")).trim();
  if (!workItemId || !reason) return;
  try {
    await cancelWorkItem(actor, workItemId, reason);
  } catch (caught) {
    if (caught instanceof WorkItemTransitionError) return; // refused, already-terminal etc.
    throw caught;
  }
  revalidatePath(`/orders/${orderId}`);
}

async function cancelOrderAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const reason = formStr(formData.get("reason")).trim();
  if (!orderId || !reason) return;
  await cancelOrder(actor, orderId, reason);
  revalidatePath(`/orders/${orderId}`);
}

async function addWorkItemAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const quantity = Number(formStr(formData.get("quantity")));
  const widthValue = Number(formStr(formData.get("widthValue")));
  const heightValue = Number(formStr(formData.get("heightValue")));
  const dimensionUnit = formStr(formData.get("dimensionUnit")) as "MM" | "CM" | "M" | "IN";
  if (!orderId || !Number.isFinite(quantity) || quantity <= 0) return;
  try {
    await addWorkItem(actor, orderId, {
      quantity,
      widthValue,
      heightValue,
      dimensionUnit: dimensionUnit || "CM",
      requiresDesign: true,
      requiresReview: true,
    });
  } catch (caught) {
    if (caught instanceof DomainOrderError) return; // ORDER_FINISHED — surfaced by re-rendering the note below
    throw caught;
  }
  revalidatePath(`/orders/${orderId}`);
}

async function editWorkItemAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const workItemId = formStr(formData.get("workItemId"));
  const quantityRaw = formStr(formData.get("quantity"));
  if (!workItemId) return;
  try {
    await editWorkItem(actor, workItemId, {
      ...(quantityRaw ? { quantity: Number(quantityRaw) } : {}),
    });
  } catch (caught) {
    if (caught instanceof DomainOrderError) return; // PAST_EDIT_WINDOW
    throw caught;
  }
  revalidatePath(`/orders/${orderId}`);
}

async function assignDesignerAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const workItemId = formStr(formData.get("workItemId"));
  const designerId = formStr(formData.get("designerId"));
  const reason = formStr(formData.get("reason")).trim();
  if (!workItemId || !designerId) return;
  try {
    await assignDesigner(actor, workItemId, designerId, reason || undefined);
  } catch (caught) {
    // REASON_REQUIRED (missing reason on a reassignment), NOT_ASSIGNABLE
    // (state changed since the page rendered) etc. — surfaced by re-rendering
    // the dialog below, same convention as cancelWorkItemAction/addWorkItemAction.
    if (caught instanceof DomainDesignerError) return;
    throw caught;
  }
  revalidatePath(`/orders/${orderId}`);
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const actor = await getActor();
  const detail = await getOrderDetail(actor, orderId);

  const creationEvent = await db.auditEvent.findFirst({
    where: { entityId: orderId, action: "order.created" },
    orderBy: { createdAt: "asc" },
  });
  const isQuickCreate =
    typeof creationEvent?.after === "object" &&
    creationEvent.after !== null &&
    (creationEvent.after as Record<string, unknown>).source === "quick_create";

  const incompleteItems = detail.workItems.filter((wi) => missingFields(wi).length > 0);

  // Designer assignment dialog data (US1/US2, contracts/designer-assignment.md).
  const canAssignDesigner = actor.permissions.has("workitem.assign_designer");

  const assigneeRows = await db.workItem.findMany({
    where: { orderId },
    select: { id: true, assigneeId: true, assignee: { select: { name: true } } },
  });
  const assigneeById = new Map(assigneeRows.map((row) => [row.id, row]));

  // US5 (013, T036): rework count per Work Item
  const reworkCounts = await db.return.groupBy({
    by: ["workItemId"],
    where: { workItemId: { in: detail.workItems.map((wi) => wi.id) } },
    _count: { _all: true },
  });
  const reworkCountByWorkItem = new Map(reworkCounts.map((r) => [r.workItemId, r._count._all]));

  const eligibleDesignersByWorkItem = new Map<string, EligibleDesigner[]>();
  if (canAssignDesigner) {
    for (const wi of detail.workItems) {
      if (DESIGNER_ASSIGNABLE_STATES.has(wi.state)) {
        eligibleDesignersByWorkItem.set(wi.id, await getEligibleDesigners(actor, wi.id));
      }
    }
  }

  const activeStepIdx = getActiveStepIndex(detail.order.status, detail.workItems);
  const customerInitials = (detail.order.customerName || "ع")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* ── Top Bar: Back Affordance & Order ID ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/reception"
          className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs backdrop-blur-xl transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
        >
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          <span>{S.orderDetailBackLink}</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-muted-foreground">
            معرّف الطلب:
          </span>
          <span className="rounded-lg bg-muted/80 px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
            #{detail.order.orderNumber}
          </span>
        </div>
      </div>

      {/* ── Hero Order Master Bento Card ── */}
      <section className="apple-bento-card relative p-6 sm:p-8 bg-gradient-to-br from-primary/[0.04] via-card to-card border-border/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Customer & Order Title */}
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-md shadow-blue-500/25">
              <span>{customerInitials}</span>
              <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {detail.order.customerName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 font-mono text-xs font-bold text-primary">
                  <Package className="h-3.5 w-3.5" />
                  <span>#{detail.order.orderNumber}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1">
                  {detail.order.channel === "WHATSAPP" ? (
                    <MessageSquare className="h-3 w-3 text-emerald-500" />
                  ) : detail.order.channel === "PHONE" ? (
                    <PhoneCall className="h-3 w-3 text-blue-500" />
                  ) : (
                    <Footprints className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span>{CHANNEL_LABELS[detail.order.channel] ?? detail.order.channel}</span>
                </span>

                {detail.order.priority === "URGENT" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 apple-glow-rose">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    <Flame className="h-3.5 w-3.5" />
                    <span>{S.priorityUrgent}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {S.priorityNormal}
                  </span>
                )}

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${
                    detail.order.status === "COMPLETED"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : detail.order.status === "IN_PRODUCTION"
                      ? "bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400"
                      : detail.order.status === "PARTIALLY_READY"
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
                      : detail.order.status === "CANCELLED"
                      ? "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{STATUS_LABELS[detail.order.status] ?? detail.order.status}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card/90 px-4 py-2.5 shadow-2xs">
              <span className="text-2xs font-semibold text-muted-foreground">أصناف العمل</span>
              <span className="text-lg font-bold text-foreground">{detail.workItems.length}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card/90 px-4 py-2.5 shadow-2xs">
              <span className="text-2xs font-semibold text-muted-foreground">التاريخ</span>
              <span className="text-xs font-bold text-foreground">
                {new Date(detail.order.createdAt).toLocaleDateString("ar-EG")}
              </span>
            </div>
          </div>
        </div>

        {isQuickCreate && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
            <Info className="h-4 w-4 shrink-0" />
            <span>{S.quickCreateProvenanceNote}</span>
          </div>
        )}

        {incompleteItems.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>{S.missingFieldsNote}</span>
            </div>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs opacity-90">
              {incompleteItems.map((wi) => (
                <li key={wi.id}>
                  {S.workItemCardHeading} — {missingFields(wi).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cancel Order Disclosure */}
        <details className="group mt-5 border-t border-border/60 pt-4">
          <summary className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-destructive/80 transition-colors hover:text-destructive">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            <span>إلغاء الطلب بالكامل</span>
          </summary>
          <form action={cancelOrderAction} className="mt-3 flex flex-wrap items-end gap-2.5 bg-destructive/5 p-4 rounded-2xl border border-destructive/20">
            <input type="hidden" name="orderId" value={orderId} />
            <div className="flex flex-1 min-w-[200px] flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">{S.cancelReasonLabel}</label>
              <input name="reason" type="text" placeholder="سبب إلغاء الطلب..." required className={inputCls} />
            </div>
            <Button type="submit" variant="destructive" size="sm">
              <XCircle className="h-3.5 w-3.5" />
              <span>{S.cancelOrderButton}</span>
            </Button>
          </form>
        </details>
      </section>

      {/* ── Apple Visual Workflow Stepper ── */}
      <section className="apple-bento-card p-6 sm:p-7">
        <h2 className="mb-4 text-xs font-bold tracking-wider uppercase text-muted-foreground">
          مسار تنفيذ الطلب (Workflow Journey)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {WORKFLOW_STATIONS.map((station, idx) => {
            const isCompleted = activeStepIdx > idx || activeStepIdx === 4;
            const isCurrent = activeStepIdx === idx && activeStepIdx !== 4;
            return (
              <div
                key={station.key}
                className={`relative flex flex-col items-center text-center p-3.5 rounded-2xl border transition-all ${
                  isCurrent
                    ? "border-primary/40 bg-primary/10 shadow-md apple-glow-blue"
                    : isCompleted
                    ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                    : "border-border/60 bg-muted/20 opacity-60"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-xs mb-2 transition-transform ${
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20 scale-110"
                      : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span className="text-xs font-bold text-foreground">{station.label}</span>
                <span className="text-2xs text-muted-foreground mt-0.5">{station.desc}</span>
                {isCurrent && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-2xs font-semibold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                    المحطة الحالية
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Work Item Cards ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-foreground">أصناف العمل ومواصفات الإنتاج</h2>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {detail.workItems.length} {detail.workItems.length === 1 ? "صنف" : "أصناف"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {detail.workItems.map((wi, index) => {
            const assigneeInfo = assigneeById.get(wi.id);
            const hasAssignee = Boolean(assigneeInfo?.assigneeId);
            const reworkCount = reworkCountByWorkItem.get(wi.id) ?? 0;
            return (
              <div
                key={wi.id}
                className="apple-bento-card p-6 sm:p-7 border-border/70 hover:border-primary/30 transition-all"
              >
                {/* Work Item Header */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 font-mono text-xs font-bold text-primary">
                      #{index + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {wi.description ?? `صنف #${wi.id.slice(-6)}`}
                      </h3>
                      <span className="font-mono text-2xs text-muted-foreground">ID: {wi.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {reworkCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                        <Flame className="h-3 w-3" />
                        <span>
                          {S.reworkCountBadgePrefix} {reworkCount} {S.reworkCountBadgeSuffix}
                        </span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold ${
                        wi.state === "IN_DESIGN"
                          ? "bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400"
                          : wi.state === "WAITING_REVIEW"
                          ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                          : wi.state === "APPROVED"
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : wi.state === "IN_PRODUCTION" || wi.state === "READY_FOR_PRODUCTION"
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
                          : wi.state === "COMPLETED" || wi.state === "DELIVERED"
                          ? "bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>{wi.state}</span>
                    </span>
                  </div>
                </div>

                {/* Specs Bento Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                  <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-2xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {S.quantityLabel}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {wi.quantity ?? "—"} قطعة
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-2xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      الأبعاد والمقاس
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {typeof wi.widthValue === "number" || typeof wi.widthValue === "string"
                        ? `${wi.widthValue} × ${typeof wi.heightValue === "number" || typeof wi.heightValue === "string" ? wi.heightValue : ""} ${wi.dimensionUnit ?? ""}`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-2xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Palette className="h-3 w-3" />
                      المصمم المكلف
                    </span>
                    <span className="text-sm font-bold text-foreground truncate">
                      {assigneeInfo?.assignee?.name ?? "غير معين"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-2xs font-semibold text-muted-foreground">معرف القسم</span>
                    <span className="text-sm font-bold text-foreground truncate">
                      {wi.departmentId ?? "القسم العام"}
                    </span>
                  </div>
                </div>

                {/* Action Controls Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Pre-design inline edit */}
                    {PRE_DESIGN_EDITABLE.has(wi.state) ? (
                      <form action={editWorkItemAction} className="flex items-center gap-2">
                        <input type="hidden" name="workItemId" value={wi.id} />
                        <input type="hidden" name="orderId" value={orderId} />
                        <input
                          name="quantity"
                          type="number"
                          min={1}
                          defaultValue={wi.quantity ?? ""}
                          placeholder="الكمية"
                          className="w-24 rounded-xl border border-input bg-background/80 px-2.5 py-1 text-xs text-foreground shadow-2xs focus:border-primary focus:outline-none"
                        />
                        <Button type="submit" variant="outline" size="xs">
                          <FileEdit className="h-3 w-3" />
                          <span>{S.saveEditButton}</span>
                        </Button>
                      </form>
                    ) : (
                      <span className="text-2xs text-muted-foreground">{S.pastEditWindowNote}</span>
                    )}
                  </div>

                  {/* Cancel Work Item Button / Disclosure */}
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-destructive/80 hover:text-destructive flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{S.cancelWorkItemButton}</span>
                    </summary>
                    <form action={cancelWorkItemAction} className="mt-2 flex items-center gap-2 bg-destructive/5 p-2.5 rounded-xl border border-destructive/20">
                      <input type="hidden" name="workItemId" value={wi.id} />
                      <input type="hidden" name="orderId" value={orderId} />
                      <input
                        name="reason"
                        type="text"
                        placeholder={S.cancelReasonLabel}
                        required
                        className="w-36 rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground"
                      />
                      <Button type="submit" variant="destructive" size="xs">
                        تأكيد الإلغاء
                      </Button>
                    </form>
                  </details>
                </div>

                {/* Designer Assignment Section */}
                {canAssignDesigner && DESIGNER_ASSIGNABLE_STATES.has(wi.state) && (
                  <details className="group mt-4 rounded-2xl border border-border/80 bg-muted/15 p-4 transition-all">
                    <summary className="cursor-pointer text-xs font-bold text-primary flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{hasAssignee ? S.reassignDesignerButton : S.assignDesignerButton}</span>
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>

                    <form action={assignDesignerAction} className="mt-4 flex flex-col gap-3">
                      <input type="hidden" name="workItemId" value={wi.id} />
                      <input type="hidden" name="orderId" value={orderId} />

                      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground">
                              <th className="p-2.5 text-center">اختيار</th>
                              <th className="p-2.5 text-start">{S.designerNameHeader}</th>
                              <th className="p-2.5 text-start">{S.designerActiveItemsHeader}</th>
                              <th className="p-2.5 text-start">{S.designerEstWaitHeader}</th>
                              <th className="p-2.5 text-start">{S.designerPastJobsHeader}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {(eligibleDesignersByWorkItem.get(wi.id) ?? []).map((d) => (
                              <tr
                                key={d.userId}
                                className={
                                  "transition-colors hover:bg-muted/30 " +
                                  (d.isSuggested ? "bg-emerald-500/5 dark:bg-emerald-950/20" : "")
                                }
                              >
                                <td className="p-2.5 text-center">
                                  <input
                                    type="radio"
                                    name="designerId"
                                    value={d.userId}
                                    defaultChecked={d.isSuggested}
                                    required
                                    className="accent-primary"
                                  />
                                </td>
                                <td className="p-2.5 font-bold text-foreground">
                                  <div className="flex items-center gap-2">
                                    <span>{d.name}</span>
                                    {d.isSuggested && (
                                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-2xs font-semibold text-white">
                                        {S.suggestedDesignerBadge}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5">{d.activeWorkItemCount}</td>
                                <td className="p-2.5">
                                  {d.estimatedWaitMinutes} {S.minutesShortLabel}
                                </td>
                                <td className="p-2.5">{d.pastJobsForCustomer}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(eligibleDesignersByWorkItem.get(wi.id) ?? []).length === 0 && (
                          <p className="p-3 text-center text-xs text-muted-foreground">
                            {S.noEligibleDesignersNote}
                          </p>
                        )}
                      </div>

                      {hasAssignee && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-muted-foreground">
                            {S.reassignReasonLabel}
                          </label>
                          <input name="reason" type="text" placeholder="سبب إعادة التعيين..." required className={inputCls} />
                        </div>
                      )}

                      <div className="pt-1">
                        <Button type="submit" variant="default" size="sm">
                          {hasAssignee ? S.confirmReassignButton : S.confirmAssignButton}
                        </Button>
                      </div>
                    </form>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Add Work Item Bento Card ── */}
      <section className="apple-bento-card p-6 sm:p-7 bg-gradient-to-br from-primary/[0.03] via-card to-card border-primary/20">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{S.addWorkItemHeading}</h2>
            <p className="text-xs text-muted-foreground">إضافة صنف طباعة أو تصميم جديد لهذا الطلب</p>
          </div>
        </div>

        <form action={addWorkItemAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="orderId" value={orderId} />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">{S.quantityLabel}</label>
            <input
              name="quantity"
              type="number"
              min={1}
              required
              placeholder="1"
              className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">{S.widthLabel}</label>
            <input
              name="widthValue"
              type="number"
              min={0.01}
              step="0.01"
              required
              placeholder="العرض"
              className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">{S.heightLabel}</label>
            <input
              name="heightValue"
              type="number"
              min={0.01}
              step="0.01"
              required
              placeholder="الارتفاع"
              className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">{S.dimensionUnitLabel}</label>
            <select
              name="dimensionUnit"
              defaultValue="CM"
              className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none"
            >
              <option value="MM">MM (مم)</option>
              <option value="CM">CM (سم)</option>
              <option value="M">M (متر)</option>
              <option value="IN">IN (بوصة)</option>
            </select>
          </div>

          <Button type="submit" variant="default" size="default">
            <Plus className="h-4 w-4" />
            <span>{S.addWorkItemButton}</span>
          </Button>
        </form>

        {STATUS_LABELS[detail.order.status] === S.orderStatusCompleted && (
          <p className="mt-3 text-xs text-muted-foreground">{S.orderFinishedNote}</p>
        )}
      </section>

      {/* ── Order Timeline Stream ── */}
      <section className="apple-bento-card p-6 sm:p-7">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{S.timelineHeading}</h2>
            <p className="text-xs text-muted-foreground">سجل الأحداث وتغييرات الحالة الزمنية</p>
          </div>
        </div>

        {detail.timeline.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{S.timelineEmpty}</p>
        ) : (
          <div className="relative ps-4 ms-2 space-y-4 border-s-2 border-primary/25">
            {detail.timeline.map((entry, i) => (
              <div key={i} className="relative group">
                <span className="absolute -start-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-card" />
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="font-bold text-foreground">
                    {entry.from ? `${entry.from} ← ${entry.to}` : entry.to}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {new Date(entry.at).toLocaleString("ar-EG")}
                  </span>
                </div>
                {entry.reason && (
                  <p className="mt-1 text-2xs text-muted-foreground bg-muted/30 rounded-lg p-1.5 border border-border/40 inline-block">
                    {entry.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Finance & Payments Panel ── */}
      <OrderFinancePanel orderId={orderId} />
    </div>
  );
}
