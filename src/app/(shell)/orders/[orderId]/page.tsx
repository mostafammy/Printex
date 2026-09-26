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

  // US5 (013, T036): rework count per Work Item — count(Return WHERE
  // workItemId = ...), same derived-value rule as getReviewQueue
  // (research.md §1), but queried directly here since order detail shows
  // Work Items outside WAITING_REVIEW too, not via a getReviewQueue call.
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/reception"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
        >
          <span>→</span>
          <span>{S.orderDetailBackLink}</span>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {S.orderDetailPageTitle} #{detail.order.orderNumber}
          </h1>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            #{detail.order.orderNumber}
          </span>
        </div>
      </div>

      {/* Header */}
      <section className="apple-card p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{S.tableHeaderCustomer}</span>
            <span className="text-base font-bold text-foreground">{detail.order.customerName}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{S.tableHeaderChannel}</span>
            <span className="text-sm font-semibold text-foreground">
              {CHANNEL_LABELS[detail.order.channel] ?? detail.order.channel}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{S.tableHeaderPriority}</span>
            <div>
              {detail.order.priority === "URGENT" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {S.priorityUrgent}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {S.priorityNormal}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{S.tableHeaderOrderStatus}</span>
            <span className="text-sm font-semibold text-foreground">
              {STATUS_LABELS[detail.order.status] ?? detail.order.status}
            </span>
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
        {detail.workItems.map((wi) => {
          const assigneeInfo = assigneeById.get(wi.id);
          const hasAssignee = Boolean(assigneeInfo?.assigneeId);
          const reworkCount = reworkCountByWorkItem.get(wi.id) ?? 0;
          return (
          <div key={wi.id} className="apple-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium">
                {S.workItemCardHeading} — {wi.description ?? wi.id}
              </span>
              <div className="flex items-center gap-2">
                {reworkCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
                    {S.reworkCountBadgePrefix} {reworkCount} {S.reworkCountBadgeSuffix}
                  </span>
                )}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{wi.state}</span>
              </div>
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

            {/* Designer assignment / reassignment (US1/US2) */}
            {assigneeInfo?.assignee?.name && (
              <p className="mt-3 text-xs text-muted-foreground">
                {S.currentDesignerLabel}: <span className="font-medium">{assigneeInfo.assignee.name}</span>
              </p>
            )}

            {canAssignDesigner && DESIGNER_ASSIGNABLE_STATES.has(wi.state) && (
              <details className="mt-3 rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  {hasAssignee ? S.reassignDesignerButton : S.assignDesignerButton}
                </summary>

                <form action={assignDesignerAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="workItemId" value={wi.id} />
                  <input type="hidden" name="orderId" value={orderId} />

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="p-2"></th>
                          <th className="p-2 text-start">{S.designerNameHeader}</th>
                          <th className="p-2 text-start">{S.designerActiveItemsHeader}</th>
                          <th className="p-2 text-start">{S.designerEstWaitHeader}</th>
                          <th className="p-2 text-start">{S.designerPastJobsHeader}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(eligibleDesignersByWorkItem.get(wi.id) ?? []).map((d) => (
                          <tr
                            key={d.userId}
                            className={
                              "border-b border-border last:border-0" +
                              (d.isSuggested ? " bg-emerald-50 dark:bg-emerald-900/20" : "")
                            }
                          >
                            <td className="p-2">
                              <input
                                type="radio"
                                name="designerId"
                                value={d.userId}
                                defaultChecked={d.isSuggested}
                                required
                              />
                            </td>
                            <td className="p-2 font-medium">
                              {d.name}
                              {d.isSuggested && (
                                <span className="ms-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                                  {S.suggestedDesignerBadge}
                                </span>
                              )}
                            </td>
                            <td className="p-2">{d.activeWorkItemCount}</td>
                            <td className="p-2">
                              {d.estimatedWaitMinutes} {S.minutesShortLabel}
                            </td>
                            <td className="p-2">{d.pastJobsForCustomer}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(eligibleDesignersByWorkItem.get(wi.id) ?? []).length === 0 && (
                      <p className="p-2 text-sm text-muted-foreground">{S.noEligibleDesignersNote}</p>
                    )}
                  </div>

                  {hasAssignee && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">{S.reassignReasonLabel}</label>
                      <input name="reason" type="text" required className={inputCls} />
                    </div>
                  )}

                  <div>
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
      </section>

      {/* Add Work Item */}
      <section className="apple-card p-6 sm:p-8">
        <h2 className="mb-4 text-base font-bold text-foreground">{S.addWorkItemHeading}</h2>
        <form action={addWorkItemAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="orderId" value={orderId} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{S.quantityLabel}</label>
            <input name="quantity" type="number" min={1} required className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{S.widthLabel}</label>
            <input name="widthValue" type="number" min={0.01} step="0.01" required className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{S.heightLabel}</label>
            <input name="heightValue" type="number" min={0.01} step="0.01" required className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{S.dimensionUnitLabel}</label>
            <select name="dimensionUnit" defaultValue="CM" className="w-24 rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-2xs focus:border-primary focus:ring-3 focus:ring-primary/25 focus:outline-none">
              <option value="MM">MM</option>
              <option value="CM">CM</option>
              <option value="M">M</option>
              <option value="IN">IN</option>
            </select>
          </div>
          <Button type="submit" variant="default" size="default">
            {S.addWorkItemButton}
          </Button>
        </form>
        {STATUS_LABELS[detail.order.status] === S.orderStatusCompleted && (
          <p className="mt-3 text-xs text-muted-foreground">{S.orderFinishedNote}</p>
        )}
      </section>

      {/* Timeline */}
      <section className="apple-card p-6 sm:p-8">
        <h2 className="mb-4 text-base font-bold text-foreground">{S.timelineHeading}</h2>
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

      {/* 052-finance: fills the payments placeholder (FR-021 / T021). */}
      <OrderFinancePanel orderId={orderId} />

      {/* Out-of-scope placeholders (FR-009a) — designer assignment now lives
          in the Work Item cards above (012-designer-assignment-timers). */}
      <section className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p>{S.placeholderPricing}</p>
        <p>{S.placeholderFiles}</p>
        <p>{S.placeholderMessages}</p>
      </section>
    </div>
  );
}
