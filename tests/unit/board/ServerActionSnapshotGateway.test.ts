import { describe, expect, it, vi } from "vitest";
import { ServerActionSnapshotGateway } from "~/lib/board/adapters/ServerActionSnapshotGateway";
import type { BoardSnapshot, SnapshotRequest } from "~/lib/board/types";

describe("ServerActionSnapshotGateway (T031, plan.md S2-L)", () => {
  it("delegates snapshot requests to injected fetcher", async () => {
    const mockSnapshot: BoardSnapshot = {
      generatedAt: "2026-09-26T12:00:00Z",
      cards: [],
      hiddenSiblingCounts: {},
      slice: "reception",
      availableSlices: ["reception", "floor"],
      blockedHints: [],
    };

    const fetcher = vi.fn().mockResolvedValue(mockSnapshot);
    const gateway = new ServerActionSnapshotGateway(fetcher);

    const req: SnapshotRequest = { slice: "reception" };
    const result = await gateway.snapshot(req);

    expect(fetcher).toHaveBeenCalledWith(req);
    expect(result).toBe(mockSnapshot);
  });
});
