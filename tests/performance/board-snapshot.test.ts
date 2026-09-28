import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { getBoardSnapshot } from "~/server/board/snapshot";
import type { Actor } from "~/server/auth";
import type { RawWorkItemRow } from "~/server/board/projection";

describe("board snapshot performance benchmark (SC-001, SC-004)", () => {
  const adminActor: Actor = {
    userId: "u-admin",
    roles: ["ADMIN_OWNER"],
    permissions: new Set(["admin.override", "order.create"]),
    departmentIds: [],
  };

  // Generate 200 mock cards in memory for benchmark
  const mockRows: RawWorkItemRow[] = Array.from({ length: 200 }, (_, i) => ({
    id: `wi-${i}`,
    orderId: `ord-${i % 20}`,
    order: {
      number: 1000 + i,
      priority: i % 10 === 0 ? "URGENT" : "NORMAL",
      dueDate: new Date(Date.now() + 86400000),
      customer: { name: `عميل ${i % 15}` },
    },
    description: `عنصر مطبوع #${i}`,
    productType: { name: "بروشور", defaultDepartmentId: "dept-1" },
    quantity: 100 + i,
    state: "IN_PRODUCTION",
    departmentId: "dept-1",
    assignee: { id: "u-1", name: "مشغل" },
    createdAt: new Date(Date.now() - 3600000),
    dueDate: null,
    transitions: [
      {
        id: `tr-${i}`,
        from: "READY_FOR_PRODUCTION",
        to: "IN_PRODUCTION",
        at: new Date(Date.now() - 1800000),
      },
    ],
    pricingStatus: { status: "PRICED" },
    reworkCount: 0,
  }));

  it("executes ≤ 4 database queries and returns within 150 ms latency target", async () => {
    let queryCount = 0;

    const mockPrisma = {
      workItem: {
        findMany: async () => {
          queryCount += 1;
          return mockRows;
        },
        groupBy: async () => {
          queryCount += 1;
          return [{ orderId: "ord-1", _count: { id: 10 } }];
        },
      },
    } as any;

    const start = performance.now();
    const snapshot = await getBoardSnapshot(adminActor, undefined, mockPrisma);
    const duration = performance.now() - start;

    expect(queryCount).toBeLessThanOrEqual(4);
    expect(snapshot.cards).toHaveLength(200);
    expect(duration).toBeLessThan(150);
  });
});
