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
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// Same literal set as src/server/review/review.ts's rejectDesignInputSchema
// (data-model.md / spec.md US3) — duplicated for the <select> options, not
// imported, since `~/server/review`'s barrel does not (and should not) carry
// this shop-domain-agnostic literal list; `RejectionCategory` (the type)
// keeps both lists in sync at compile time.
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
  return { kind, fileName: file.name, mimeType: file.type || undefined, stream };
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
    // DomainReviewError (NOT_REVIEWABLE/NO_DESIGN_VERSION/WORK_ITEM_NOT_FOUND)
    // or WorkItemTransitionError (self-review GUARD_FAILED, research.md §4) —
    // both leave state unchanged; the reload below simply re-shows the
    // review screen as-is (same silent-catch convention as
    // src/app/(shell)/design/[workItemId]/page.tsx).
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
      note: note || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  } catch (caught) {
    // Zod validation error (missing category/originDepartmentId/explanation,
    // spec.md US3 Acceptance Scenario 2), DomainReviewError, or
    // WorkItemTransitionError — all leave the Work Item's state unchanged;
    // the server remains authoritative even though the form also marks
    // these fields `required` (constitution V).
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
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">{S.reviewDetailPageTitle}</h1>
          <p className="text-muted-foreground">{S.reviewDetailNotFound}</p>
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/orders/${detail.order.orderId}`} className="text-sm text-primary hover:underline">
          {S.reviewDetailBackLink}
        </Link>
        <h1 className="text-xl font-semibold">
          {S.reviewDetailPageTitle} — {detail.order.customerName} #{detail.order.orderNumber}
        </h1>
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{detail.state}</span>
      </div>

      {/* Order specification + customer notes */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.reviewOrderSpecHeading}</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{S.reviewQuantityLabel}</dt>
            <dd>{detail.order.quantity ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{S.reviewDimensionsLabel}</dt>
            <dd>
              {detail.order.widthValue && detail.order.heightValue
                ? `${detail.order.widthValue} × ${detail.order.heightValue} ${detail.order.dimensionUnit ?? ""}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{S.reviewMaterialLabel}</dt>
            <dd>{detail.order.material ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{S.reviewCustomerNotesLabel}</dt>
            <dd>{detail.order.customerNotes ?? S.reviewCustomerNotesNone}</dd>
          </div>
        </dl>
      </section>

      {/* Current version */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.reviewCurrentVersionHeading}</h2>
        {detail.currentVersion ? (
          <div className="text-sm">
            <span className="font-medium">
              {S.designVersionLabel} {detail.currentVersion.version} — {detail.currentVersion.fileName}
            </span>{" "}
            <span className="text-muted-foreground">
              — {new Date(detail.currentVersion.uploadedAt).toLocaleString("ar-EG")}
            </span>
            {detail.currentVersion.note && (
              <p className="mt-1 text-muted-foreground">{detail.currentVersion.note}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{S.reviewCurrentVersionEmpty}</p>
        )}
      </section>

      {/* Prior versions */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.reviewPriorVersionsHeading}</h2>
        {priorVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{S.reviewPriorVersionsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {priorVersions.map((v) => (
              <li key={v.id} className="border-s-2 border-border ps-3">
                <span className="font-medium">
                  {S.designVersionLabel} {v.version} — {v.fileName}
                </span>{" "}
                <span className="text-muted-foreground">
                  — {new Date(v.uploadedAt).toLocaleString("ar-EG")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Approve */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.reviewApproveHeading}</h2>
        <form action={approveDesignAction} className="flex flex-col gap-2">
          <input type="hidden" name="workItemId" value={workItemId} />
          <div>
            <Button type="submit" variant="default" size="sm" disabled={!isReviewable}>
              {S.reviewApproveButton}
            </Button>
          </div>
          {!isReviewable && <p className="text-xs text-muted-foreground">{S.reviewApproveNotReviewableNote}</p>}
        </form>
      </section>

      {/* Reject */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.reviewRejectHeading}</h2>
        {isReviewable ? (
          <form action={rejectDesignAction} className="flex flex-col gap-3">
            <input type="hidden" name="workItemId" value={workItemId} />

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.reviewRejectCategoryLabel}</label>
              <select name="category" required className={inputCls} defaultValue="">
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

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.reviewRejectOriginDepartmentLabel}</label>
              <select name="originDepartmentId" required className={inputCls} defaultValue="">
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

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.reviewRejectExplanationLabel}</label>
              <textarea name="explanation" required rows={3} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.reviewRejectNoteLabel}</label>
              <textarea name="note" rows={2} className={inputCls} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{S.reviewRejectVoiceNoteLabel}</label>
                <input name="voiceNote" type="file" accept="audio/*" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{S.reviewRejectImageLabel}</label>
                <input name="image" type="file" accept="image/*" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{S.reviewRejectFileLabel}</label>
                <input name="file" type="file" className={inputCls} />
              </div>
            </div>

            <div>
              <Button type="submit" variant="outline" size="sm">
                {S.reviewRejectButton}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">{S.reviewApproveNotReviewableNote}</p>
        )}
      </section>
    </div>
  );
}
