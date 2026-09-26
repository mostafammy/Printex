// Production job card — 014-production US2/US3/US4/US5/US6/US7
// (T015, T021, T026, T031, T036, T040). Read-only spec, approved-file
// download, timer controls, complete-production form, send-back-to-design
// form, and (external departments only) vendor sent/received controls.
// Server Component: no "use client". Inline Server Actions — mirrors
// src/app/(shell)/review/[workItemId]/page.tsx's shape.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  ArrowRight,
  Printer,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Download,
  AlertTriangle,
  Clock,
  FileText,
  User,
  Sparkles,
  AlertCircle,
  Truck,
} from "lucide-react";
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
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// ── Server Actions ──────────────────────────────────────────────────────────

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
      notes: notes ? notes : undefined,
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
        <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{S.productionQueuePageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{S.reviewDetailNotFound}</p>
          <Link
            href="/production"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة لطابور الإنتاج</span>
          </Link>
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
    <div className="flex flex-col gap-6">
      {/* ── Top Navigation & Back affordance ── */}
      <div>
        <Link
          href={`/orders/${card.order.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>{S.reviewDetailBackLink}</span>
        </Link>
      </div>

      {/* ── Hero Production Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-emerald-500/10 to-teal-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25">
              <Printer className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {card.order.customerName}
                </h1>
                <span className="font-mono text-sm font-semibold text-muted-foreground">
                  #{card.order.number}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Sparkles className="h-3 w-3" />
                  <span>{card.state}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                بطاقة تشغيل خط الإنتاج (Job Card)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-foreground shadow-2xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">العميل:</span>
              <span className="font-semibold">{card.order.customerName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending File Revision Banner ── */}
      {hasPendingRevision && (
        <section className="apple-card border-amber-500/40 bg-amber-500/10 p-5 shadow-sm shadow-amber-500/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                  {S.badgeRevisedFile}
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  تم رفع إصدار أحدث للملف أثناء مرحلة الإنتاج. يرجى الاطلاع على التعديل والتأكيد قبل المتابعة.
                </p>
              </div>
            </div>
            <form action={acknowledgeFileRevisionAction}>
              <input type="hidden" name="workItemId" value={workItemId} />
              <Button type="submit" variant="outline" size="sm" className="border-amber-500/40 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200">
                {S.productionAcknowledgeButton}
              </Button>
            </form>
          </div>
        </section>
      )}

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Spec + File Download + Vendor record */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Read-only spec card */}
          <section className="apple-card p-6 sm:p-7">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                {S.reviewOrderSpecHeading}
              </h2>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">{S.productionSpecDescriptionLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">{card.spec.description ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <dt className="text-xs font-medium text-muted-foreground">{S.reviewQuantityLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">{card.spec.quantity ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <dt className="text-xs font-medium text-muted-foreground">{S.reviewDimensionsLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {card.spec.widthValue && card.spec.heightValue
                    ? `${card.spec.widthValue} × ${card.spec.heightValue} ${card.spec.dimensionUnit ?? ""}`
                    : "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <dt className="text-xs font-medium text-muted-foreground">{S.reviewMaterialLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">{card.spec.material ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <dt className="text-xs font-medium text-muted-foreground">{S.productionSpecFinishNotesLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">{card.spec.finishNotes ?? "—"}</dd>
              </div>
            </dl>
          </section>

          {/* Approved file download card */}
          <section className="apple-card p-6 sm:p-7">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Download className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                {S.productionApprovedFileHeading}
              </h2>
            </div>

            {card.approvedFile ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {card.approvedFile.fileName}
                    </p>
                    <p className="text-2xs text-muted-foreground">الملف المعتمَد للطباعة والتنفيذ</p>
                  </div>
                </div>

                <a
                  href={card.approvedFile.downloadUrl}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>تنزيل الملف</span>
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{S.productionApprovedFileEmpty}</p>
            )}
          </section>

          {/* External vendor controls */}
          {(card.vendorRecord !== null || isInProduction) && (
            <section className="apple-card p-6 sm:p-7">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {S.productionVendorHeading}
                  </h2>
                  <p className="text-xs text-muted-foreground">إرسال واستلام من الورش الخارجية</p>
                </div>
              </div>

              {card.vendorRecord ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      المورّد: {card.vendorRecord.vendorName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      تاريخ الإرسال: {formatDate(card.vendorRecord.sentAt)}
                    </span>
                  </div>

                  {card.vendorRecord.receivedAt ? (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{S.productionVendorReceivedLabel} {formatDate(card.vendorRecord.receivedAt)}</span>
                    </div>
                  ) : (
                    vendorAwaitingReceipt && (
                      <form action={recordReceivedFromVendorAction}>
                        <input type="hidden" name="workItemId" value={workItemId} />
                        <input type="hidden" name="recordId" value={card.vendorRecord.recordId} />
                        <Button type="submit" variant="default" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{S.productionVendorReceiveButton}</span>
                        </Button>
                      </form>
                    )
                  )}
                </div>
              ) : isInProduction ? (
                <form action={recordSentToVendorAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="workItemId" value={workItemId} />
                  <div className="flex flex-1 flex-col gap-1.5 min-w-[200px]">
                    <label className="text-xs font-semibold text-foreground">{S.productionVendorNameLabel}</label>
                    <input name="vendorName" required placeholder="اسم الورشة أو المصنع الخارجي..." className={inputCls} />
                  </div>
                  <Button type="submit" variant="default" size="sm">
                    <Truck className="h-4 w-4" />
                    <span>{S.productionVendorSendButton}</span>
                  </Button>
                </form>
              ) : null}
            </section>
          )}
        </div>

        {/* Right Column: Timer + Complete + Return to Design */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Timer controls card */}
          <section className="apple-card p-6 sm:p-7">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {S.productionTimerHeading}
                </h2>
                <p className="text-xs text-muted-foreground">تسجيل ساعات العمل الفعلية على خط الإنتاج</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {isReady && (
                <form action={startProductionAction} className="w-full">
                  <input type="hidden" name="workItemId" value={workItemId} />
                  <Button type="submit" variant="default" size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Play className="h-4 w-4" />
                    <span>{S.productionStartButton}</span>
                  </Button>
                </form>
              )}
              {isInProduction && (
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  <form action={pauseProductionAction}>
                    <input type="hidden" name="workItemId" value={workItemId} />
                    <Button type="submit" variant="outline" size="sm" className="w-full">
                      <Pause className="h-4 w-4" />
                      <span>{S.myQueuePauseButton}</span>
                    </Button>
                  </form>
                  <form action={resumeProductionAction}>
                    <input type="hidden" name="workItemId" value={workItemId} />
                    <Button type="submit" variant="outline" size="sm" disabled={hasPendingRevision} className="w-full">
                      <Play className="h-4 w-4" />
                      <span>{S.myQueueResumeButton}</span>
                    </Button>
                  </form>
                </div>
              )}
              {!isReady && !isInProduction && (
                <p className="text-xs text-muted-foreground">{S.productionTimerNotAvailableNote}</p>
              )}
            </div>
          </section>

          {/* Complete production card */}
          {isInProduction && (
            <section className="apple-card p-6 sm:p-7 border-emerald-500/20 bg-linear-to-b from-card to-emerald-500/5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {S.productionCompleteHeading}
                  </h2>
                  <p className="text-xs text-muted-foreground">تسجيل الكمية المنتجة وإتمام الطلب</p>
                </div>
              </div>

              <form action={completeProductionAction} className="flex flex-col gap-3.5">
                <input type="hidden" name="workItemId" value={workItemId} />
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.productionProducedQuantityLabel}
                  </label>
                  <input
                    name="producedQuantity"
                    type="number"
                    min={1}
                    required
                    defaultValue={card.spec.quantity ?? 1}
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.productionNotesLabel}
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="ملاحظات الإنهاء وموقع التخزين..."
                    className={inputCls}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="default" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{S.productionCompleteButton}</span>
                  </Button>
                </div>
              </form>
            </section>
          )}

          {/* Send back to design card */}
          {isInProduction && (
            <section className="apple-card p-6 sm:p-7 border-amber-500/20 bg-linear-to-b from-card to-amber-500/5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {S.productionSendBackHeading}
                  </h2>
                  <p className="text-xs text-muted-foreground">إعادة الصنف للتصميم في حال وجود خطأ في الملف</p>
                </div>
              </div>

              <form action={sendBackToDesignAction} className="flex flex-col gap-3.5">
                <input type="hidden" name="workItemId" value={workItemId} />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.productionSendBackReasonLabel}
                  </label>
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    placeholder="سبب إعادة الصنف إلى مرحلة التصميم بالتفصيل..."
                    className={inputCls}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="outline" className="w-full border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300">
                    <RotateCcw className="h-4 w-4" />
                    <span>{S.productionSendBackButton}</span>
                  </Button>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
