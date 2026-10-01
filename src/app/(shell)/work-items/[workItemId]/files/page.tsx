// The Work Item's files — the surface `<FilePanel>` was built for.
//
// 050-files shipped a complete, tested FilePanel (categories, version
// history, upload, download, void/archive with reason, approve) plus the
// whole `~/server/files` service, API routes, and authorization — and then
// nothing rendered it. The component was unreachable: no page imported it and
// no nav entry pointed at it, so PRD §17's "the person working the job can
// see its files" had no UI at all.
//
// This page is that mount. It reads versions through 050's OWN service
// (`fileService.listVersions`) and asks 050's own `canListFileVersions`
// whether this actor may see them, rather than re-implementing either — so
// the answer is identical to the one 050's API routes give, and this page
// holds no second source of truth about what a file version is.
//
// Deliberately its own route rather than inlined into /design or /review:
// those are task workspaces whose layout is owned by 012/013/014, and this
// panel is reachable from any of them (plus production) by URL. Inlining
// would couple 050 to three other features' page layouts for no gain.
//
// RTL: logical Tailwind classes only (ms-/me-/ps-/pe-/start-/end-), enforced
// by the repo's ESLint rule (constitution IX).

import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Lock, Ruler, Layers, Sparkles } from "lucide-react";
import { getActor } from "~/server/auth";
import { canListFileVersions, fileService } from "~/server/files";
import { db } from "~/server/db";
import { FilePanel } from "~/components/files/file-panel";
import { Skeleton } from "~/components/ui/skeleton";
import ar from "~/messages/ar.json";
import { formatDimensions } from "~/lib/orders/workflowStation";

const S = ar.ui;

/**
 * 050's category vocabulary (DEFAULT_CATEGORIES in file-panel.tsx), passed
 * explicitly so the set is visible in one place and a new category is added
 * here deliberately rather than appearing by default.
 */
const CATEGORIES = [
  "ORIGINAL",
  "DESIGN_VERSIONS",
  "REVIEW_PROOF",
  "APPROVED",
  "PRODUCTION",
  "SUPPORTING",
] as const;

/** The page's phase-2 read — also the child section's prop type source (T051). */
const loadWorkItem = (workItemId: string) =>
  db.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      orderId: true,
      state: true,
      description: true,
      widthValue: true,
      heightValue: true,
      dimensionUnit: true,
      quantity: true,
      material: true,
      order: {
        select: {
          number: true,
          customer: { select: { name: true } },
        },
      },
      productType: { select: { name: true } },
    },
  });

type FilesWorkItem = NonNullable<Awaited<ReturnType<typeof loadWorkItem>>>;

export default async function WorkItemFilesPage({
  params,
}: {
  params: Promise<{ workItemId: string }>;
}) {
  const actor = await getActor();
  const { workItemId } = await params;

  const workItem = await loadWorkItem(workItemId);

  if (!workItem) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card shadow-xs flex flex-col items-center justify-center p-12 text-center">
        <h1 className="text-xl font-bold text-foreground">{S.filesTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{S.designWorkspaceNotFound}</p>
        <Link
          href="/my-queue"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowRight className="h-4 w-4" />
          <span>{S.designWorkspaceBackLink}</span>
        </Link>
      </div>
    );
  }

  // 050's own authorization decision. `allowed` is the answer its API routes
  // would give for the same actor and Work Item, so the page cannot drift
  // from the routes' access rules.
  const access = await canListFileVersions(actor, workItemId);

  if (!access.allowed) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card shadow-xs flex flex-col items-center justify-center p-12 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
          <Lock className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{S.filesTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {access.reason ?? S.filesForbidden}
        </p>
        <Link
          href={`/orders/${workItem.orderId}`}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowRight className="h-4 w-4" />
          <span>{S.designWorkspaceBackLink}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <Link
            href={`/orders/${workItem.orderId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>{S.designWorkspaceBackLink}</span>
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{S.filesTitle}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 font-mono text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{workItem.state}</span>
            </span>
          </div>
        </div>

        {/* Work Item Specs Card */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {workItem.description ?? `صنف #${workItem.id.slice(-6)}`}
              </h2>
              {workItem.order && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  الطلب #{workItem.order.number} · {workItem.order.customer?.name}
                </p>
              )}
            </div>
            {workItem.productType?.name && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/30 px-3 py-1 text-xs font-semibold text-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>{workItem.productType.name}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-2xs font-semibold text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3 w-3 text-primary" />
                الأبعاد والمقاس
              </span>
              <span className="text-sm font-bold font-mono text-foreground">
                {formatDimensions(workItem.widthValue, workItem.heightValue, workItem.dimensionUnit)}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-2xs font-semibold text-muted-foreground">
                {S.quantityLabel}
              </span>
              <span className="text-sm font-bold text-foreground">
                {workItem.quantity ?? "—"} قطعة
              </span>
            </div>

            {workItem.material && (
              <div className="col-span-2 sm:col-span-1 flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/20 p-2.5">
                <span className="text-2xs font-semibold text-muted-foreground">
                  الخامة
                </span>
                <span className="text-sm font-bold text-foreground truncate">
                  {workItem.material}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        Version data and the MUTATION callbacks are intentionally left
        unwired rather than guessed at. 050's upload / download / void /
        archive / approve are FormData-shaped with audit + revalidate
        requirements, while FilePanel takes plain callbacks; building that
        action layer is real work with real authorization and audit
        consequences, so it is left explicit here instead of being faked.
        The READ path — categories, history, status, size, uploader, time —
        is what makes the panel useful on day one, and 050's own API routes
        under /api/files/** already serve the mutations.

        092 T051 (investigation §12c): the 4-phase page's panel (phase 4)
        streams behind a shimmer skeleton — title, back link and the
        not-found/forbidden decisions above have already painted. Query
        order unchanged.
      */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <FileVersionsSection
          actor={actor}
          workItem={workItem}
          workItemId={workItemId}
        />
      </Suspense>
    </div>
  );
}

/** T051: phase 4 isolated so its await streams behind the Suspense above. */
async function FileVersionsSection({
  actor,
  workItem,
  workItemId,
}: {
  actor: Awaited<ReturnType<typeof getActor>>;
  workItem: FilesWorkItem;
  workItemId: string;
}) {
  // Cheap when there are no versions yet (the common case mid-design).
  const versions = await fileService.listVersions({ workItemId });

  return (
    <FilePanel
      workItemId={workItemId}
      categories={[...CATEGORIES]}
      fileVersions={versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        originalName: version.originalName,
        uploadedById: version.uploadedById,
        note: version.note,
        status: version.status,
        approved: version.approved,
        createdAt: version.createdAt,
        fileObject: version.fileObject
          ? {
              id: version.fileObject.id,
              sizeBytes: version.fileObject.sizeBytes,
              mimeType: version.fileObject.mimeType,
              sha256: version.fileObject.sha256,
              storageKey: version.fileObject.storageKey,
            }
          : null,
      }))}
      workItem={{
        id: workItem.id,
        orderId: workItem.orderId,
        state: workItem.state,
        description: workItem.description,
      }}
      currentUser={{
        id: actor.userId,
        // `actor.permissions` is a ReadonlySet (001's Actor) while the
        // panel's prop is a mutable Set — the panel only reads it, so a
        // copy is correct and keeps 001's readonly guarantee intact.
        permissions: new Set(actor.permissions),
        departmentIds: [...actor.departmentIds],
      }}
    />
  );
}
