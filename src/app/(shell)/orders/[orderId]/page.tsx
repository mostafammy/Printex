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
import { Button } from "~/components/ui/button";
import {
  editSpec,
  specEditPolicy,
  redesignChoice,
  toSpecSnapshot,
  type SpecPatchInput,
  type WorkItemDimensionUnit,
} from "~/server/changes";
import {
  SpecHistory,
  EditSpecForm,
  getChangeErrorMessage,
  type EditSpecActionResult,
} from "~/components/changes";
// 016 US3 (T051): change requests on IN_PRODUCTION Work Items.
import {
  createChangeRequest,
  withdrawChangeRequest,
  findPendingChangeRequestIds,
} from "~/server/changes";
import { specPatchFromFormData } from "~/components/changes";
// 016 US7 (T070): admin override of the specification.
import { adminOverrideSpec, canRedesignOnApproval } from "~/server/changes";
import { AdminOverrideForm } from "~/components/changes";
// 016 US6 (T067): late cancellation after production started.
import { cancelAfterProductionStarted, LATE_CANCEL_STATES } from "~/server/changes";
import { LateCancelForm, CancelOrderForm, type CancelOrderActionResult } from "~/components/changes";
import ar from "~/messages/ar.json";

const VALID_DIMENSION_UNITS = new Set<string>(["MM", "CM", "M", "IN"]);
function isDimensionUnit(value: unknown): value is WorkItemDimensionUnit {
  return typeof value === "string" && VALID_DIMENSION_UNITS.has(value);
}

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

async function cancelOrderAction(
  _prevState: CancelOrderActionResult | null,
  formData: FormData,
): Promise<CancelOrderActionResult | null> {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const reason = formStr(formData.get("reason")).trim();
  if (!orderId || !reason) return null;
  const result = await cancelOrder(actor, orderId, reason);
  revalidatePath(`/orders/${orderId}`);
  // 016 US6: items already in production are listed, not silently skipped.
  return {
    cancelledCount: result.cancelledWorkItemIds.length,
    requiresLateCancellation: result.requiresLateCancellation,
  };
}

// 016 US6 (T067): cancel after production started, with reason and cost.
async function lateCancelAction(
  _prevState: EditSpecActionResult | null,
  formData: FormData,
): Promise<EditSpecActionResult> {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const produced = formStr(formData.get("producedQuantitySoFar")).trim();
  const result = await cancelAfterProductionStarted(actor, {
    workItemId: formStr(formData.get("workItemId")),
    reason: formStr(formData.get("reason")),
    costIncurred: formStr(formData.get("costIncurred")),
    producedQuantitySoFar: produced === "" ? undefined : Number(produced),
    costNote: formStr(formData.get("costNote")),
  });
  if (!result.ok) return { ok: false, error: getChangeErrorMessage(result.error.code) };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, success: true };
}

const LATE_CANCEL_STATE_SET = new Set<string>(LATE_CANCEL_STATES);

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

async function editSpecAction(
  _prevState: EditSpecActionResult | null,
  formData: FormData,
): Promise<EditSpecActionResult> {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const workItemId = formStr(formData.get("workItemId"));
  const expectedVersion = Number(formData.get("expectedVersion"));

  if (!workItemId || !orderId || !Number.isFinite(expectedVersion)) {
    return { ok: false, error: getChangeErrorMessage("VALIDATION") };
  }

  const patch: SpecPatchInput = {};
  if (formData.has("quantity")) {
    const q = formData.get("quantity");
    if (typeof q === "string" && q.trim() !== "") {
      patch.quantity = Number(q);
    }
  }
  if (formData.has("widthValue")) {
    const w = formData.get("widthValue");
    if (typeof w === "string") {
      patch.widthValue = w.trim() === "" ? null : w.trim();
    }
  }
  if (formData.has("heightValue")) {
    const h = formData.get("heightValue");
    if (typeof h === "string") {
      patch.heightValue = h.trim() === "" ? null : h.trim();
    }
  }
  if (formData.has("dimensionUnit")) {
    const u = formData.get("dimensionUnit");
    if (typeof u === "string") {
      const trimmed = u.trim();
      if (trimmed === "") {
        patch.dimensionUnit = null;
      } else if (isDimensionUnit(trimmed)) {
        patch.dimensionUnit = trimmed;
      }
    }
  }
  if (formData.has("material")) {
    const m = formData.get("material");
    if (typeof m === "string") {
      patch.material = m.trim() === "" ? null : m.trim();
    }
  }
  if (formData.has("description")) {
    const d = formData.get("description");
    if (typeof d === "string") {
      patch.description = d.trim() === "" ? null : d.trim();
    }
  }
  if (formData.has("finishNotes")) {
    const f = formData.get("finishNotes");
    if (typeof f === "string") {
      patch.finishNotes = f.trim() === "" ? null : f.trim();
    }
  }

  const reasonRaw = formData.get("reason");
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim() !== "" ? reasonRaw.trim() : undefined;

  const choiceRaw = formData.get("designChoice");
  const designChoice =
    choiceRaw === "REDESIGN" || choiceRaw === "KEEP_DESIGN" ? choiceRaw : undefined;

  const originDeptRaw = formData.get("originDepartmentId");
  const originDepartmentId =
    typeof originDeptRaw === "string" && originDeptRaw.trim() !== ""
      ? originDeptRaw.trim()
      : undefined;

  const result = await editSpec(actor, {
    workItemId,
    expectedVersion,
    patch,
    reason,
    designChoice,
    originDepartmentId,
  });

  if (!result.ok) {
    return { ok: false, error: getChangeErrorMessage(result.error.code) };
  }

  revalidatePath(`/orders/${orderId}`);
  return { ok: true, success: true };
}

// 016 US3 (T051): raise / withdraw a change request (IN_PRODUCTION only).
async function requestChangeAction(
  _prevState: EditSpecActionResult | null,
  formData: FormData,
): Promise<EditSpecActionResult> {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const result = await createChangeRequest(actor, {
    workItemId: formStr(formData.get("workItemId")),
    patch: specPatchFromFormData(formData),
    reason: formStr(formData.get("reason")),
  });
  if (!result.ok) return { ok: false, error: getChangeErrorMessage(result.error.code) };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, success: true };
}

async function withdrawChangeRequestAction(
  _prevState: EditSpecActionResult | null,
  formData: FormData,
): Promise<EditSpecActionResult> {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const result = await withdrawChangeRequest(actor, {
    changeRequestId: formStr(formData.get("changeRequestId")),
    reason: formStr(formData.get("reason")),
  });
  if (!result.ok) return { ok: false, error: getChangeErrorMessage(result.error.code) };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, success: true };
}

// 016 US7 (T070): admin override (any non-cancelled state, reason required).
async function adminOverrideAction(
  _prevState: EditSpecActionResult | null,
  formData: FormData,
): Promise<EditSpecActionResult> {
  "use server";
  const actor = await getActor();
  const orderId = formStr(formData.get("orderId"));
  const outcome = formData.get("outcome");
  const designChoice = formData.get("designChoice");
  const result = await adminOverrideSpec(actor, {
    workItemId: formStr(formData.get("workItemId")),
    expectedVersion: Number(formData.get("expectedVersion")),
    patch: specPatchFromFormData(formData),
    reason: formStr(formData.get("reason")),
    outcome: outcome === "CONTINUE_PRODUCTION" || outcome === "REDESIGN" ? outcome : undefined,
    designChoice: designChoice === "REDESIGN" || designChoice === "KEEP_DESIGN" ? designChoice : undefined,
    originDepartmentId: formStr(formData.get("originDepartmentId")) || undefined,
  });
  if (!result.ok) return { ok: false, error: getChangeErrorMessage(result.error.code) };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, success: true };
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  // 016 US4 (T058): the spec-history two-version picker is a GET form.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orderId }, specDiffParams] = await Promise.all([params, searchParams]);
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

  const workItemIds = detail.workItems.map((wi) => wi.id);
  const assigneeRows = await db.workItem.findMany({
    where: { id: { in: workItemIds } },
    select: {
      id: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      requiresDesign: true,
      departmentId: true,
      productTypeId: true,
      description: true,
      quantity: true,
      widthValue: true,
      heightValue: true,
      dimensionUnit: true,
      material: true,
      finishNotes: true,
      productType: { select: { defaultDepartmentId: true } },
      currentSpecVersion: { select: { version: true } },
    },
  });
  const assigneeById = new Map(assigneeRows.map((row) => [row.id, row]));
  const workItemExtraById = new Map(assigneeRows.map((r) => [r.id, r]));

  // US5 (013, T036): rework count per Work Item — count(Return WHERE
  // workItemId = ...), same derived-value rule as getReviewQueue
  // (research.md §1), but queried directly here since order detail shows
  // Work Items outside WAITING_REVIEW too, not via a getReviewQueue call.
  const reworkCounts = await db.return.groupBy({
    by: ["workItemId"],
    where: { workItemId: { in: workItemIds } },
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

  const canEditSpec = actor.permissions.has("order.edit");
  const needsDepartments =
    canEditSpec &&
    detail.workItems.some((wi) => {
      const extra = workItemExtraById.get(wi.id);
      const choice = redesignChoice(wi.state, extra?.requiresDesign ?? false);
      const effectiveDept =
        extra?.departmentId ?? extra?.productType?.defaultDepartmentId ?? null;
      return choice === "REQUIRED" && !effectiveDept;
    });

  const departments = needsDepartments
    ? await db.department.findMany({
        select: { id: true, name: true },
      })
    : undefined;

  // 016 US3: open change request per IN_PRODUCTION Work Item (withdraw action).
  //     One query for all of them, not one per Work Item.
  const pendingChangeRequestByWorkItem = await findPendingChangeRequestIds(
    db,
    canEditSpec
      ? detail.workItems
          .filter((wi) => specEditPolicy(wi.state) === "CHANGE_REQUEST")
          .map((wi) => wi.id)
      : [],
  );

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

        <CancelOrderForm
          orderId={orderId}
          workItemLabels={Object.fromEntries(
            detail.workItems.map((wi) => [wi.id, `${S.workItemCardHeading} — ${wi.description ?? wi.id}`]),
          )}
          action={cancelOrderAction}
        />
      </section>

      {/* Work Item cards */}
      <section className="flex flex-col gap-4">
        {detail.workItems.map((wi) => {
          const assigneeInfo = assigneeById.get(wi.id);
          const hasAssignee = Boolean(assigneeInfo?.assigneeId);
          const reworkCount = reworkCountByWorkItem.get(wi.id) ?? 0;
          return (
          <div key={wi.id} className="rounded-lg border border-border bg-card p-6">
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
              {/* Cancel — after production started only a late cancellation (016 US6) */}
              {LATE_CANCEL_STATE_SET.has(wi.state) ? (
                <div className="flex w-full flex-col gap-2" data-testid="late-cancel-required">
                  <p className="text-xs text-destructive">{ar.changes.lateCancel.requiredNotice}</p>
                  {actor.permissions.has("order.cancel") && (
                    <LateCancelForm workItemId={wi.id} orderId={orderId} action={lateCancelAction} />
                  )}
                </div>
              ) : (
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
              )}

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

            {(() => {
              const extra = workItemExtraById.get(wi.id);
              if (!extra) return null;
              const expectedVersion = extra.currentSpecVersion?.version ?? 1;
              const effectiveDeptId =
                extra.departmentId ?? extra.productType?.defaultDepartmentId ?? null;
              const policy = specEditPolicy(wi.state);
              const choice = redesignChoice(wi.state, extra.requiresDesign);
              const currentSpec = toSpecSnapshot(extra);

              return (
                <EditSpecForm
                  workItemId={wi.id}
                  orderId={orderId}
                  policy={policy}
                  choice={choice}
                  expectedVersion={expectedVersion}
                  canEdit={canEditSpec}
                  currentSpec={currentSpec}
                  departments={departments}
                  effectiveDepartmentId={effectiveDeptId}
                  action={editSpecAction}
                  changeRequest={{
                    pendingId: pendingChangeRequestByWorkItem.get(wi.id) ?? null,
                    requestAction: requestChangeAction,
                    withdrawAction: withdrawChangeRequestAction,
                  }}
                />
              );
            })()}

            {/* 016 US7 (T070): admin override, admin.override holders only. */}
            {actor.permissions.has("admin.override") &&
              wi.state !== "CANCELLED" &&
              (() => {
                const extra = workItemExtraById.get(wi.id);
                if (!extra) return null;
                return (
                  <AdminOverrideForm
                    workItemId={wi.id}
                    orderId={orderId}
                    expectedVersion={extra.currentSpecVersion?.version ?? 1}
                    currentSpec={toSpecSnapshot(extra)}
                    inProduction={wi.state === "IN_PRODUCTION"}
                    canRedesign={canRedesignOnApproval(extra)}
                    choice={redesignChoice(wi.state, extra.requiresDesign)}
                    departments={departments}
                    effectiveDepartmentId={
                      extra.departmentId ?? extra.productType?.defaultDepartmentId ?? null
                    }
                    action={adminOverrideAction}
                  />
                );
              })()}

            <SpecHistory actor={actor} workItemId={wi.id} searchParams={specDiffParams} />
          </div>
          );
        })}
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

      {/* Out-of-scope placeholders (FR-009a) — designer assignment now lives
          in the Work Item cards above (012-designer-assignment-timers). */}
      <section className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p>{S.placeholderPricing}</p>
        <p>{S.placeholderPayments}</p>
        <p>{S.placeholderFiles}</p>
        <p>{S.placeholderMessages}</p>
      </section>
    </div>
  );
}
