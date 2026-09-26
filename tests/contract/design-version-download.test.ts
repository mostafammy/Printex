import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor, Permission } from "~/server/auth";
import { ForbiddenError } from "~/server/auth/authorize";
import { UnauthenticatedError } from "~/server/auth/getActor";
import { LocalDiskStorageAdapter } from "~/server/core";

// ── Mock env, auth and db ──────────────────────────────────────────────────
vi.mock("~/env", () => ({
  env: {
    STORAGE_ROOT: "./.storage",
    NODE_ENV: "test",
  },
}));

let currentActor: Actor | null = null;
let shouldThrowUnauthenticated = false;

vi.mock("~/server/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth")>();
  return {
    ...actual,
    getActor: vi.fn(async () => {
      if (shouldThrowUnauthenticated || !currentActor) {
        throw new UnauthenticatedError("UNAUTHENTICATED");
      }
      return currentActor;
    }),
  };
});

let mockDesignVersion: any = null;

vi.mock("~/server/db", () => ({
  db: {
    designVersion: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (mockDesignVersion && mockDesignVersion.id === where.id) {
          return mockDesignVersion;
        }
        return null;
      }),
    },
  },
}));

// Import route after mocks are registered
import { GET } from "~/app/api/design-versions/[id]/download/route";
import { authorizeDownload } from "~/app/api/design-versions/[id]/download/authorize";

function makeActor(permissions: Permission[], departmentIds: string[] = [], userId = "user-1"): Actor {
  return {
    userId,
    roles: [],
    permissions: new Set<Permission>(permissions),
    departmentIds,
  };
}

describe("GET /api/design-versions/[id]/download", () => {
  let root: string;
  let adapter: LocalDiskStorageAdapter;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "printex-download-test-"));
    adapter = new LocalDiskStorageAdapter(root);
    (globalThis as any).downloadStorageAdapter = adapter;

    // Seed a test file into local storage
    const content = Buffer.from("PDF-MOCK-CONTENT-BYTES");
    await adapter.put("design-versions/wi-100/1-approved.pdf", Readable.from([content]));

    mockDesignVersion = {
      id: "dv-approved-1",
      workItemId: "wi-100",
      version: 1,
      storageKey: "design-versions/wi-100/1-approved.pdf",
      fileName: "approved-file.pdf",
      mimeType: "application/pdf",
      sizeBytes: content.length,
      sha256: "dummy-sha256",
      approvedAt: new Date(),
      approvedById: "reviewer-1",
      workItem: {
        id: "wi-100",
        departmentId: "dept-offset",
        assigneeId: "designer-10",
        productType: { defaultDepartmentId: "dept-offset" },
      },
    };

    shouldThrowUnauthenticated = false;
    currentActor = makeActor(["files.download_production"], ["dept-offset"]);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  afterAll(() => {
    delete (globalThis as any).downloadStorageAdapter;
  });

  it("returns 403 on unauthenticated request", async () => {
    shouldThrowUnauthenticated = true;

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "FORBIDDEN" });
  });

  it("returns 403 when production operator is outside the work item's department", async () => {
    currentActor = makeActor(["files.download_production"], ["other-dept"]);

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "FORBIDDEN" });
  });

  it("returns 403 when caller has unrelated permissions (e.g. reception)", async () => {
    currentActor = makeActor(["order.create", "customer.manage"], ["dept-offset"]);

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "FORBIDDEN" });
  });

  it("returns 404 when design version record does not exist", async () => {
    const res = await GET(new Request("http://localhost/api/design-versions/non-existent/download"), {
      params: Promise.resolve({ id: "non-existent" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "NOT_FOUND" });
  });

  it("returns 403 when production operator attempts to download an unapproved draft", async () => {
    mockDesignVersion.approvedAt = null;

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "FORBIDDEN" });
  });

  it("returns 404 when file is missing in the storage adapter", async () => {
    mockDesignVersion.storageKey = "design-versions/wi-100/missing-on-disk.pdf";

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "NOT_FOUND" });
  });

  it("streams the file with correct headers for production operator with files.download_production", async () => {
    currentActor = makeActor(["files.download_production"], ["dept-offset"]);

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Length")).toBe("22");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="approved-file.pdf"');

    const text = await res.text();
    expect(text).toBe("PDF-MOCK-CONTENT-BYTES");
  });

  it("streams the file for production operator with production.operate", async () => {
    currentActor = makeActor(["production.operate"], ["dept-offset"]);

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("PDF-MOCK-CONTENT-BYTES");
  });

  it("streams the file for a reviewer with design.review", async () => {
    currentActor = makeActor(["design.review"], []);

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("PDF-MOCK-CONTENT-BYTES");
  });

  it("streams the file for the assigned designer with design.work", async () => {
    currentActor = makeActor(["design.work"], [], "designer-10");

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("PDF-MOCK-CONTENT-BYTES");
  });

  it("returns 403 when another designer (not assigned) attempts to download", async () => {
    currentActor = makeActor(["design.work"], [], "different-designer");

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "FORBIDDEN" });
  });

  it("falls back to application/octet-stream when mimeType is null", async () => {
    mockDesignVersion.mimeType = null;

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("safely sanitizes quotes and newlines in fileName for Content-Disposition", async () => {
    mockDesignVersion.fileName = 'quote"injection\r\ntest.pdf';

    const res = await GET(new Request("http://localhost/api/design-versions/dv-approved-1/download"), {
      params: Promise.resolve({ id: "dv-approved-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="quote\\"injectiontest.pdf"');
  });
});

describe("authorizeDownload unit logic", () => {
  const baseItem = {
    approvedAt: new Date(),
    workItem: {
      departmentId: "dept-A",
      assigneeId: "designer-1",
      productType: { defaultDepartmentId: "dept-A" },
    },
  };

  it("passes for admin.override regardless of department", () => {
    const actor = makeActor(["admin.override"], []);
    expect(() => authorizeDownload(actor, baseItem)).not.toThrow();
  });

  it("passes for design.review regardless of department", () => {
    const actor = makeActor(["design.review"], []);
    expect(() => authorizeDownload(actor, baseItem)).not.toThrow();
  });

  it("passes for assigned designer", () => {
    const actor = makeActor(["design.work"], [], "designer-1");
    expect(() => authorizeDownload(actor, baseItem)).not.toThrow();
  });

  it("throws for unassigned designer", () => {
    const actor = makeActor(["design.work"], [], "designer-other");
    expect(() => authorizeDownload(actor, baseItem)).toThrow();
  });

  it("throws when production operator tries to access unapproved design version", () => {
    const actor = makeActor(["files.download_production"], ["dept-A"]);
    expect(() =>
      authorizeDownload(actor, {
        ...baseItem,
        approvedAt: null,
      }),
    ).toThrow();
  });

  it("passes for files.download_production in matching department", () => {
    const actor = makeActor(["files.download_production"], ["dept-A"]);
    expect(() => authorizeDownload(actor, baseItem)).not.toThrow();
  });

  it("throws for files.download_production in wrong department", () => {
    const actor = makeActor(["files.download_production"], ["dept-B"]);
    expect(() => authorizeDownload(actor, baseItem)).toThrowError(ForbiddenError);
  });

  it("passes for production.operate in matching department", () => {
    const actor = makeActor(["production.operate"], ["dept-A"]);
    expect(() => authorizeDownload(actor, baseItem)).not.toThrow();
  });

  it("throws for production.operate in wrong department", () => {
    const actor = makeActor(["production.operate"], ["dept-B"]);
    expect(() => authorizeDownload(actor, baseItem)).toThrowError(ForbiddenError);
  });
});
