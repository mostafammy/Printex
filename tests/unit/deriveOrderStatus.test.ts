// Unit test for `deriveOrderStatus` — data-model.md "Order Status Derivation"
// (bucket rule) and contracts/orders.md. Written first, per tasks.md T016: it
// must fail until src/server/core/orders/deriveOrderStatus.ts (T017) exists.

import { describe, expect, it } from "vitest";
import { deriveOrderStatus } from "~/server/core/orders/deriveOrderStatus";
import type { WorkItemState } from "~/server/core/workflow/states";

function items(...states: WorkItemState[]): { state: WorkItemState }[] {
  return states.map((state) => ({ state }));
}

describe("deriveOrderStatus", () => {
  // --- CANCELLED: requires EVERY Work Item to be CANCELLED -----------------
  it("returns CANCELLED when all Work Items are CANCELLED", () => {
    expect(deriveOrderStatus(items("CANCELLED", "CANCELLED"))).toBe(
      "CANCELLED",
    );
  });

  it("returns CANCELLED for a single CANCELLED Work Item", () => {
    expect(deriveOrderStatus(items("CANCELLED"))).toBe("CANCELLED");
  });

  it("does NOT return CANCELLED when only some Work Items are CANCELLED (mixed with pre-production)", () => {
    expect(deriveOrderStatus(items("CANCELLED", "NEW"))).not.toBe(
      "CANCELLED",
    );
  });

  it("does NOT return CANCELLED when only some Work Items are CANCELLED (mixed with in-production)", () => {
    expect(deriveOrderStatus(items("CANCELLED", "IN_PRODUCTION"))).not.toBe(
      "CANCELLED",
    );
  });

  // --- COMPLETED: requires EVERY Work Item to be COMPLETED -----------------
  it("returns COMPLETED when all Work Items are COMPLETED", () => {
    expect(deriveOrderStatus(items("COMPLETED", "COMPLETED"))).toBe(
      "COMPLETED",
    );
  });

  it("does NOT return COMPLETED when only some Work Items are COMPLETED (falls to DELIVERED)", () => {
    expect(deriveOrderStatus(items("COMPLETED", "DELIVERED"))).toBe(
      "DELIVERED",
    );
  });

  // --- DELIVERED: requires EVERY Work Item to be DELIVERED or COMPLETED ----
  it("returns DELIVERED when all Work Items are DELIVERED", () => {
    expect(deriveOrderStatus(items("DELIVERED", "DELIVERED"))).toBe(
      "DELIVERED",
    );
  });

  it("returns DELIVERED when Work Items are a mix of DELIVERED and COMPLETED", () => {
    expect(deriveOrderStatus(items("DELIVERED", "COMPLETED"))).toBe(
      "DELIVERED",
    );
  });

  it("does NOT return DELIVERED when a Work Item is behind DELIVERED/COMPLETED", () => {
    expect(deriveOrderStatus(items("DELIVERED", "IN_PRODUCTION"))).not.toBe(
      "DELIVERED",
    );
  });

  // --- NOT_STARTED: every Work Item is NEW or ASSIGNED ---------------------
  it("returns NOT_STARTED when all Work Items are NEW", () => {
    expect(deriveOrderStatus(items("NEW", "NEW"))).toBe("NOT_STARTED");
  });

  it("returns NOT_STARTED when all Work Items are ASSIGNED", () => {
    expect(deriveOrderStatus(items("ASSIGNED", "ASSIGNED"))).toBe(
      "NOT_STARTED",
    );
  });

  it("returns NOT_STARTED when Work Items are a mix of NEW and ASSIGNED", () => {
    expect(deriveOrderStatus(items("NEW", "ASSIGNED"))).toBe("NOT_STARTED");
  });

  it("returns NOT_STARTED for a single NEW Work Item", () => {
    expect(deriveOrderStatus(items("NEW"))).toBe("NOT_STARTED");
  });

  // --- IN_PRODUCTION: any Work Item IN_PRODUCTION, none DELIVERED/COMPLETED,
  // and not all pre-production ----------------------------------------------
  it("returns IN_PRODUCTION when one Work Item is IN_PRODUCTION and another is still pre-production", () => {
    expect(deriveOrderStatus(items("IN_PRODUCTION", "NEW"))).toBe(
      "IN_PRODUCTION",
    );
  });

  it("returns IN_PRODUCTION when all Work Items are IN_PRODUCTION", () => {
    expect(deriveOrderStatus(items("IN_PRODUCTION", "IN_PRODUCTION"))).toBe(
      "IN_PRODUCTION",
    );
  });

  it("returns IN_PRODUCTION when one Work Item is IN_PRODUCTION and another is mid-workflow (not DELIVERED/COMPLETED)", () => {
    expect(
      deriveOrderStatus(items("IN_PRODUCTION", "WAITING_REVIEW")),
    ).toBe("IN_PRODUCTION");
  });

  // --- PARTIALLY_READY: the catch-all "everything else" bucket -------------
  it("returns PARTIALLY_READY when one Work Item is DELIVERED and another is still pre-production", () => {
    expect(deriveOrderStatus(items("DELIVERED", "NEW"))).toBe(
      "PARTIALLY_READY",
    );
  });

  it("returns PARTIALLY_READY when one Work Item is COMPLETED and another is IN_PRODUCTION", () => {
    expect(deriveOrderStatus(items("COMPLETED", "IN_PRODUCTION"))).toBe(
      "PARTIALLY_READY",
    );
  });

  it("returns PARTIALLY_READY for mid-workflow states with none IN_PRODUCTION or DELIVERED/COMPLETED and not all pre-production", () => {
    // Not all pre-production (READY_FOR_PRODUCTION is past NEW/ASSIGNED),
    // no Work Item IN_PRODUCTION, none DELIVERED/COMPLETED -> falls through
    // every named bucket into the PARTIALLY_READY catch-all.
    expect(
      deriveOrderStatus(items("READY_FOR_PRODUCTION", "NEW")),
    ).toBe("PARTIALLY_READY");
  });

  it("returns PARTIALLY_READY when one Work Item is DELIVERED and another is IN_PRODUCTION", () => {
    expect(
      deriveOrderStatus(items("DELIVERED", "IN_PRODUCTION")),
    ).toBe("PARTIALLY_READY");
  });
});
