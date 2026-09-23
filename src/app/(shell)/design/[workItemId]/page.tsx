// Design workspace page — 012-designer-assignment-timers US4 (T034).
// Upload a design version (file + note) and mark design complete.
// Server Component: no "use client". Inline Server Actions.

import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import Link from "next/link";
import { revalidatePath } from "next/cache";
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
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

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
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{S.designWorkspacePageTitle}</h1>
        <p className="text-muted-foreground">{S.designWorkspaceNotFound}</p>
      </div>
    );
  }

  const versions = await db.designVersion.findMany({
    where: { workItemId },
    orderBy: { version: "desc" },
  });

  const canMarkComplete = versions.length > 0 && workItem.state === "IN_DESIGN";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/orders/${workItem.orderId}`} className="text-sm text-primary hover:underline">
          {S.designWorkspaceBackLink}
        </Link>
        <h1 className="text-xl font-semibold">
          {S.designWorkspacePageTitle} — {workItem.description ?? workItem.id}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            {S.tableHeaderCustomer}: {workItem.order.customer.name}
          </span>
          <span>
            {S.productTypeLabel}: {workItem.productType?.name ?? S.productTypeNone}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{workItem.state}</span>
        </div>
      </div>

      {/* Upload design version */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.uploadDesignVersionHeading}</h2>
        {workItem.state === "IN_DESIGN" ? (
          <form action={uploadDesignVersionAction} className="flex flex-col gap-3">
            <input type="hidden" name="workItemId" value={workItem.id} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.designVersionFileLabel}</label>
              <input name="file" type="file" required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{S.designVersionNoteLabel}</label>
              <input name="note" type="text" className={inputCls} />
            </div>
            <div>
              <Button type="submit" variant="default" size="sm">
                {S.uploadDesignVersionButton}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">{S.uploadDesignVersionNotInDesignNote}</p>
        )}
      </section>

      {/* Version history */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.designVersionHistoryHeading}</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{S.designVersionHistoryEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="border-s-2 border-border ps-3">
                <span className="font-medium">
                  {S.designVersionLabel} {v.version} — {v.fileName}
                </span>{" "}
                <span className="text-muted-foreground">
                  — {new Date(v.createdAt).toLocaleString("ar-EG")}
                </span>
                {v.note && <span className="text-muted-foreground"> ({v.note})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mark design complete */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-base font-semibold">{S.markDesignCompleteHeading}</h2>
        <form action={markDesignCompleteAction} className="flex flex-col gap-2">
          <input type="hidden" name="workItemId" value={workItem.id} />
          <div>
            <Button type="submit" variant="default" size="sm" disabled={!canMarkComplete}>
              {S.markDesignCompleteButton}
            </Button>
          </div>
          {versions.length === 0 && (
            <p className="text-xs text-muted-foreground">{S.markDesignCompleteDisabledNote}</p>
          )}
        </form>
      </section>
    </div>
  );
}
