import { describe, expect, it, vi } from "vitest";
import { authorizePricingOperation, pricingPermissionFor } from "~/server/pricing/authorization";
import type { Permission } from "~/server/auth";

vi.mock("~/server/auth", () => ({
  authorize: (actor: { permissions: ReadonlySet<Permission> }, permission: Permission) => {
    if (!actor.permissions.has(permission)) throw new Error("FORBIDDEN");
  },
}));

const actor = (permissions: Permission[]) => ({
  userId: "user-1",
  roles: [],
  permissions: new Set(permissions),
  departmentIds: [],
});

describe("pricing authorization", () => {
  it.each([
    ["APPLY_QUOTE", "pricing.use_fixed"],
    ["VARIABLE", "pricing.set_variable"],
    ["OVERRIDE", "pricing.override"],
    ["CONFIGURE", "admin.config"],
  ] as const)("maps %s to %s", (operation, permission) => {
    expect(pricingPermissionFor(operation)).toBe(permission);
    expect(() => authorizePricingOperation(actor([permission]), operation)).not.toThrow();
  });

  it("rejects an actor missing the operation permission", () => {
    expect(() => authorizePricingOperation(actor(["pricing.use_fixed"]), "VARIABLE")).toThrow(
      "FORBIDDEN",
    );
  });
});