// tests/contract/changes/guards.test.ts
// 016's transition guards: registration paths, idempotence, meta parsing.
// tasks.md T043 (+ T072 source-grep), contracts/events-and-ports.md §3, research §18.

import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkItemSnapshot, WorkItemState } from "~/server/core";

// Every statement the app's `db` sends is counted, so "the guard ran once"
// is observable without reaching into the registry.
const queries = vi.hoisted(() => ({ count: 0 }));

vi.mock("~/server/db", async () => {
  const { PrismaClient } = await import("../../../generated/prisma");
  const db = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL_TEST,
    log: [{ emit: "event", level: "query" }],
  });
  db.$on("query", () => {
    queries.count += 1;
  });
  return { db };
});

import { testDb } from "../../helpers/testDb";
import { seedCustomer, seedOrder, seedUser, seedWorkItem } from "../../helpers/seed";

afterAll(async () => {
  await testDb.$disconnect();
});

type Core = typeof import("~/server/core");

async function snapshotOf(workItemId: string, state: WorkItemState): Promise<WorkItemSnapshot> {
  const wi = await testDb.workItem.findUniqueOrThrow({ where: { id: workItemId } });
  return {
    id: wi.id,
    orderId: wi.orderId,
    productTypeId: wi.productTypeId,
    departmentId: wi.departmentId,
    state,
    requiresDesign: wi.requiresDesign,
    requiresReview: wi.requiresReview,
    assigneeId: wi.assigneeId,
    createdAt: wi.createdAt,
    updatedAt: wi.updatedAt,
  } as WorkItemSnapshot;
}

async function itemWithPendingRequest(): Promise<string> {
  const userId = await seedUser();
  const orderId = await seedOrder({ customerId: await seedCustomer(), createdById: userId });
  const workItemId = await seedWorkItem({ orderId, state: "IN_PRODUCTION" });
  const v1 = await testDb.specVersion.create({
    data: { workItemId, version: 1, origin: "INITIAL", stateAtCreation: "IN_PRODUCTION" },
  });
  await testDb.changeRequest.create({
    data: {
      workItemId,
      baseSpecVersionId: v1.id,
      proposedPatch: { quantity: 1 },
      requestReason: "r",
      requestedById: userId,
    },
  });
  return workItemId;
}

async function itemWithoutHold(): Promise<string> {
  const userId = await seedUser();
  const orderId = await seedOrder({ customerId: await seedCustomer(), createdById: userId });
  return seedWorkItem({ orderId, state: "IN_PRODUCTION" });
}

async function run(
  core: Core,
  from: WorkItemState,
  to: WorkItemState,
  workItemId: string,
  meta?: Record<string, string>,
) {
  return core.runGuards(from, to, {
    workItem: await snapshotOf(workItemId, from),
    actor: { userId: "u" as never, roles: [], departmentIds: [] },
    reason: "r",
    meta,
  });
}

beforeEach(() => {
  vi.resetModules();
});

describe("T043 — registration on the paths that transition", () => {
  it("importing only ~/server/production registers the two hold guards", async () => {
    await import("~/server/production");
    const core = await import("~/server/core");
    const workItemId = await itemWithPendingRequest();

    const complete = await run(core, "IN_PRODUCTION", "PRODUCTION_COMPLETED", workItemId);
    expect(!complete.ok && complete.error.code).toBe("CHANGE_HOLD");
    const sendBack = await run(core, "IN_PRODUCTION", "REWORK_REQUIRED", workItemId);
    expect(!sendBack.ok && sendBack.error.code).toBe("CHANGE_HOLD");
  });

  it("importing only a 014 file that transitions (not the barrel) still registers them", async () => {
    await import("~/server/production/completion");
    const core = await import("~/server/core");
    const res = await run(core, "IN_PRODUCTION", "PRODUCTION_COMPLETED", await itemWithPendingRequest());
    expect(!res.ok && res.error.code).toBe("CHANGE_HOLD");
  });

  it("importing only ~/server/orders registers the three late-cancel guards", async () => {
    await import("~/server/orders");
    const core = await import("~/server/core");
    const workItemId = await itemWithoutHold();

    for (const from of ["IN_PRODUCTION", "PRODUCTION_COMPLETED", "READY_FOR_COLLECTION"] as const) {
      const refused = await run(core, from, "CANCELLED", workItemId);
      expect(!refused.ok && refused.error.code).toBe("LATE_CANCELLATION_REQUIRED");
      const allowed = await run(core, from, "CANCELLED", workItemId, {
        changeControl: "LATE_CANCELLATION",
        lateCancellationId: "lc_1",
      });
      expect(allowed.ok).toBe(true);
    }
  });

  it("a hold-free Work Item passes the hold guards", async () => {
    await import("~/server/changes");
    const core = await import("~/server/core");
    const res = await run(core, "IN_PRODUCTION", "PRODUCTION_COMPLETED", await itemWithoutHold());
    expect(res.ok).toBe(true);
  });
});

describe("T043 — meta markers are a closed union", () => {
  it.each([
    ["missing id", { changeControl: "LATE_CANCELLATION" }],
    ["unknown marker", { changeControl: "SOMETHING_ELSE", lateCancellationId: "x" }],
    ["wrong marker for the edge", { changeControl: "CHANGE_REQUEST_APPROVAL", changeRequestId: "x" }],
  ])("%s is ignored, which means refusal", async (_label, meta) => {
    await import("~/server/changes");
    const core = await import("~/server/core");
    const res = await run(core, "IN_PRODUCTION", "CANCELLED", await itemWithoutHold(), meta);
    expect(!res.ok && res.error.code).toBe("LATE_CANCELLATION_REQUIRED");
  });
});

describe("T046 — registerChangeGuards is idempotent", () => {
  it("calling it again does not register the guards twice", async () => {
    const changes = await import("~/server/changes");
    const core = await import("~/server/core");
    changes.registerChangeGuards();
    changes.registerChangeGuards();
    const workItemId = await itemWithoutHold();
    const snapshot = await snapshotOf(workItemId, "IN_PRODUCTION");

    queries.count = 0;
    const res = await core.runGuards("IN_PRODUCTION", "PRODUCTION_COMPLETED", {
      workItem: snapshot,
      actor: { userId: "u" as never, roles: [], departmentIds: [] },
    });
    expect(res.ok).toBe(true);
    // One hold lookup: the guard is registered exactly once.
    expect(queries.count).toBe(1);
  });
});

describe("T072 — the changeControl marker stays inside src/server/changes", () => {
  it("no src file outside src/server/changes mentions changeControl", () => {
    const root = path.resolve(process.cwd(), "src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (full === path.join(root, "server", "changes")) continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && fs.readFileSync(full, "utf8").includes("changeControl")) {
          offenders.push(path.relative(process.cwd(), full));
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
