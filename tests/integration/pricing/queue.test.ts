// Integration test for pricing queue — tasks.md T031, US5.
// Verifies pending-only inclusion, urgent-first + oldest-first ordering,
// server-time age labels, cursor pagination, and authorization.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { getPricingQueue } from "~/server/pricing";
import { ForbiddenError } from "~/server/auth/authorize";
import {
  seedCustomer,
  seedOrderWithWorkItem,
  seedPricingUser,
  seedProductType,
} from "../../helpers/pricingSeed";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let pricingUser: Actor;
let customerId: string;
let productId: string;
const NOW = new Date("2026-09-24T12:00:00.000Z");

beforeAll(async () => {
  pricingUser = await seedPricingUser("queue-pricing", ["pricing.use_fixed"]);
  customerId = await seedCustomer("Queue");
  productId = await seedProductType("QueueProduct");
});

beforeEach(async () => {
  await testDb.pricingStatus.deleteMany({ where: { status: "PENDING" } });
});

async function queueItem(params: {
  readonly priority: "NORMAL" | "URGENT";
  readonly waitingSince: string;
  readonly priced?: boolean;
}): Promise<string> {
  const { workItemId } = await seedOrderWithWorkItem({
    customerId,
    createdById: pricingUser.userId,
    productTypeId: productId,
    quantity: 1,
    priority: params.priority,
  });
  await testDb.pricingStatus.create({
    data: {
      workItemId,
      status: params.priced ? "PRICED" : "PENDING",
      waitingSince: new Date(params.waitingSince),
    },
  });
  return workItemId;
}

describe("pricing queue (integration, US5)", () => {
  it("returns all pending items, excludes priced rows, and orders urgent then oldest", async () => {
    const normalOld = await queueItem({ priority: "NORMAL", waitingSince: "0001-09-24T08:00:00.000Z" });
    const urgentNew = await queueItem({ priority: "URGENT", waitingSince: "0001-09-24T10:00:00.000Z" });
    const urgentOld = await queueItem({ priority: "URGENT", waitingSince: "0001-09-24T07:00:00.000Z" });
    const priced = await queueItem({ priority: "URGENT", waitingSince: "2026-09-24T06:00:00.000Z", priced: true });

    const result = await getPricingQueue(pricingUser, { now: NOW, limit: 50 });
    const ids = result.rows.map((row) => row.workItemId);

    expect(ids.slice(0, 3)).toEqual([urgentOld, urgentNew, normalOld]);
    expect(ids).not.toContain(priced);
    expect(result.rows[0]).toMatchObject({
      workItemId: urgentOld,
      priority: "URGENT",
      ageLabel: expect.any(String),
    });
    expect(result.rows[2]).toMatchObject({
      workItemId: normalOld,
      priority: "NORMAL",
      ageLabel: expect.any(String),
    });
  });

  it("uses server-provided now for deterministic age labels", async () => {
    const workItemId = await queueItem({
      priority: "NORMAL",
      waitingSince: "0001-09-23T10:15:00.000Z",
    });
    const result = await getPricingQueue(pricingUser, {
      now: NOW,
      limit: 50,
    });
    const row = result.rows.find((candidate) => candidate.workItemId === workItemId);
    expect(row?.ageLabel).toBeTruthy();
    expect(row?.waitingSince.toISOString()).toBe("0001-09-23T10:15:00.000Z");
  });

  it("paginates with a stable cursor", async () => {
    const first = await queueItem({ priority: "URGENT", waitingSince: "0001-09-20T08:00:00.000Z" });
    const second = await queueItem({ priority: "URGENT", waitingSince: "0001-09-21T08:00:00.000Z" });
    const third = await queueItem({ priority: "NORMAL", waitingSince: "0001-09-22T08:00:00.000Z" });

    const page = await getPricingQueue(pricingUser, { now: NOW, limit: 2 });
    expect(page.rows.map((row) => row.workItemId)).toContain(first);
    expect(page.rows.map((row) => row.workItemId)).toContain(second);
    expect(page.nextCursor).toBe(second);

    const next = await getPricingQueue(pricingUser, { now: NOW, limit: 2, cursor: page.nextCursor ?? undefined });
    expect(next.rows.map((row) => row.workItemId)).toContain(third);
  });

  it("rejects a non-pricing user", async () => {
    const unauthorized = await seedPricingUser("queue-no-access", []);
    await expect(getPricingQueue(unauthorized, { now: NOW })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
