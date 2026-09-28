/**
 * Unit tests for DropPolicyResolver.
 * (T060, plan.md S2-O, S3)
 */

import { describe, expect, it, vi } from "vitest";
import type { DropPolicy } from "~/lib/board/policies/DropPolicy";
import { DropPolicyResolver } from "~/lib/board/policies/DropPolicyResolver";
import type { MoveOption } from "~/lib/board/types";

describe("DropPolicyResolver (T060, plan.md S2-O)", () => {
  it("resolves registered drop policies by move kind", () => {
    const resolver = new DropPolicyResolver();

    const directPolicy: DropPolicy = { onDrop: vi.fn() };
    const sheetPolicy: DropPolicy = { onDrop: vi.fn() };
    const screenPolicy: DropPolicy = { onDrop: vi.fn() };

    resolver.register("DIRECT", directPolicy);
    resolver.register("SHEET", sheetPolicy);
    resolver.register("SCREEN", screenPolicy);

    const directOption: MoveOption = {
      edgeId: "A->B",
      to: "IN_DESIGN",
      kind: "DIRECT",
      sheet: null,
      screenHref: null,
      backward: false,
      destructive: false,
      groupable: false,
      labelAr: "مباشر",
    };

    const sheetOption: MoveOption = {
      edgeId: "A->C",
      to: "ASSIGNED",
      kind: "SHEET",
      sheet: "assign-designer",
      screenHref: null,
      backward: false,
      destructive: false,
      groupable: false,
      labelAr: "نموذج",
    };

    expect(resolver.resolve(directOption)).toBe(directPolicy);
    expect(resolver.resolve(sheetOption)).toBe(sheetPolicy);
  });

  it("throws descriptive error when no policy is registered for move kind", () => {
    const resolver = new DropPolicyResolver();

    const unhandledOption: MoveOption = {
      edgeId: "X->Y",
      to: "COMPLETED",
      kind: "DIRECT",
      sheet: null,
      screenHref: null,
      backward: false,
      destructive: false,
      groupable: false,
      labelAr: "غير مسجل",
    };

    expect(() => resolver.resolve(unhandledOption)).toThrow(
      "No DropPolicy registered for move kind: DIRECT",
    );
  });
});
