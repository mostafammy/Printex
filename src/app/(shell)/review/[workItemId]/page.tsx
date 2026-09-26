// Review screen — 013-review-rework US2/US3 (T018, T027).
// Current + prior design versions, order spec, customer notes, Approve
// button, Reject form (category/origin department/explanation/optional
// note+attachments). Server Component: no "use client". Inline Server
// Actions — mirrors src/app/(shell)/design/[workItemId]/page.tsx's shape.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  ArrowRight,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
  User,
  Sparkles,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { db } from "~/server/db";
import { getActor } from "~/server/auth";
import {
  getReviewDetail,
  approveDesign,
  rejectDesign,
  DomainReviewError,
  WorkItemTransitionError,
} from "~/server/review";
import type { RejectionCategory } from "~/server/core";
import type { ReturnAttachmentFile } from "~/server/review";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

const selectCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
  "focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 transition-all duration-200 shadow-2xs";

const REJECTION_CATEGORY_OPTIONS: RejectionCategory[] = [
  "DESIGN_ISSUE",
  "DIMENSION_ISSUE",
  "CUSTOMER_CHANGE",
  "PRICING_ISSUE",
  "ACCOUNTING_ISSUE",
  "PRODUCTION_ISSUE",
  "MISSING_INFORMATION",
  "OTHER",
];

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function fileToAttachment(
  file: FormDataEntryValue | null,
  kind: ReturnAttachmentFile["kind"],
): ReturnAttachmentFile | null {
  if (!(file instanceof File) || file.size === 0) return null;
  const stream = Readable.fromWeb(file.stream() as unknown as NodeWebReadableStream<Uint8Array>);
  return { kind, fileName: file.name, mimeType: file.type ? file.type : undefined, stream };
}

// ── Server Actions ──────────────────────────────────────────────────────────

async function approveDesignAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;

  try {
    await approveDesign(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainReviewError) return;
    if (caught instanceof WorkItemTransitionError) return;
    throw caught;
  }
  revalidatePath(`/review/${workItemId}`);
}

async function rejectDesignAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;

  const category = formStr(formData.get("category")) as RejectionCategory;
  const originDepartmentId = formStr(formData.get("originDepartmentId"));
  const explanation = formStr(formData.get("explanation"));
  const note = formStr(formData.get("note"));

  const attachments = [
    fileToAttachment(formData.get("voiceNote"), "VOICE_NOTE"),
    fileToAttachment(formData.get("image"), "IMAGE"),
    fileToAttachment(formData.get("file"), "FILE"),
  ].filter((a): a is ReturnAttachmentFile => a !== null);

  try {
    await rejectDesign(actor, workItemId, {
      category,
      originDepartmentId,
      explanation,
      note: note ? note : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  } catch (caught) {
    if (caught instanceof DomainReviewError) return;
    if (caught instanceof WorkItemTransitionError) return;
    if (caught instanceof Error && caught.name === "ZodError") return;
    throw caught;
  }
  revalidatePath(`/review/${workItemId}`);
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ workItemId: string }>;
}) {
  const { workItemId } = await params;
  const actor = await getActor();

  let detail: Awaited<ReturnType<typeof getReviewDetail>>;
  try {
    detail = await getReviewDetail(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainReviewError) {
      return (
        <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{S.reviewDetailPageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{S.reviewDetailNotFound}</p>
          <Link
            href="/review"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة لطابور المراجعة</span>
          </Link>
        </div>
      );
    }
    throw caught;
  }

  const departments = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const priorVersions = detail.versions.slice(0, -1);
  const isReviewable = detail.state === "WAITING_REVIEW";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Navigation & Back affordance ── */}
      <div>
        <Link
          href={`/orders/${detail.order.orderId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>{S.reviewDetailBackLink}</span>
        </Link>
      </div>

      {/* ── Hero Review Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-amber-500/10 to-orange-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
              <Eye className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {S.reviewDetailPageTitle}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <Sparkles className="h-3 w-3" />
                  <span>{detail.state}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                طلب رقم #{detail.order.orderNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-foreground shadow-2xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">العميل:</span>
              <span className="font-semibold">{detail.order.customerName}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-foreground shadow-2xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">الكمية:</span>
              <span className="font-semibold">{detail.order.quantity ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Spec + Design Versions */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Order specification card */}
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
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <dt className="text-xs font-medium text-muted-foreground">{S.reviewQuantityLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">{detail.order.quantity ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <dt className="text-xs font-medium text-muted-foreground">{S.reviewDimensionsLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {detail.order.widthValue && detail.order.heightValue
                    ? `${detail.order.widthValue} × ${detail.order.heightValue} ${detail.order.dimensionUnit ?? ""}`
                    : "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <dt className="text-xs font-medium text-muted-foreground">{S.reviewMaterialLabel}</dt>
                <dd className="mt-1 font-semibold text-foreground">{detail.order.material ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">{S.reviewCustomerNotesLabel}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {detail.order.customerNotes ?? S.reviewCustomerNotesNone}
                </dd>
              </div>
            </dl>
          </section>

          {/* Current version card */}
          <section className="apple-card p-6 sm:p-7">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FileCheck className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                {S.reviewCurrentVersionHeading}
              </h2>
            </div>

            {detail.currentVersion ? (
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-600 text-white px-2.5 py-1 font-mono text-xs font-bold">
                      {S.designVersionLabel} {detail.currentVersion.version}
                    </span>
                    <span className="font-semibold text-sm text-foreground">
                      {detail.currentVersion.fileName}
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    قيد المراجعة
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(detail.currentVersion.uploadedAt).toLocaleString("ar-EG")}</span>
                </div>

                {detail.currentVersion.note && (
                  <p className="mt-3 rounded-xl bg-background/80 p-3 text-xs text-muted-foreground border border-border/50">
                    {detail.currentVersion.note}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{S.reviewCurrentVersionEmpty}</p>
            )}
          </section>

          {/* Prior versions */}
          <section className="apple-card p-6 sm:p-7">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                {S.reviewPriorVersionsHeading}
              </h2>
            </div>

            {priorVersions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{S.reviewPriorVersionsEmpty}</p>
            ) : (
              <ul className="space-y-2.5">
                {priorVersions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium text-muted-foreground">
                        {S.designVersionLabel} {v.version}
                      </span>
                      <span className="font-semibold text-foreground">{v.fileName}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(v.uploadedAt).toLocaleString("ar-EG")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column: Approval & Rejection Forms */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Approve Card */}
          <section className="apple-card p-6 sm:p-7 border-emerald-500/20 bg-linear-to-b from-card to-emerald-500/5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {S.reviewApproveHeading}
                </h2>
                <p className="text-xs text-muted-foreground">
                  اعتماد البروفة ونقل صنف العمل مباشرة إلى قسم الإنتاج
                </p>
              </div>
            </div>

            <form action={approveDesignAction} className="flex flex-col gap-3">
              <input type="hidden" name="workItemId" value={workItemId} />
              <div>
                <Button
                  type="submit"
                  variant="default"
                  disabled={!isReviewable}
                  className={`w-full ${isReviewable ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25" : ""}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{S.reviewApproveButton}</span>
                </Button>
              </div>
              {!isReviewable && (
                <p className="text-2xs text-muted-foreground">{S.reviewApproveNotReviewableNote}</p>
              )}
            </form>
          </section>

          {/* Reject Card */}
          <section className="apple-card p-6 sm:p-7 border-destructive/20 bg-linear-to-b from-card to-destructive/5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {S.reviewRejectHeading}
                </h2>
                <p className="text-xs text-muted-foreground">
                  إعادة صنف العمل إلى التصميم مع توضيح سبب الرفض
                </p>
              </div>
            </div>

            {isReviewable ? (
              <form action={rejectDesignAction} className="flex flex-col gap-3.5">
                <input type="hidden" name="workItemId" value={workItemId} />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.reviewRejectCategoryLabel}
                  </label>
                  <select name="category" required className={selectCls} defaultValue="">
                    <option value="" disabled>
                      {S.reviewRejectCategoryPlaceholder}
                    </option>
                    {REJECTION_CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {S.reviewRejectCategoryOptions[category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.reviewRejectOriginDepartmentLabel}
                  </label>
                  <select name="originDepartmentId" required className={selectCls} defaultValue="">
                    <option value="" disabled>
                      {S.reviewRejectOriginDepartmentPlaceholder}
                    </option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.reviewRejectExplanationLabel}
                  </label>
                  <textarea
                    name="explanation"
                    required
                    rows={3}
                    placeholder="شرح تفصيلي للملاحظات والمطلوب تعديله..."
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.reviewRejectNoteLabel}
                  </label>
                  <textarea
                    name="note"
                    rows={2}
                    placeholder="ملاحظات إضافية اختيارية..."
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-2xs font-semibold text-muted-foreground">
                      {S.reviewRejectVoiceNoteLabel}
                    </label>
                    <input name="voiceNote" type="file" accept="audio/*" className="text-xs text-muted-foreground file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1 file:text-2xs file:font-medium" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-2xs font-semibold text-muted-foreground">
                      {S.reviewRejectImageLabel}
                    </label>
                    <input name="image" type="file" accept="image/*" className="text-xs text-muted-foreground file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1 file:text-2xs file:font-medium" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-2xs font-semibold text-muted-foreground">
                      {S.reviewRejectFileLabel}
                    </label>
                    <input name="file" type="file" className="text-xs text-muted-foreground file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1 file:text-2xs file:font-medium" />
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="destructive" className="w-full">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{S.reviewRejectButton}</span>
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-muted-foreground">{S.reviewApproveNotReviewableNote}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
