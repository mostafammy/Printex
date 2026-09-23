// Order detail page — 011-orders-reception US4 (T027, T028), with US6 cancel
// actions (T038), US7 add-Work-Item (T042), and US8 edit-Work-Item (T046)
// all layered onto this one page, since all three share it (plan.md).
// Server Component: no "use client". Inline Server Actions.

import Link from "next/link";
import { revalidatePath } from "next/cache";
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
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/reception" className="text-sm text-primary hover:underline">
          {S.orderDetailBackLink}
        </Link>
        <h1 className="text-xl font-semibold">
          {S.orderDetailPageTitle} #{detail.order.orderNumber}
        </h1>
      </div>

      {/* Header */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">{S.tableHeaderCustomer}</div>
            <div className="font-medium">{detail.order.customerName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{S.tableHeaderChannel}</div>
            <div className="font-medium">{CHANNEL_LABELS[detail.order.channel] ?? detail.order.channel}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{S.tableHeaderPriority}</div>
            <div className="font-medium">
              {detail.order.priority === "URGENT" ? S.priorityUrgent : S.priorityNormal}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{S.tableHeaderOrderStatus}</div>
            <div className="font-medium">{STATUS_LABELS[detail.order.status] ?? detail.order.status}</div>
          </div>
        </div>

        {isQuickCreate && <p className="mt-3 text-xs text-muted-foreground">{S.quickCreateProvenanceNote}</p>}

        {incompleteItems.length > 0 && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
            <p className="font-medium">{S.missingFieldsNote}</p>
            <ul className="mt-1 list-inside list-disc">
              {incompleteItems.map((wi) => (
                <li key={wi.id}>
                  {S.workItemCardHeading} — {missingFields(wi).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form action={cancelOrderAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="orderId" value={orderId} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{S.cancelReasonLabel}</label>
            <input name="reason" type="text" required className={inputCls} />
          </div>
          <Button type="submit" variant="destructive" size="sm">
            {S.cancelOrderButton}
          </Button>
        </form>
      </section>

      {/* Work Item cards */}
      <section className="flex flex-col gap-4">
        {detail.workItems.map((wi) => (
          <div key={wi.id} className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium">
                {S.workItemCardHeading} — {wi.description ?? wi.id}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{wi.state}</span>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {/* Cancel */}
              <form action={cancelWorkItemAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="workItemId" value={wi.id} />
                <input type="hidden" name="orderId" value={orderId} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{S.cancelReasonLabel}</label>
                  <input name="reason" type="text" required className="w-40 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                </div>
                <Button type="submit" variant="destructive" size="sm">
                  {S.cancelWorkItemButton}
                </Button>
              </form>

              {/* Edit (only while pre-design) */}
              {PRE_DESIGN_EDITABLE.has(wi.state) ? (
                <form action={editWorkItemAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="workItemId" value={wi.id} />
                  <input type="hidden" name="orderId" value={orderId} />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{S.quantityLabel}</label>
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      defaultValue={wi.quantity ?? ""}
                      className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    {S.saveEditButton}
                  </Button>
                </form>
              ) : (
                <span className="text-xs text-muted-foreground">{S.pastEditWindowNote}</span>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Add Work Item */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.addWorkItemHeading}</h2>
        <form action={addWorkItemAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="orderId" value={orderId} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{S.quantityLabel}</label>
            <input name="quantity" type="number" min={1} required className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{S.widthLabel}</label>
            <input name="widthValue" type="number" min={0.01} step="0.01" required className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{S.heightLabel}</label>
            <input name="heightValue" type="number" min={0.01} step="0.01" required className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{S.dimensionUnitLabel}</label>
            <select name="dimensionUnit" defaultValue="CM" className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm">
              <option value="MM">MM</option>
              <option value="CM">CM</option>
              <option value="M">M</option>
              <option value="IN">IN</option>
            </select>
          </div>
          <Button type="submit" variant="default" size="sm">
            {S.addWorkItemButton}
          </Button>
        </form>
        {STATUS_LABELS[detail.order.status] === S.orderStatusCompleted && (
          <p className="mt-2 text-xs text-muted-foreground">{S.orderFinishedNote}</p>
        )}
      </section>

      {/* Timeline */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.timelineHeading}</h2>
        {detail.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">{S.timelineEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {detail.timeline.map((entry, i) => (
              <li key={i} className="border-s-2 border-border ps-3">
                <span className="font-medium">
                  {entry.from ? `${entry.from} → ${entry.to}` : entry.to}
                </span>{" "}
                <span className="text-muted-foreground">
                  — {new Date(entry.at).toLocaleString("ar-EG")}
                </span>
                {entry.reason && <span className="text-muted-foreground"> ({entry.reason})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Out-of-scope placeholders (FR-009a) */}
      <section className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p>{S.placeholderDesignerAssignment}</p>
        <p>{S.placeholderPricing}</p>
        <p>{S.placeholderPayments}</p>
        <p>{S.placeholderFiles}</p>
        <p>{S.placeholderMessages}</p>
      </section>
    </div>
  );
}
