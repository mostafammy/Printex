// tests/unit/changes/versions.test.ts
// Unit tests for versions.ts using in-memory fake tx.
// Covers: version n+1 numbering, NO_CHANGES vs skip, expected-version STALE check,
// mirror update payload equals the snapshot.

import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import {
  applySpecChangeInTx,
  createInitialSpecVersionInTx,
  ensureCurrentSpecVersionInTx,
} from "~/server/changes/versions";
import { toSpecSnapshot } from "~/server/changes/specFields";
import { __resetSpecChangeListenersForTests } from "~/server/changes/events";
import { AspectDomainError } from "~/server/core";

beforeEach(() => {
  __resetSpecChangeListenersForTests();
});

interface FakeWorkItem {
  id: string;
  orderId: string;
  state: "NEW";
  currentSpecVersionId: string | null;
  productTypeId: string | null;
  description: string | null;
  quantity: number | null;
  widthValue: Prisma.Decimal | null;
  heightValue: Prisma.Decimal | null;
  dimensionUnit: "CM" | null;
  material: string | null;
  finishNotes: string | null;
  assigneeId: string | null;
  departmentId: string | null;
  productType: { defaultDepartmentId: string | null } | null;
}

interface FakeSpecVersion {
  id: string;
  workItemId: string;
  version: number;
  origin: "INITIAL" | "BACKFILL" | "DIRECT_EDIT" | "CHANGE_REQUEST" | "ADMIN_OVERRIDE";
  productTypeId: string | null;
  description: string | null;
  quantity: number | null;
  widthValue: Prisma.Decimal | null;
  heightValue: Prisma.Decimal | null;
  dimensionUnit: "CM" | null;
  material: string | null;
  finishNotes: string | null;
  stateAtCreation: "NEW";
  reason: string | null;
  createdById: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
}

function createMockTx(initial?: {
  workItem?: Partial<FakeWorkItem>;
  currentSpecVersion?: Partial<FakeSpecVersion>;
  productType?: { id: string; name: string };
}) {
  const specVersions: FakeSpecVersion[] = [];

  let workItem: FakeWorkItem = {
    id: "wi-1",
    orderId: "ord-1",
    state: "NEW",
    currentSpecVersionId: initial?.currentSpecVersion?.id ?? null,
    productTypeId: initial?.workItem?.productTypeId ?? null,
    description: initial?.workItem?.description ?? "Item description",
    quantity: initial?.workItem?.quantity ?? 500,
    widthValue: initial?.workItem?.widthValue ?? null,
    heightValue: initial?.workItem?.heightValue ?? null,
    dimensionUnit: initial?.workItem?.dimensionUnit ?? null,
    material: initial?.workItem?.material ?? null,
    finishNotes: initial?.workItem?.finishNotes ?? null,
    assigneeId: null,
    departmentId: null,
    productType: null,
    ...initial?.workItem,
  };

  if (initial?.currentSpecVersion) {
    const v: FakeSpecVersion = {
      id: initial.currentSpecVersion.id ?? "spec-v1",
      workItemId: workItem.id,
      version: initial.currentSpecVersion.version ?? 1,
      origin: initial.currentSpecVersion.origin ?? "INITIAL",
      productTypeId: initial.currentSpecVersion.productTypeId ?? workItem.productTypeId,
      description: initial.currentSpecVersion.description ?? workItem.description,
      quantity: initial.currentSpecVersion.quantity ?? workItem.quantity,
      widthValue: initial.currentSpecVersion.widthValue ?? workItem.widthValue,
      heightValue: initial.currentSpecVersion.heightValue ?? workItem.heightValue,
      dimensionUnit: initial.currentSpecVersion.dimensionUnit ?? workItem.dimensionUnit,
      material: initial.currentSpecVersion.material ?? workItem.material,
      finishNotes: initial.currentSpecVersion.finishNotes ?? workItem.finishNotes,
      stateAtCreation: "NEW",
      reason: initial.currentSpecVersion.reason ?? null,
      createdById: initial.currentSpecVersion.createdById ?? "user-1",
      createdBy: { id: "user-1", name: "User One" },
      createdAt: new Date(),
    };
    specVersions.push(v);
    workItem.currentSpecVersionId = v.id;
  }

  const audits: Array<{ action: string; entityType: string; entityId: string; actorId?: string; before?: unknown; after?: unknown }> = [];
  const updatedWorkItemPayloads: Array<Partial<FakeWorkItem>> = [];

  const tx: unknown = {
    $queryRaw: async () => [{ id: workItem.id, orderId: workItem.orderId, state: workItem.state }],
    workItem: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== workItem.id) return null;
        const currentSpecVersion =
          specVersions.find((s) => s.id === workItem.currentSpecVersionId) ?? null;
        return {
          ...workItem,
          currentSpecVersion,
        };
      },
      update: async ({ data }: { where: { id: string }; data: Partial<FakeWorkItem> }) => {
        updatedWorkItemPayloads.push(data);
        workItem = { ...workItem, ...data };
        return workItem;
      },
    },
    specVersion: {
      create: async ({ data }: { data: Omit<FakeSpecVersion, "id" | "createdAt" | "createdBy"> }) => {
        const row: FakeSpecVersion = {
          id: `spec-${specVersions.length + 1}`,
          createdAt: new Date(),
          createdBy: data.createdById ? { id: data.createdById, name: "User" } : null,
          ...data,
        };
        specVersions.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { workItemId: string } }) => {
        const matching = specVersions.filter((s) => s.workItemId === where.workItemId);
        if (matching.length === 0) return null;
        return matching[matching.length - 1];
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return specVersions.find((s) => s.id === where.id) ?? null;
      },
    },
    productType: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (initial?.productType && initial.productType.id === where.id) {
          return initial.productType;
        }
        return null;
      },
    },
    auditEvent: {
      create: async ({ data }: { data: { action: string; entityType: string; entityId: string; actorId?: string } }) => {
        audits.push(data);
        return { id: `audit-${audits.length}`, ...data };
      },
    },
    notificationEvent: {
      create: async () => ({ id: "notif-1" }),
    },
  };

  return {
    scope: { tx: tx as Prisma.TransactionClient, afterCommit: (fn: () => Promise<void>) => void fn() },
    specVersions,
    getWorkItem: () => workItem,
    audits,
    updatedWorkItemPayloads,
  };
}

describe("versions.ts pure unit tests", () => {
  describe("version n+1 numbering", () => {
    it("advances version from 1 to 2", async () => {
      const { scope, specVersions, getWorkItem } = createMockTx({
        currentSpecVersion: { version: 1, quantity: 500 },
      });

      const res = await applySpecChangeInTx(scope, {
        workItemId: "wi-1",
        actorId: "actor-1",
        origin: "DIRECT_EDIT",
        patch: { quantity: 800 },
        expected: { version: 1 },
        reason: "Increase quantity",
        ifUnchanged: "fail",
      });

      expect(res).not.toBeNull();
      expect(res!.previous.version).toBe(1);
      expect(res!.current.version).toBe(2);
      expect(specVersions).toHaveLength(2);
      expect(specVersions[1]!.version).toBe(2);
      expect(getWorkItem().quantity).toBe(800);
    });

    it("advances version from 5 to 6", async () => {
      const { scope, specVersions } = createMockTx({
        currentSpecVersion: { version: 5, quantity: 500 },
      });

      const res = await applySpecChangeInTx(scope, {
        workItemId: "wi-1",
        actorId: "actor-1",
        origin: "DIRECT_EDIT",
        patch: { quantity: 600 },
        expected: { version: 5 },
        reason: "Bump quantity",
        ifUnchanged: "fail",
      });

      expect(res).not.toBeNull();
      expect(res!.previous.version).toBe(5);
      expect(res!.current.version).toBe(6);
      expect(specVersions[specVersions.length - 1]!.version).toBe(6);
    });
  });

  describe("NO_CHANGES vs skip", () => {
    it("returns null and writes nothing when ifUnchanged is 'skip' on identical values", async () => {
      const { scope, specVersions, updatedWorkItemPayloads, audits } = createMockTx({
        currentSpecVersion: { version: 1, quantity: 500 },
      });

      const res = await applySpecChangeInTx(scope, {
        workItemId: "wi-1",
        actorId: "actor-1",
        origin: "DIRECT_EDIT",
        patch: { quantity: 500 },
        expected: { version: 1 },
        reason: null,
        ifUnchanged: "skip",
      });

      expect(res).toBeNull();
      expect(specVersions).toHaveLength(1);
      expect(updatedWorkItemPayloads).toHaveLength(0);
      expect(audits).toHaveLength(0);
    });

    it("throws AspectDomainError NO_CHANGES when ifUnchanged is 'fail' on identical values", async () => {
      const { scope } = createMockTx({
        currentSpecVersion: { version: 1, quantity: 500 },
      });

      try {
        await applySpecChangeInTx(scope, {
          workItemId: "wi-1",
          actorId: "actor-1",
          origin: "DIRECT_EDIT",
          patch: { quantity: 500 },
          expected: { version: 1 },
          reason: null,
          ifUnchanged: "fail",
        });
        expect.unreachable("should have thrown AspectDomainError");
      } catch (err) {
        expect(err).toBeInstanceOf(AspectDomainError);
        expect((err as AspectDomainError<{ code: string }>).error.code).toBe("NO_CHANGES");
      }
    });
  });

  describe("expected-version STALE_SPEC_VERSION check", () => {
    it("throws STALE_SPEC_VERSION when expected.version mismatches current", async () => {
      const { scope } = createMockTx({
        currentSpecVersion: { version: 3, quantity: 500 },
      });

      try {
        await applySpecChangeInTx(scope, {
          workItemId: "wi-1",
          actorId: "actor-1",
          origin: "DIRECT_EDIT",
          patch: { quantity: 700 },
          expected: { version: 2 },
          reason: null,
          ifUnchanged: "fail",
        });
        expect.unreachable("should have thrown STALE_SPEC_VERSION");
      } catch (err) {
        expect(err).toBeInstanceOf(AspectDomainError);
        const domainErr = err as AspectDomainError<{ code: string; currentVersion?: number }>;
        expect(domainErr.error.code).toBe("STALE_SPEC_VERSION");
        if ("currentVersion" in domainErr.error) {
          expect(domainErr.error.currentVersion).toBe(3);
        }
      }
    });

    it("throws STALE_SPEC_VERSION when expected.specVersionId mismatches current", async () => {
      const { scope } = createMockTx({
        currentSpecVersion: { id: "spec-current", version: 2, quantity: 500 },
      });

      try {
        await applySpecChangeInTx(scope, {
          workItemId: "wi-1",
          actorId: "actor-1",
          origin: "DIRECT_EDIT",
          patch: { quantity: 700 },
          expected: { specVersionId: "spec-old" },
          reason: null,
          ifUnchanged: "fail",
        });
        expect.unreachable("should have thrown STALE_SPEC_VERSION");
      } catch (err) {
        expect(err).toBeInstanceOf(AspectDomainError);
        const domainErr = err as AspectDomainError<{ code: string; currentVersion?: number }>;
        expect(domainErr.error.code).toBe("STALE_SPEC_VERSION");
        if ("currentVersion" in domainErr.error) {
          expect(domainErr.error.currentVersion).toBe(2);
        }
      }
    });
  });

  describe("mirror update payload equals the snapshot", () => {
    it("asserts WorkItem mirror update matches toSpecSnapshot of the merged result", async () => {
      const { scope, updatedWorkItemPayloads } = createMockTx({
        currentSpecVersion: { version: 1, quantity: 500, material: "Paper" },
      });

      const res = await applySpecChangeInTx(scope, {
        workItemId: "wi-1",
        actorId: "actor-1",
        origin: "DIRECT_EDIT",
        patch: { quantity: 800, material: "Vinyl" },
        expected: { version: 1 },
        reason: null,
        ifUnchanged: "fail",
      });

      expect(res).not.toBeNull();
      expect(updatedWorkItemPayloads).toHaveLength(1);
      const updateData = updatedWorkItemPayloads[0]!;

      // Convert update payload to snapshot using toSpecSnapshot
      const mirrorSnapshot = toSpecSnapshot({
        productTypeId: updateData.productTypeId ?? null,
        description: updateData.description ?? null,
        quantity: updateData.quantity ?? null,
        widthValue: updateData.widthValue ?? null,
        heightValue: updateData.heightValue ?? null,
        dimensionUnit: updateData.dimensionUnit ?? null,
        material: updateData.material ?? null,
        finishNotes: updateData.finishNotes ?? null,
      });

      expect(mirrorSnapshot).toEqual(res!.current.snapshot);
      expect(mirrorSnapshot.quantity).toBe(800);
      expect(mirrorSnapshot.material).toBe("Vinyl");
    });
  });

  describe("createInitialSpecVersionInTx and ensureCurrentSpecVersionInTx", () => {
    it("createInitialSpecVersionInTx sets version 1, INITIAL, pointer, and audits", async () => {
      const { scope, getWorkItem, specVersions, audits } = createMockTx({
        workItem: { quantity: 300, description: "New poster" },
      });

      const view = await createInitialSpecVersionInTx(scope, {
        workItemId: "wi-1",
        actorId: "actor-create",
      });

      expect(view.version).toBe(1);
      expect(view.origin).toBe("INITIAL");
      expect(view.snapshot.quantity).toBe(300);
      expect(getWorkItem().currentSpecVersionId).toBe(view.id);
      expect(specVersions).toHaveLength(1);
      expect(audits).toHaveLength(1);
      expect(audits[0]!.action).toBe("spec_version.created");
      expect(audits[0]!.entityType).toBe("SpecVersion");
      expect(audits[0]!.actorId).toBe("actor-create");
    });

    it("ensureCurrentSpecVersionInTx backfills unversioned items with BACKFILL and null createdById", async () => {
      const { scope, getWorkItem, specVersions, audits } = createMockTx({
        workItem: { quantity: 450 },
      });

      expect(getWorkItem().currentSpecVersionId).toBeNull();

      const view = await ensureCurrentSpecVersionInTx(scope, "wi-1");

      expect(view.version).toBe(1);
      expect(view.origin).toBe("BACKFILL");
      expect(view.createdBy).toBeNull();
      expect(view.snapshot.quantity).toBe(450);
      expect(getWorkItem().currentSpecVersionId).toBe(view.id);
      expect(specVersions).toHaveLength(1);
      expect(audits).toHaveLength(1);
      expect(audits[0]!.action).toBe("spec_version.created");
      expect(audits[0]!.entityType).toBe("SpecVersion");
      expect(audits[0]!.actorId).toBeUndefined();

      // Second call returns existing (idempotent, no extra audit)
      const view2 = await ensureCurrentSpecVersionInTx(scope, "wi-1");
      expect(view2.id).toBe(view.id);
      expect(specVersions).toHaveLength(1);
      expect(audits).toHaveLength(1);
    });

    it("returns VALIDATION when patch fails schema validation (m3)", async () => {
      const { scope } = createMockTx({
        currentSpecVersion: { version: 1, quantity: 500 },
      });

      await expect(
        applySpecChangeInTx(scope, {
          workItemId: "wi-1",
          actorId: "actor-1",
          origin: "DIRECT_EDIT",
          patch: { quantity: -10 },
          expected: { version: 1 },
          reason: null,
          ifUnchanged: "fail",
        }),
      ).rejects.toMatchObject({
        error: {
          code: "VALIDATION",
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "quantity" }),
          ]),
        },
      });
    });
  });

});
