// Unit tests for `authorize()` — T008.
//
// These are pure synchronous tests (no DB, no Next.js); they only exercise the
// permission-check and department-scope logic in src/server/auth/authorize.ts.

import { describe, expect, it } from "vitest";
import { authorize, ForbiddenError } from "~/server/auth/authorize";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

// Minimal factory to build Actor values for test cases.
function makeActor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: "test-user-id",
    roles: [],
    permissions: new Set<Permission>(),
    departmentIds: [],
    ...overrides,
  };
}

describe("authorize", () => {
  it("passes (returns void) when actor holds the required permission", () => {
    const actor = makeActor({
      permissions: new Set<Permission>(["order.create"]),
    });
    // Should not throw — just returns undefined.
    expect(() => authorize(actor, "order.create")).not.toThrow();
  });

  it("throws ForbiddenError when actor is missing the required permission", () => {
    const actor = makeActor({
      permissions: new Set<Permission>(), // no permissions at all
    });
    expect(() => authorize(actor, "order.create")).toThrowError(ForbiddenError);
  });

  it("thrown error has name 'ForbiddenError' and message 'FORBIDDEN'", () => {
    const actor = makeActor({ permissions: new Set<Permission>() });
    try {
      authorize(actor, "admin.users");
      // If we reach here, the test should fail.
      expect.fail("expected ForbiddenError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).name).toBe("ForbiddenError");
      expect((err as ForbiddenError).message).toBe("FORBIDDEN");
    }
  });

  it("throws ForbiddenError when scope.departmentId is NOT in actor.departmentIds", () => {
    const actor = makeActor({
      permissions: new Set<Permission>(["production.operate"]),
      departmentIds: ["dept-A"],
    });
    // Actor holds the permission but is not a member of dept-B.
    expect(() =>
      authorize(actor, "production.operate", { departmentId: "dept-B" }),
    ).toThrowError(ForbiddenError);
  });

  it("passes when scope.departmentId IS in actor.departmentIds", () => {
    const actor = makeActor({
      permissions: new Set<Permission>(["production.operate"]),
      departmentIds: ["dept-A", "dept-B"],
    });
    // Actor holds the permission AND is a member of dept-B.
    expect(() =>
      authorize(actor, "production.operate", { departmentId: "dept-B" }),
    ).not.toThrow();
  });

  it("passes when scope is provided but departmentId is undefined (no scope restriction)", () => {
    const actor = makeActor({
      permissions: new Set<Permission>(["order.create"]),
      departmentIds: [],
    });
    // scope object is present but departmentId is undefined — should not restrict.
    expect(() => authorize(actor, "order.create", {})).not.toThrow();
  });

  it("passes when no scope is provided at all", () => {
    const actor = makeActor({
      permissions: new Set<Permission>(["order.cancel"]),
    });
    expect(() => authorize(actor, "order.cancel")).not.toThrow();
  });
});
