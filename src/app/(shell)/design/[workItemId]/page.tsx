// Design workspace page — 012-designer-assignment-timers US4 (T034).
// Upload a design version (file + note) and mark design complete.
// Server Component: no "use client". Inline Server Actions.

import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  ArrowRight,
  Palette,
  UploadCloud,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { db } from "~/server/db";
import { getActor } from "~/server/auth";
import {
  uploadDesignVersion,
  markDesignComplete,
  DomainDesignerError,
  WorkItemDesignTransitionError,
} from "~/server/designers";
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

// ── Server Actions ──────────────────────────────────────────────────────────

async function uploadDesignVersionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  const note = formStr(formData.get("note"));
  const file = formData.get("file");
  if (!workItemId || !(file instanceof File) || file.size === 0) return;

  const stream = Readable.fromWeb(
    file.stream() as unknown as NodeWebReadableStream<Uint8Array>,
  );

  try {
    await uploadDesignVersion(
      actor,
      workItemId,
      { stream, fileName: file.name, mimeType: file.type || undefined },
      note,
    );
  } catch (caught) {
    if (caught instanceof DomainDesignerError) return; // NOT_ASSIGNEE / NOT_IN_DESIGN
    throw caught;
  }
  revalidatePath(`/design/${workItemId}`);
}

async function markDesignCompleteAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  const workItemId = formStr(formData.get("workItemId"));
  if (!workItemId) return;

  try {
    await markDesignComplete(actor, workItemId);
  } catch (caught) {
    if (caught instanceof DomainDesignerError) return; // NOT_ASSIGNEE / NOT_IN_DESIGN / NO_DESIGN_VERSION
    if (caught instanceof WorkItemDesignTransitionError) return;
    throw caught;
  }
  revalidatePath(`/design/${workItemId}`);
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function DesignWorkspacePage({
  params,
}: {
  params: Promise<{ workItemId: string }>;
}) {
  const { workItemId } = await params;

  const workItem = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { order: { include: { customer: true } }, productType: true },
  });

  if (!workItem) {
    return (
      <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{S.designWorkspacePageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{S.designWorkspaceNotFound}</p>
        <Link
          href="/my-queue"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة لقائمة المهام</span>
        </Link>
      </div>
    );
  }

  const versions = await db.designVersion.findMany({
    where: { workItemId },
    orderBy: { version: "desc" },
  });

  const canMarkComplete = versions.length > 0 && workItem.state === "IN_DESIGN";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Navigation & Back affordance ── */}
      <div>
        <Link
          href={`/orders/${workItem.orderId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>{S.designWorkspaceBackLink}</span>
        </Link>
      </div>

      {/* ── Hero Workspace Header ── */}
      <div className="apple-bento-card relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-purple-500/[0.06] via-card to-card border-purple-500/25">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-gradient-to-br from-purple-500/15 via-indigo-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 apple-glow-purple">
              <Palette className="h-8 w-8" />
              <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {workItem.description ?? `صنف #${workItem.id.slice(-6)}`}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 px-3 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-3 w-3" />
                  <span>{workItem.state}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{S.designWorkspacePageTitle}</span>
                <span>·</span>
                <span className="font-mono font-semibold text-foreground">
                  الطلب #{workItem.order.number}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card/90 px-3.5 py-2 text-foreground shadow-2xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 font-bold text-2xs">
                {workItem.order.customer.name.slice(0, 1)}
              </div>
              <div>
                <span className="text-2xs text-muted-foreground block">{S.tableHeaderCustomer}</span>
                <span className="font-bold">{workItem.order.customer.name}</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card/90 px-3.5 py-2 text-foreground shadow-2xs">
              <Layers className="h-4 w-4 text-purple-500" />
              <div>
                <span className="text-2xs text-muted-foreground block">{S.productTypeLabel}</span>
                <span className="font-bold">{workItem.productType?.name ?? S.productTypeNone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Bento Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Upload New Version & Mark Complete */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Upload card */}
          <section className="apple-bento-card p-6 sm:p-7 border-border/70">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {S.uploadDesignVersionHeading}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    رفع ملف التصميم المعتمَد (PDF, AI, PSD, أو صورة عالية الدقة)
                  </p>
                </div>
              </div>
            </div>

            {workItem.state === "IN_DESIGN" ? (
              <form action={uploadDesignVersionAction} className="flex flex-col gap-4">
                <input type="hidden" name="workItemId" value={workItem.id} />
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.designVersionFileLabel}
                  </label>
                  <div className="apple-dropzone rounded-2xl p-7 text-center cursor-pointer">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <input
                      name="file"
                      type="file"
                      required
                      className="cursor-pointer text-xs text-muted-foreground file:ms-0 file:me-3 file:rounded-xl file:border-0 file:bg-primary file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:brightness-105 active:file:scale-95 transition-all"
                    />
                    <span className="mt-2 block text-2xs text-muted-foreground">
                      يدعم كافة صيغ الطباعة والتصميم الاحترافية حتى 50MB
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {S.designVersionNoteLabel}
                  </label>
                  <input
                    name="note"
                    type="text"
                    placeholder="ملاحظات توضيحية حول التعديلات أو أبعاد التصميم..."
                    className={inputCls}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="default" className="w-full sm:w-auto">
                    <UploadCloud className="h-4 w-4" />
                    <span>{S.uploadDesignVersionButton}</span>
                  </Button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs font-medium text-amber-700 dark:text-amber-300">
                <p>{S.uploadDesignVersionNotInDesignNote}</p>
              </div>
            )}
          </section>

          {/* Mark design complete action card */}
          <section className="apple-bento-card p-6 sm:p-7 border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.03] via-card to-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {S.markDesignCompleteHeading}
                </h2>
                <p className="text-xs text-muted-foreground">
                  إرسال الإصدار الأخير إلى قسم مراجعة البروفات للاعتماد
                </p>
              </div>
            </div>

            <form action={markDesignCompleteAction} className="flex flex-col gap-3">
              <input type="hidden" name="workItemId" value={workItem.id} />
              <div>
                <Button
                  type="submit"
                  variant="default"
                  disabled={!canMarkComplete}
                  className={`w-full sm:w-auto ${
                    canMarkComplete
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 apple-glow-emerald"
                      : ""
                  }`}
                >
                  <FileCheck className="h-4 w-4" />
                  <span>{S.markDesignCompleteButton}</span>
                </Button>
              </div>
              {versions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {S.markDesignCompleteDisabledNote}
                </p>
              )}
            </form>
          </section>
        </div>

        {/* Right Column: Version History */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className="apple-bento-card flex flex-col p-6 sm:p-7 h-full border-border/70">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {S.designVersionHistoryHeading}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {versions.length} {versions.length === 1 ? "إصدار مسجل" : "إصدارات مسجلة"}
                  </p>
                </div>
              </div>
            </div>

            {versions.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                  <Layers className="h-7 w-7" />
                </div>
                <p className="text-sm font-bold text-foreground">
                  {S.designVersionHistoryEmpty}
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  قم برفع الإصدار الأول لبدء دورة العمل والمراجعة مع العميل.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((v, idx) => (
                  <div
                    key={v.id}
                    className={`relative rounded-2xl border p-4.5 transition-all ${
                      idx === 0
                        ? "border-primary/30 bg-primary/5 shadow-2xs apple-glow-blue"
                        : "border-border/60 bg-muted/20 hover:border-border/90 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center rounded-xl px-2.5 py-1 font-mono text-xs font-bold ${
                            idx === 0
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {S.designVersionLabel} {v.version}
                        </span>
                        <span className="font-bold text-sm text-foreground truncate max-w-[190px]">
                          {v.fileName}
                        </span>
                      </div>
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-2xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>الأحدث</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 text-2xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(v.createdAt).toLocaleString("ar-EG")}</span>
                    </div>

                    {v.note && (
                      <p className="mt-2 rounded-xl bg-background/60 p-2.5 text-xs text-muted-foreground border border-border/40">
                        {v.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
