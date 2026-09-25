// Contract test for 052's 015 seams — tasks.md T012.
// Safe defaults + bind-once (contracts/finance-ports.md; constitution VII:
// 015's absence must never block payments).

import { afterEach, describe, expect, it } from "vitest";
import {
  PortAlreadyBoundError,
  bindCompensationReadPort,
  bindFinancialClosurePort,
  invokeFinancialClosure,
  readCreditCompensations,
} from "~/server/finance/ports";
import type { Actor } from "~/server/auth";

const actor: Actor = { userId: "u_test", roles: [], permissions: new Set(), departmentIds: [] };

afterEach(() => {
  // Ports are module-level singletons; reset via fresh module state by
  // re-importing is not possible — tests bind at most once each below.
});

describe("finance ports (contract, T012)", () => {
  it("default closure port returns closed:false without throwing", async () => {
    const result = await invokeFinancialClosure(actor, "order_missing");
    expect(result.closed).toBe(false);
    expect(result.unmet).toContain("FINANCE_NOT_CONNECTED");
  });

  it("default compensation port returns an empty list", async () => {
    await expect(readCreditCompensations("order_missing")).resolves.toEqual([]);
  });

  it("rejects a second closure bind with PORT_ALREADY_BOUND", () => {
    bindFinancialClosurePort(async () => ({ closed: false }));
    expect(() => bindFinancialClosurePort(async () => ({ closed: false }))).toThrow(
      PortAlreadyBoundError,
    );
  });

  it("rejects a second compensation bind with PORT_ALREADY_BOUND", () => {
    bindCompensationReadPort(async () => []);
    expect(() => bindCompensationReadPort(async () => [])).toThrow(PortAlreadyBoundError);
  });
});
