// Change request detail — 016-change-control US3 (T051),
// contracts/change-control.md §getChangeRequestDetail / §approveChangeRequest /
// §rejectChangeRequest. Base vs proposed specification, the request reason,
// and the decision forms: approve-and-continue, approve-and-redesign (only
// when `canRedesign`), and reject with a mandatory reason.
// Server Component: no "use client". Inline Server Actions; a refusal comes
// back as `?error=<code>` and is shown in Arabic via change-error-messages.

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { getActor } from "~/server/auth";
import {
  approveChangeRequest,
  getChangeRequestDetail,
  productTypeNamesForChanges,
  rejectChangeRequest,
} from "~/server/changes";
import { Button } from "~/components/ui/button";
import {
  SpecDiff,
  getChangeErrorMessage,
  type ChangeErrorCode,
} from "~/components/changes";
import ar from "~/messages/ar.json";

const Q = ar.changes.queue;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** After a decision: back to the queue on success, else the detail page with the error code. */
function afterDecision(
  changeRequestId: string,
  result: { ok: true } | { ok: false; error: { code: string } },
): never {
  if (!result.ok) {
    redirect(
      `/changes/${changeRequestId}?error=${encodeURIComponent(result.error.code)}`,
    );
  }
  revalidatePath("/changes");
  redirect("/changes");
}

// ── Server Actions ──────────────────────────────────────────────────────────

async function approveAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const changeRequestId = formStr(formData.get("changeRequestId"));
  const outcome = formStr(formData.get("outcome"));
  if (!changeRequestId) return;
  if (outcome !== "CONTINUE_PRODUCTION" && outcome !== "REDESIGN") {
    afterDecision(changeRequestId, {
      ok: false,
      error: { code: "VALIDATION" },
    });
  }
  const result = await approveChangeRequest(actor, {
    changeRequestId,
    outcome,
    note: formStr(formData.get("note")),
  });
  afterDecision(changeRequestId, result);
}

async function rejectAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const changeRequestId = formStr(formData.get("changeRequestId"));
  if (!changeRequestId) return;
  const result = await rejectChangeRequest(actor, {
    changeRequestId,
    reason: formStr(formData.get("reason")),
  });
  afterDecision(changeRequestId, result);
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function ChangeRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ changeRequestId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { changeRequestId } = await params;
  const { error } = await searchParams;
  const actor = await getActor();

  const result = await getChangeRequestDetail(actor, { changeRequestId });

  if (!result.ok) {
    const code = result.error.code;
    return (
      <div className="flex flex-col gap-2">
        <Link href="/changes" className="text-primary text-sm hover:underline">
          {Q.backLink}
        </Link>
        <h1 className="text-xl font-semibold">{Q.detailTitle}</h1>
        <p className="text-muted-foreground" role="alert">
          {code === "FORBIDDEN"
            ? Q.forbidden
            : code === "NOT_FOUND"
              ? Q.notFound
              : getChangeErrorMessage(code)}
        </p>
      </div>
    );
  }

  const cr = result.data;
  const isPending = cr.status === "PENDING";
  const errorMessage =
    typeof error === "string"
      ? getChangeErrorMessage(error as ChangeErrorCode)
      : null;

  // One query, and none unless the diff touches productTypeId.
  const productTypeNames = await productTypeNamesForChanges(db, [cr.changes]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/changes" className="text-primary text-sm hover:underline">
          {Q.backLink}
        </Link>
        <h1 className="text-xl font-semibold">
          {Q.detailTitle} —{" "}
          <Link
            href={`/orders/${cr.workItem.orderId}`}
            className="text-primary hover:underline"
          >
            #{cr.workItem.orderNumber}
          </Link>
        </h1>
        <span className="bg-muted w-fit rounded-full px-2 py-0.5 text-xs font-medium">
          {Q.status[cr.status]}
        </span>
      </div>

      {errorMessage && (
        <div
          className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {/* Summary */}
      <section className="border-border bg-card rounded-lg border p-6">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{Q.customerLabel}</dt>
            <dd className="font-medium">{cr.workItem.customerName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{Q.requesterLabel}</dt>
            <dd className="font-medium">{cr.requestedBy.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{Q.requestedAtLabel}</dt>
            <dd>{formatDate(cr.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{Q.workItemStateLabel}</dt>
            <dd>{cr.workItem.state}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{Q.baseVersionLabel}</dt>
            <dd>{cr.base.version}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{Q.currentVersionLabel}</dt>
            <dd>{cr.currentVersion ?? "—"}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-muted-foreground">{Q.requestReasonLabel}</dt>
            <dd className="whitespace-pre-wrap">{cr.requestReason}</dd>
          </div>
        </dl>
      </section>

      {/* Base vs proposed */}
      <section className="border-border bg-card rounded-lg border p-6">
        <h2 className="mb-3 text-base font-semibold">{Q.changesHeading}</h2>
        <SpecDiff
          changes={cr.changes}
          productTypeNames={productTypeNames}
          caption={Q.changesCaption}
        />
      </section>

      {isPending ? (
        <section className="border-border bg-card flex flex-col gap-6 rounded-lg border p-6">
          {/* Approve — one form, the pressed button carries the outcome */}
          <form action={approveAction} className="flex flex-col gap-3">
            <input
              type="hidden"
              name="changeRequestId"
              value={cr.changeRequestId}
            />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="decision-note"
                className="text-muted-foreground text-xs"
              >
                {Q.noteLabel}
              </label>
              <input
                id="decision-note"
                name="note"
                type="text"
                className={inputCls}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                name="outcome"
                value="CONTINUE_PRODUCTION"
                variant="default"
                size="sm"
              >
                {Q.approveContinueButton}
              </Button>
              {cr.canRedesign ? (
                <Button
                  type="submit"
                  name="outcome"
                  value="REDESIGN"
                  variant="outline"
                  size="sm"
                >
                  {Q.approveRedesignButton}
                </Button>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {Q.redesignNotAllowedNote}
                </span>
              )}
            </div>
          </form>

          {/* Reject */}
          <form
            action={rejectAction}
            className="border-border flex flex-col gap-3 border-t pt-6"
          >
            <input
              type="hidden"
              name="changeRequestId"
              value={cr.changeRequestId}
            />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="reject-reason"
                className="text-muted-foreground text-xs"
              >
                {Q.rejectReasonLabel}
              </label>
              <textarea
                id="reject-reason"
                name="reason"
                required
                rows={2}
                className={inputCls}
              />
            </div>
            <div>
              <Button type="submit" variant="destructive" size="sm">
                {Q.rejectButton}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <section className="border-border bg-card rounded-lg border p-6">
          <p className="text-muted-foreground mb-3 text-sm">
            {Q.decidedNotice}
          </p>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {cr.outcome && (
              <div>
                <dt className="text-muted-foreground">{Q.outcomeLabel}</dt>
                <dd>{Q.outcome[cr.outcome]}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{Q.decidedByLabel}</dt>
              <dd>{cr.decidedBy?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{Q.decidedAtLabel}</dt>
              <dd>{formatDate(cr.decidedAt)}</dd>
            </div>
            {cr.decisionNote && (
              <div className="sm:col-span-3">
                <dt className="text-muted-foreground">{Q.decisionNoteLabel}</dt>
                <dd className="whitespace-pre-wrap">{cr.decisionNote}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
