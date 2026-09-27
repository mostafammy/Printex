import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("~/server/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

vi.mock("~/server/auth", () => ({
  authorize: vi.fn(),
  audit: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { defineCommand } from "~/server/changes/aspect";
import type { Actor } from "~/server/auth";

const testActor: Actor = {
  userId: "user-1",
  roles: [],
  departmentIds: [],
  permissions: new Set(["order.edit"]),
};

function createP2002Error(target: readonly string[], modelName?: string) {
  const err = new Error("Unique constraint failed");
  Object.assign(err, {
    code: "P2002",
    meta: { target, modelName },
  });
  return err;
}

describe("016 changes aspect binding mapUniqueViolation (B4)", () => {
  it("matches STALE_SPEC_VERSION when target includes both workItemId and version and modelName is SpecVersion", async () => {
    const cmd = defineCommand({
      action: "test.stale_spec",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw createP2002Error(["workItemId", "version"], "SpecVersion");
      },
    });

    const res = await cmd(testActor, {});
    expect(res).toEqual({
      ok: false,
      error: { code: "STALE_SPEC_VERSION" },
    });
  });

  it("matches STALE_SPEC_VERSION when target includes SpecVersion_workItemId_version index name", async () => {
    const cmd = defineCommand({
      action: "test.stale_spec_index",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw createP2002Error(["SpecVersion_workItemId_version"]);
      },
    });

    const res = await cmd(testActor, {});
    expect(res).toEqual({
      ok: false,
      error: { code: "STALE_SPEC_VERSION" },
    });
  });

  it("does NOT match STALE_SPEC_VERSION for target ['workItemId', 'version'] with modelName 'DesignVersion'", async () => {
    const cmd = defineCommand({
      action: "test.design_version",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw createP2002Error(["workItemId", "version"], "DesignVersion");
      },
    });

    const res = await cmd(testActor, {});
    // Does not match STALE_SPEC_VERSION, falls through to base CONFLICT
    expect(res).not.toEqual({
      ok: false,
      error: { code: "STALE_SPEC_VERSION" },
    });
    expect(res).toEqual({
      ok: false,
      error: { code: "CONFLICT", entity: "DesignVersion", id: "" },
    });
  });

  it("does NOT match STALE_SPEC_VERSION for DesignVersion index name target", async () => {
    const cmd = defineCommand({
      action: "test.design_version_index",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw createP2002Error(["DesignVersion_workItemId_version_key"], "DesignVersion");
      },
    });

    const res = await cmd(testActor, {});
    expect(res).toEqual({
      ok: false,
      error: { code: "CONFLICT", entity: "DesignVersion", id: "" },
    });
  });

  it("prioritizes STALE_SPEC_VERSION over CHANGE_REQUEST_PENDING when target has workItemId and version for SpecVersion", async () => {
    const cmd = defineCommand({
      action: "test.stale_priority",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw createP2002Error(["workItemId", "version"], "SpecVersion");
      },
    });

    const res = await cmd(testActor, {});
    expect(res).toEqual({
      ok: false,
      error: { code: "STALE_SPEC_VERSION" },
    });
  });

  it("matches CHANGE_REQUEST_PENDING when target only includes workItemId for ChangeRequest", async () => {
    const cmd = defineCommand({
      action: "test.pending_cr",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw createP2002Error(["workItemId"], "ChangeRequest");
      },
    });

    const res = await cmd(testActor, {});
    expect(res).toEqual({
      ok: false,
      error: { code: "CHANGE_REQUEST_PENDING" },
    });
  });

  it("matches CHANGE_REQUEST_PENDING when modelName is undefined and target has workItemId", async () => {
    const cmd = defineCommand({
      action: "test.pending_cr_no_model",
      input: z.object({}),
      permission: "order.edit",
      run: async () => {
        throw createP2002Error(["workItemId"]);
      },
    });

    const res = await cmd(testActor, {});
    expect(res).toEqual({
      ok: false,
      error: { code: "CHANGE_REQUEST_PENDING" },
    });
  });
});
