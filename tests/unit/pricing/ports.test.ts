import { describe, expect, it } from "vitest";
import { getFailClosedPricingGatePort } from "~/server/pricing/ports";

describe("pricing gate port", () => {
  it("returns a pending entry for every item when no provider is bound", async () => {
    const result = await getFailClosedPricingGatePort().getPricingStatus(["work-1", "work-2"]);

    expect([...result.keys()]).toEqual(["work-1", "work-2"]);
    expect(result.get("work-1")).toEqual({
      status: "PENDING",
      waitingSince: null,
      responsible: { label: "Pricing review required", userIds: [] },
    });
  });
});