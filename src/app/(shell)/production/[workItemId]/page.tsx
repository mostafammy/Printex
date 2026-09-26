// Production job card — 014-production US2/US3/US4/US5/US6/US7
// (T015, T021, T026, T031, T036, T040). Read-only spec, approved-file
// download, timer controls, complete-production form, send-back-to-design
// form, and (external departments only) vendor sent/received controls.
// Server Component: no "use client". Inline Server Actions — mirrors
// src/app/(shell)/review/[workItemId]/page.tsx's shape.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import { acknowledgeSpecRevision } from "~/server/changes";
import {
  getJobCard,
  startProduction,
  pauseProduction,
  resumeProduction,
  acknowledgeFileRevision,
  completeProduction,
  sendBackToDesign,
  recordSentToVendor,
  recordReceivedFromVendor,
  DomainProductionError,
} from "~/server/production";
import { Button } from "~/components/ui/button";
import {
  ChangeHoldBanner,
  SpecDiff,
  getChangeErrorMessage,
  type ChangeErrorCode,
} from "~/components/changes";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// 016 (FR-012): resume / complete / send-back are refused while a change
// request or an unacknowledged revision holds the job — as
// DomainProductionError("CHANGE_HOLD") or a transition guard failure.
function isChangeHoldRefusal(caught: unknown): boolean {
  if (caught instanceof DomainProductionError) return caught.code === "CHANGE_HOLD";
  if (!(caught instanceof Error) || caught.name !== "WorkItemTransitionError") return false;
  const details = (caught as { error?: { details?: unknown } }).error?.details;
  return typeof details === "object" && details !== null && "guardCode" in details && details.guardCode === "CHANGE_HOLD";
}

/** Re-shows the job card with the hold explained. */
function redirectChangeError(workItemId: string, code: ChangeErrorCode): never {
  redirect(`/production/${workItemId}?changeError=${code}`);
}

async function acknowledgeSpecRevisionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  const result = await acknowledgeSpecRevision(actor, { workItemId });
  if (!result.ok) redirectChangeError(workItemId, result.error.code);
  revalidatePath(`/production/${workItemId}`);
  redirect(`/production/${workItemId}`);
}

// ── Server Actions ──────────────────────────────────────────────────────────
// Every action silently swallows DomainProductionError — the reload simply
// re-shows the job card as-is (same convention as review's approveDesignAction).

async function startProductionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  try {
    await startProduction(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    throw caught;
  }
  revalidatePath(`/production/${workItemId}`);
}

async function pauseProductionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  try {
    await pauseProduction(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    throw caught;
  }
  revalidatePath(`/production/${workItemId}`);
}

async function resumeProductionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  let held = false;
  try {
    await resumeProduction(actor, workItemId);
  } catch (caught) {
    held = isChangeHoldRefusal(caught);
    if (!held && caught instanceof DomainProductionError) return;
    if (!held) throw caught;
  }
  if (held) redirectChangeError(workItemId, "CHANGE_HOLD");
  revalidatePath(`/production/${workItemId}`);
}

async function acknowledgeFileRevisionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  try {
    await acknowledgeFileRevision(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    throw caught;
  }
  revalidatePath(`/production/${workItemId}`);
}

async function completeProductionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  const producedQuantity = Number(formStr(formData.get("producedQuantity")));
  const notes = formStr(formData.get("notes"));
  let held = false;
  try {
    await completeProduction(actor, workItemId, {
      producedQuantity,
      notes: notes || undefined,
    });
  } catch (caught) {
    held = isChangeHoldRefusal(caught);
    if (!held && caught instanceof DomainProductionError) return;
    if (!held && caught instanceof Error && caught.name === "ZodError") return;
    if (!held) throw caught;
  }
  if (held) redirectChangeError(workItemId, "CHANGE_HOLD");
  revalidatePath(`/production/${workItemId}`);
}

async function sendBackToDesignAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  const reason = formStr(formData.get("reason"));
  let held = false;
  try {
    await sendBackToDesign(actor, workItemId, { reason });
  } catch (caught) {
    held = isChangeHoldRefusal(caught);
    if (!held && caught instanceof DomainProductionError) return;
    if (!held && caught instanceof Error && caught.name === "ZodError") return;
    if (!held) throw caught;
  }
  if (held) redirectChangeError(workItemId, "CHANGE_HOLD");
  revalidatePath(`/production/${workItemId}`);
}

async function recordSentToVendorAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  const vendorName = formStr(formData.get("vendorName"));
  try {
    await recordSentToVendor(actor, workItemId, { vendorName });
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    if (caught instanceof Error && caught.name === "ZodError") return;
    throw caught;
  }
  revalidatePath(`/production/${workItemId}`);
}

async function recordReceivedFromVendorAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  const recordId = formStr(formData.get("recordId"));
  if (!workItemId || !recordId) return;
  try {
    await recordReceivedFromVendor(actor, workItemId, recordId);
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    throw caught;
  }
  revalidatePath(`/production/${workItemId}`);
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function ProductionJobCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workItemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workItemId } = await params;
  const { changeError } = await searchParams;
  const actor = await getActor();

  let card: Awaited<ReturnType<typeof getJobCard>>;
  try {
    card = await getJobCard(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainProductionError) {
      return (
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">{S.productionQueuePageTitle}</h1>
          <p className="text-muted-foreground">{S.reviewDetailNotFound}</p>
        </div>
      );
    }
    throw caught;
  }

  const isReady = card.state === "READY_FOR_PRODUCTION";
  const isInProduction = card.state === "IN_PRODUCTION";
  const hasPendingRevision = card.pendingFileRevisionAt !== null;
  const vendorAwaitingReceipt = card.vendorRecord !== null && card.vendorRecord.receivedAt === null;
  // 016: resume / complete / send-back are disabled while held (the server refuses anyway).
  const isHeld = card.changeHold !== null;
  const changeErrorMessage =
    typeof changeError === "string" ? getChangeErrorMessage(changeError as ChangeErrorCode) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/orders/${card.order.id}`} className="text-sm text-primary hover:underline">
          {S.reviewDetailBackLink}
        </Link>
        <h1 className="text-xl font-semibold">
          {card.order.customerName} #{card.order.number}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{card.state}</span>
          {card.specVersion !== null && (
            <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {ar.changes.hold.specVersionLabel} {card.specVersion}
            </span>
          )}
        </div>
      </div>

      {card.changeHold ? (
        <ChangeHoldBanner
          hold={card.changeHold}
          workItemId={workItemId}
          acknowledgeAction={acknowledgeSpecRevisionAction}
          errorMessage={changeErrorMessage}
        />
      ) : (
        changeErrorMessage && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {changeErrorMessage}
          </p>
        )
      )}

      {hasPendingRevision && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{S.badgeRevisedFile}</p>
            <form action={acknowledgeFileRevisionAction}>
              <input type="hidden" name="workItemId" value={workItemId} />
              <Button type="submit" variant="outline" size="sm">
                {S.productionAcknowledgeButton}
              </Button>
            </form>
          </div>
        </section>
      )}

      {/* Read-only spec */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.reviewOrderSpecHeading}</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{S.productionSpecDescriptionLabel}</dt>
            <dd>{card.spec.description ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{S.reviewQuantityLabel}</dt>
            <dd>{card.spec.quantity ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{S.reviewDimensionsLabel}</dt>
            <dd>
              {card.spec.widthValue && card.spec.heightValue
                ? `${card.spec.widthValue} × ${card.spec.heightValue} ${card.spec.dimensionUnit ?? ""}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{S.reviewMaterialLabel}</dt>
            <dd>{card.spec.material ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{S.productionSpecFinishNotesLabel}</dt>
            <dd>{card.spec.finishNotes ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {/* 016 (FR-020): spec changes since production started */}
      {card.productionStartDiff.length > 0 && (
        <section
          className="rounded-lg border border-border bg-card p-6"
          data-testid="production-start-diff"
        >
          <h2 className="mb-3 text-base font-semibold">
            {ar.changes.diff.productionStartHeading}
          </h2>
          <SpecDiff
            changes={card.productionStartDiff}
            productTypeNames={card.productionStartProductTypeNames}
          />
        </section>
      )}

      {/* Approved file */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.productionApprovedFileHeading}</h2>
        {card.approvedFile ? (
          <a href={card.approvedFile.downloadUrl} className="text-sm text-primary hover:underline">
            {card.approvedFile.fileName}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">{S.productionApprovedFileEmpty}</p>
        )}
      </section>

      {/* Timer controls */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.productionTimerHeading}</h2>
        <div className="flex flex-wrap gap-2">
          {isReady && (
            <form action={startProductionAction}>
              <input type="hidden" name="workItemId" value={workItemId} />
              <Button type="submit" variant="default" size="sm">
                {S.productionStartButton}
              </Button>
            </form>
          )}
          {isInProduction && (
            <>
              <form action={pauseProductionAction}>
                <input type="hidden" name="workItemId" value={workItemId} />
                <Button type="submit" variant="outline" size="sm">
                  {S.myQueuePauseButton}
                </Button>
              </form>
              <form action={resumeProductionAction}>
                <input type="hidden" name="workItemId" value={workItemId} />
                <Button type="submit" variant="outline" size="sm" disabled={hasPendingRevision || isHeld}>
                  {S.myQueueResumeButton}
                </Button>
              </form>
            </>
          )}
          {!isReady && !isInProduction && (
            <p className="text-xs text-muted-foreground">{S.productionTimerNotAvailableNote}</p>
          )}
        </div>
      </section>

      {/* External vendor controls */}
      {card.vendorRecord !== null || isInProduction ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">{S.productionVendorHeading}</h2>
          {card.vendorRecord ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                {card.vendorRecord.vendorName} — {formatDate(card.vendorRecord.sentAt)}
              </p>
              {card.vendorRecord.receivedAt ? (
                <p className="text-muted-foreground">
                  {S.productionVendorReceivedLabel} {formatDate(card.vendorRecord.receivedAt)}
                </p>
              ) : (
                vendorAwaitingReceipt && (
                  <form action={recordReceivedFromVendorAction}>
                    <input type="hidden" name="workItemId" value={workItemId} />
                    <input type="hidden" name="recordId" value={card.vendorRecord.recordId} />
                    <Button type="submit" variant="outline" size="sm">
                      {S.productionVendorReceiveButton}
                    </Button>
                  </form>
                )
              )}
            </div>
          ) : isInProduction ? (
            <form action={recordSentToVendorAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="workItemId" value={workItemId} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{S.productionVendorNameLabel}</label>
                <input name="vendorName" required className={inputCls} />
              </div>
              <Button type="submit" variant="outline" size="sm">
                {S.productionVendorSendButton}
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {/* Complete production */}
      {isInProduction && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">{S.productionCompleteHeading}</h2>
          <form action={completeProductionAction} className="flex flex-col gap-3">
            <input type="hidden" name="workItemId" value={workItemId} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.productionProducedQuantityLabel}</label>
              <input name="producedQuantity" type="number" min={1} required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.productionNotesLabel}</label>
              <textarea name="notes" rows={2} className={inputCls} />
            </div>
            <div>
              <Button type="submit" variant="default" size="sm" disabled={isHeld}>
                {S.productionCompleteButton}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Send back to design */}
      {isInProduction && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">{S.productionSendBackHeading}</h2>
          <form action={sendBackToDesignAction} className="flex flex-col gap-3">
            <input type="hidden" name="workItemId" value={workItemId} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.productionSendBackReasonLabel}</label>
              <textarea name="reason" required rows={2} className={inputCls} />
            </div>
            <div>
              <Button type="submit" variant="outline" size="sm" disabled={isHeld}>
                {S.productionSendBackButton}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
