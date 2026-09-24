import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../generated/prisma";
import {
  SPEC_CHANGED,
  emitSpecChangedInTx,
  registerSpecChangeListener,
  __resetSpecChangeListenersForTests,
  type SpecChangedEvent,
} from "~/server/changes/events";
import {
  getDirectCostPort,
  noopDirectCostPort,
  setDirectCostPort,
  __resetDirectCostPortForTests,
  type DirectCostPort,
} from "~/server/changes/ports";
import { notify } from "~/server/core";

vi.mock("~/server/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/core")>();
  return {
    ...actual,
    notify: vi.fn().mockResolvedValue(undefined),
  };
});

describe("events and ports (T018, T019)", () => {
  beforeEach(() => {
    __resetSpecChangeListenersForTests();
    __resetDirectCostPortForTests();
    vi.clearAllMocks();
  });

  describe("SPEC_CHANGED events", () => {
    it("runs registered listeners sequentially in registration order", async () => {
      const order: string[] = [];

      registerSpecChangeListener("listener.first", async () => {
        order.push("first");
      });
      registerSpecChangeListener("listener.second", async () => {
        order.push("second");
      });

      const fakeTx = {
        workItem: {
          findUnique: vi.fn().mockResolvedValue({
            assigneeId: "designer-1",
            departmentId: "dept-1",
            productType: { defaultDepartmentId: "dept-default" },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const event: SpecChangedEvent = {
        type: SPEC_CHANGED,
        workItemId: "wi-123",
        orderId: "ord-456",
        fromVersion: 1,
        toVersion: 2,
        specVersionId: "spec-2",
        origin: "DIRECT_EDIT",
        changeRequestId: null,
        changedFields: ["quantity"],
        workItemState: "NEW",
        actorId: "actor-1",
        occurredAt: new Date("2026-09-24T12:00:00.000Z"),
      };

      await emitSpecChangedInTx(fakeTx, event);

      expect(order).toEqual(["first", "second"]);
      expect(notify).toHaveBeenCalledWith(fakeTx, {
        type: SPEC_CHANGED,
        entity: { type: "WorkItem", id: "wi-123" },
        recipients: {
          userIds: ["designer-1"],
          departmentIds: ["dept-1"],
        },
        payload: {
          type: SPEC_CHANGED,
          workItemId: "wi-123",
          orderId: "ord-456",
          fromVersion: 1,
          toVersion: 2,
          specVersionId: "spec-2",
          origin: "DIRECT_EDIT",
          changeRequestId: null,
          changedFields: ["quantity"],
          workItemState: "NEW",
          actorId: "actor-1",
          occurredAt: "2026-09-24T12:00:00.000Z",
        },
      });
    });

    it("replaces existing listener when registering with the same name", async () => {
      const order: string[] = [];

      registerSpecChangeListener("listener.unique", async () => {
        order.push("old");
      });
      registerSpecChangeListener("listener.unique", async () => {
        order.push("new");
      });

      const fakeTx = {
        workItem: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      const event: SpecChangedEvent = {
        type: SPEC_CHANGED,
        workItemId: "wi-123",
        orderId: "ord-456",
        fromVersion: 1,
        toVersion: 2,
        specVersionId: "spec-2",
        origin: "DIRECT_EDIT",
        changeRequestId: null,
        changedFields: ["quantity"],
        workItemState: "NEW",
        actorId: "actor-1",
        occurredAt: new Date(),
      };

      await emitSpecChangedInTx(fakeTx, event);
      expect(order).toEqual(["new"]);
    });

    it("stops execution and does not call notify if a listener throws", async () => {
      registerSpecChangeListener("failing.listener", async () => {
        throw new Error("listener failed");
      });

      const fakeTx = {
        workItem: {
          findUnique: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const event: SpecChangedEvent = {
        type: SPEC_CHANGED,
        workItemId: "wi-123",
        orderId: "ord-456",
        fromVersion: 1,
        toVersion: 2,
        specVersionId: "spec-2",
        origin: "DIRECT_EDIT",
        changeRequestId: null,
        changedFields: ["quantity"],
        workItemState: "NEW",
        actorId: "actor-1",
        occurredAt: new Date(),
      };

      await expect(emitSpecChangedInTx(fakeTx, event)).rejects.toThrow(
        "listener failed",
      );
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe("DirectCostPort", () => {
    it("defaults to noopDirectCostPort and allows overriding and resetting", async () => {
      expect(getDirectCostPort()).toBe(noopDirectCostPort);

      await expect(
        noopDirectCostPort.recordLateCancellationCost(
          {} as Prisma.TransactionClient,
          {
            lateCancellationId: "lc-1",
            workItemId: "wi-1",
            orderId: "ord-1",
            amount: "150.00",
            currency: "EGP",
            reason: "Cancelled by customer",
            recordedById: "user-1",
            recordedAt: new Date(),
          },
        ),
      ).resolves.toBeUndefined();

      const customPort: DirectCostPort = {
        recordLateCancellationCost: vi.fn().mockResolvedValue(undefined),
      };

      setDirectCostPort(customPort);
      expect(getDirectCostPort()).toBe(customPort);

      __resetDirectCostPortForTests();
      expect(getDirectCostPort()).toBe(noopDirectCostPort);
    });
  });
});
