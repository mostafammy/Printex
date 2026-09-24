// versions.ts — Specification versioning, audit, and history.
// contracts/change-control.md §In-transaction building blocks & Commands/queries.

import { z } from "zod";
import { Prisma } from "../../../generated/prisma";
import type {
  SpecVersionOrigin,
  WorkItemDimensionUnit,
} from "../../../generated/prisma";
import { audit } from "~/server/auth";
import {
  fail,
  type TxScope,
  type WorkItemState,
} from "~/server/core";
import { defineQuery } from "./aspect";
import { diffSpecSnapshots, type SpecFieldChange } from "./diff";
import { emitSpecChangedInTx, SPEC_CHANGED } from "./events";
import {
  mergeSpecPatch,
  specPatchSchema,
  toSpecSnapshot,
  type SpecPatchInput,
  type SpecSnapshot,
  type SpecVersionView,
} from "./specFields";
import { effectiveDepartmentId } from "./recipients";

export type ApplySpecChangeInput = {
  workItemId: string;
  actorId: string;
  origin: "DIRECT_EDIT" | "CHANGE_REQUEST" | "ADMIN_OVERRIDE";
  patch: SpecPatchInput;
  expected: { version: number } | { specVersionId: string };
  reason: string | null;
  changeRequestId?: string | null;
  /** "fail" (016 commands): an empty diff → NO_CHANGES. "skip" (011 editWorkItem): return null, write nothing. */
  ifUnchanged: "fail" | "skip";
};


export type AppliedSpecChange = {
  previous: SpecVersionView;
  current: SpecVersionView;
  changes: readonly SpecFieldChange[];
};

export type SpecHistoryResult = {
  versions: SpecVersionView[];
  diffs: { from: number; to: number; changes: readonly SpecFieldChange[] }[];
  noHistoryBeforeNow?: boolean;
  current?: SpecSnapshot;
};

type SpecVersionRowWithCreatedBy = {
  id: string;
  workItemId: string;
  version: number;
  origin: SpecVersionOrigin;
  productTypeId: string | null;
  description: string | null;
  quantity: number | null;
  widthValue: Prisma.Decimal | null;
  heightValue: Prisma.Decimal | null;
  dimensionUnit: WorkItemDimensionUnit | null;
  material: string | null;
  finishNotes: string | null;
  stateAtCreation: WorkItemState;
  reason: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
};

export function toSpecVersionView(
  row: SpecVersionRowWithCreatedBy,
): SpecVersionView {
  return {
    id: row.id,
    workItemId: row.workItemId,
    version: row.version,
    origin: row.origin,
    snapshot: toSpecSnapshot(row),
    stateAtCreation: row.stateAtCreation,
    reason: row.reason,
    createdBy: row.createdBy
      ? { id: row.createdBy.id, name: row.createdBy.name }
      : null,
    createdAt: row.createdAt,
  };
}

/**
 * Creates v1 (INITIAL) for a freshly created Work Item.
 * Audits spec_version.created. Does not emit SPEC_CHANGED (FR-021: "after v1").
 */
export async function createInitialSpecVersionInTx(
  scope: TxScope,
  input: { workItemId: string; actorId: string },
): Promise<SpecVersionView> {
  const tx = scope.tx;
  const workItem = await tx.workItem.findUnique({

    where: { id: input.workItemId },
    select: {
      id: true,
      state: true,
      productTypeId: true,
      description: true,
      quantity: true,
      widthValue: true,
      heightValue: true,
      dimensionUnit: true,
      material: true,
      finishNotes: true,
    },
  });

  if (!workItem) {
    return fail({
      code: "NOT_FOUND",
      entity: "WorkItem",
      id: input.workItemId,
    });
  }

  const v1 = await tx.specVersion.create({
    data: {
      workItemId: input.workItemId,
      version: 1,
      origin: "INITIAL",
      productTypeId: workItem.productTypeId,
      description: workItem.description,
      quantity: workItem.quantity,
      widthValue: workItem.widthValue,
      heightValue: workItem.heightValue,
      dimensionUnit: workItem.dimensionUnit,
      material: workItem.material,
      finishNotes: workItem.finishNotes,
      stateAtCreation: workItem.state,
      reason: null,
      createdById: input.actorId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  await tx.workItem.update({
    where: { id: input.workItemId },
    data: { currentSpecVersionId: v1.id },
  });

  await audit.record(tx, {
    action: "spec_version.created",
    entityType: "SpecVersion",
    entityId: v1.id,
    actorId: input.actorId,
    after: toSpecSnapshot(v1),
  });

  return toSpecVersionView(v1);
}

/**
 * Ensures the Work Item points to its current specification version.
 * If currentSpecVersionId is null, creates a BACKFILL v1 (createdById: null)
 * from current columns and sets the pointer. Idempotent within a transaction.
 */
export async function ensureCurrentSpecVersionInTx(
  scope: TxScope,
  workItemId: string,
): Promise<SpecVersionView> {
  const tx = scope.tx;
  const item = await tx.workItem.findUnique({
    where: { id: workItemId },
    include: {
      currentSpecVersion: {
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!item) {
    return fail({ code: "NOT_FOUND", entity: "WorkItem", id: workItemId });
  }

  if (item.currentSpecVersion) {
    return toSpecVersionView(item.currentSpecVersion);
  }

  const existing = await tx.specVersion.findFirst({
    where: { workItemId },
    orderBy: { version: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (existing) {
    await tx.workItem.update({
      where: { id: workItemId },
      data: { currentSpecVersionId: existing.id },
    });
    return toSpecVersionView(existing);
  }

  const v1 = await tx.specVersion.create({
    data: {
      workItemId,
      version: 1,
      origin: "BACKFILL",
      productTypeId: item.productTypeId,
      description: item.description,
      quantity: item.quantity,
      widthValue: item.widthValue,
      heightValue: item.heightValue,
      dimensionUnit: item.dimensionUnit,
      material: item.material,
      finishNotes: item.finishNotes,
      stateAtCreation: item.state,
      reason: "Backfilled by 016-change-control from current values",
      createdById: null,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  await tx.workItem.update({
    where: { id: workItemId },
    data: { currentSpecVersionId: v1.id },
  });

  await audit.record(tx, {
    action: "spec_version.created",
    entityType: "SpecVersion",
    entityId: v1.id,
    after: toSpecSnapshot(v1),
    reason: v1.reason ?? undefined,
  });

  return toSpecVersionView(v1);
}


/**
 * The single writer of the Work Item spec mirror columns (FR-010).
 * Append-only: never calls specVersion.update or specVersion.delete.
 */
export async function applySpecChangeInTx(
  scope: TxScope,
  input: ApplySpecChangeInput,
): Promise<AppliedSpecChange | null> {
  const tx = scope.tx;

  // 1. Take a row lock on the Work Item (SELECT … FOR UPDATE)
  const rows = await tx.$queryRaw<
    { id: string; orderId: string; state: WorkItemState }[]
  >`
    SELECT id, "orderId", state FROM "WorkItem" WHERE id = ${input.workItemId} FOR UPDATE
  `;
  const [workItem] = rows;
  if (!workItem) {
    return fail({
      code: "NOT_FOUND",
      entity: "WorkItem",
      id: input.workItemId,
    });
  }

  // 2. Run ensureCurrentSpecVersionInTx
  const currentVersionView = await ensureCurrentSpecVersionInTx(
    scope,
    input.workItemId,
  );

  // 3. Compare against expected, refusing a mismatch with STALE_SPEC_VERSION
  if ("version" in input.expected) {
    if (currentVersionView.version !== input.expected.version) {
      return fail({
        code: "STALE_SPEC_VERSION",
        currentVersion: currentVersionView.version,
      });
    }
  } else if ("specVersionId" in input.expected) {
    if (currentVersionView.id !== input.expected.specVersionId) {
      return fail({
        code: "STALE_SPEC_VERSION",
        currentVersion: currentVersionView.version,
      });
    }
  }

  // 4. Parse & validate patch, and validate productTypeId existence
  const parseResult = specPatchSchema.safeParse(input.patch);
  if (!parseResult.success) {
    return fail({
      code: "VALIDATION",
      issues: parseResult.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  const parsedPatch = parseResult.data;


  if (parsedPatch.productTypeId) {
    const pt = await tx.productType.findUnique({
      where: { id: parsedPatch.productTypeId },
    });
    if (!pt) {
      return fail({
        code: "NOT_FOUND",
        entity: "ProductType",
        id: parsedPatch.productTypeId,
      });
    }
  }

  // 5. Compute diffSpecSnapshots(current, merged)
  const currentSnapshot = currentVersionView.snapshot;
  const merged = mergeSpecPatch(currentSnapshot, parsedPatch);
  const changes = diffSpecSnapshots(currentSnapshot, merged);

  if (changes.length === 0) {
    if (input.ifUnchanged === "skip") {
      return null;
    }
    return fail({ code: "NO_CHANGES" });
  }

  // 6. Insert version n + 1
  const nextVersion = currentVersionView.version + 1;
  const newVersionRow = await tx.specVersion.create({
    data: {
      workItemId: input.workItemId,
      version: nextVersion,
      origin: input.origin,
      productTypeId: merged.productTypeId,
      description: merged.description,
      quantity: merged.quantity,
      widthValue:
        merged.widthValue !== null
          ? new Prisma.Decimal(merged.widthValue)
          : null,
      heightValue:
        merged.heightValue !== null
          ? new Prisma.Decimal(merged.heightValue)
          : null,
      dimensionUnit: merged.dimensionUnit,
      material: merged.material,
      finishNotes: merged.finishNotes,
      stateAtCreation: workItem.state,
      reason: input.reason ?? null,
      createdById: input.actorId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  // 7. Update mirror columns and pointer
  await tx.workItem.update({
    where: { id: input.workItemId },
    data: {
      currentSpecVersionId: newVersionRow.id,
      productTypeId: merged.productTypeId,
      description: merged.description,
      quantity: merged.quantity,
      widthValue:
        merged.widthValue !== null
          ? new Prisma.Decimal(merged.widthValue)
          : null,
      heightValue:
        merged.heightValue !== null
          ? new Prisma.Decimal(merged.heightValue)
          : null,
      dimensionUnit: merged.dimensionUnit,
      material: merged.material,
      finishNotes: merged.finishNotes,
    },
  });

  // 8. Audit spec_version.created
  const beforeAudit: Record<string, unknown> = {};
  const afterAudit: Record<string, unknown> = {};
  for (const c of changes) {
    beforeAudit[c.field] = c.before;
    afterAudit[c.field] = c.after;
  }
  await audit.record(tx, {
    action: "spec_version.created",
    entityType: "SpecVersion",
    entityId: newVersionRow.id,
    actorId: input.actorId,
    before: beforeAudit,
    after: afterAudit,
    reason: input.reason ?? undefined,
  });

  // 9. emitSpecChangedInTx
  await emitSpecChangedInTx(tx, {
    type: SPEC_CHANGED,
    workItemId: input.workItemId,
    orderId: workItem.orderId,
    fromVersion: currentVersionView.version,
    toVersion: nextVersion,
    specVersionId: newVersionRow.id,
    origin: input.origin,
    changeRequestId: input.changeRequestId ?? null,
    changedFields: changes.map((c) => c.field),
    workItemState: workItem.state,
    actorId: input.actorId,
    occurredAt: newVersionRow.createdAt,
  });

  const currentView = toSpecVersionView(newVersionRow);
  return {
    previous: currentVersionView,
    current: currentView,
    changes,
  };
}

const getSpecHistoryInputSchema = z.object({
  workItemId: z.string().min(1),
});

const VIEW_SPEC_PERMISSIONS = [
  "order.edit",
  "finance.view",
  "design.work",
  "design.review",
  "change.approve",
  "admin.override",
  "production.operate",
] as const;

/**
 * getSpecHistory — defined via defineQuery with department-scope authorize hook.
 * contracts/change-control.md §Commands and queries.
 */
export const getSpecHistory = defineQuery({
  input: getSpecHistoryInputSchema,
  permission: VIEW_SPEC_PERMISSIONS,
  authorize: async ({ client, actor, input, check }) => {
    const nonProductionQualifying = [
      "order.edit",
      "finance.view",
      "design.work",
      "design.review",
      "change.approve",
      "admin.override",
    ] as const;
    const hasGlobalQualifying = nonProductionQualifying.some((p) =>
      actor.permissions.has(p),
    );
    if (hasGlobalQualifying) {
      return;
    }

    const item = await client.workItem.findUnique({
      where: { id: input.workItemId },
      select: {
        departmentId: true,
        productType: { select: { defaultDepartmentId: true } },
      },
    });
    if (!item) {
      return fail({
        code: "NOT_FOUND",
        entity: "WorkItem",
        id: input.workItemId,
      });
    }
    const effDeptId = effectiveDepartmentId(item) ?? undefined;
    check("production.operate", { departmentId: effDeptId });
  },
  run: async ({ client, input }): Promise<SpecHistoryResult> => {
    const item = await client.workItem.findUnique({
      where: { id: input.workItemId },
      select: {
        id: true,
        currentSpecVersionId: true,
        productTypeId: true,
        description: true,
        quantity: true,
        widthValue: true,
        heightValue: true,
        dimensionUnit: true,
        material: true,
        finishNotes: true,
        specVersions: {
          orderBy: { version: "asc" },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!item) {
      return fail({
        code: "NOT_FOUND",
        entity: "WorkItem",
        id: input.workItemId,
      });
    }

    if (item.currentSpecVersionId === null || item.specVersions.length === 0) {
      return {
        versions: [],
        diffs: [],
        noHistoryBeforeNow: true,
        current: toSpecSnapshot(item),
      };
    }

    const versions = item.specVersions.map(toSpecVersionView);
    const diffs: {
      from: number;
      to: number;
      changes: readonly SpecFieldChange[];
    }[] = [];
    for (let i = 1; i < versions.length; i++) {
      const fromV = versions[i - 1];
      const toV = versions[i];
      if (!fromV || !toV) continue;
      const changes = diffSpecSnapshots(fromV.snapshot, toV.snapshot);
      diffs.push({
        from: fromV.version,
        to: toV.version,
        changes,
      });
    }


    return {
      versions,
      diffs,
      noHistoryBeforeNow: false,
      current: toSpecSnapshot(item),
    };
  },
});
