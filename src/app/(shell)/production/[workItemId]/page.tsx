// Production job card — 014-production US2/US3/US4/US5/US6/US7
// (T015, T021, T026, T031, T036, T040). Read-only spec, approved-file
// download, timer controls, complete-production form, send-back-to-design
// form, and (external departments only) vendor sent/received controls.
// Server Component: no "use client". Inline Server Actions — mirrors
// src/app/(shell)/review/[workItemId]/page.tsx's shape.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
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
  try {
    await resumeProduction(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    throw caught;
  }
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
  try {
    await completeProduction(actor, workItemId, {
      producedQuantity,
      notes: notes || undefined,
    });
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    if (caught instanceof Error && caught.name === "ZodError") return;
    throw caught;
  }
  revalidatePath(`/production/${workItemId}`);
}

async function sendBackToDesignAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;
  const reason = formStr(formData.get("reason"));
  try {
    await sendBackToDesign(actor, workItemId, { reason });
  } catch (caught) {
    if (caught instanceof DomainProductionError) return;
    if (caught instanceof Error && caught.name === "ZodError") return;
    throw caught;
  }
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
}: {
  params: Promise<{ workItemId: string }>;
}) {
  const { workItemId } = await params;
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/orders/${card.order.id}`} className="text-sm text-primary hover:underline">
          {S.reviewDetailBackLink}
        </Link>
        <h1 className="text-xl font-semibold">
          {card.order.customerName} #{card.order.number}
        </h1>
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{card.state}</span>
      </div>

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
                <Button type="submit" variant="outline" size="sm" disabled={hasPendingRevision}>
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
              <Button type="submit" variant="default" size="sm">
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
              <Button type="submit" variant="outline" size="sm">
                {S.productionSendBackButton}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
