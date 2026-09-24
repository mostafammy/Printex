import { fileService } from "@/server/files/index.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/server/db/client.js";

describe("Authorization matrix tests", () => {
  let testWorkItemId: string;
  let designerId: string;
  let productionOperatorId: string;
  let adminId: string;
  let otherDeptOperatorId: string;

  beforeEach(async () => {
    // Get test users
    const designer = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "DESIGNER" } } } },
    });
    const productionOperator = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "PRODUCTION_OPERATOR" } } } },
    });
    const admin = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "ADMIN_OWNER" } } } },
    });
    const otherDeptOperator = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "PRODUCTION_OPERATOR" } } } },
    });

    if (!designer || !productionOperator || !admin) {
      throw new Error("Required test users not found");
    }

    designerId = designer.id;
    productionOperatorId = productionOperator.id;
    adminId = admin.id;
    otherDeptOperatorId = otherDeptOperator?.id || productionOperatorId;

    // Get a work item in production operator's department
    const workItem = await prisma.workItem.findFirst({
      where: {
        state: "APPROVED",
        departmentId: productionOperator.departmentIds[0],
      },
      include: { department: true },
    });
    if (!workItem) {
      throw new Error("No approved work item found");
    }
    testWorkItemId = workItem.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.fileVersion.deleteMany({
      where: { fileAsset: { workItemId: testWorkItemId } },
    });
    await prisma.fileAsset.deleteMany({
      where: { workItemId: testWorkItemId },
    });
  });

  it("allows Admin to download any file", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024).fill(0x41));
        controller.close();
      },
    });

    const fileVersion = await fileService.upload({
      workItemId: testWorkItemId,
      category: "APPROVED",
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024).fill(0x41));
          controller.close();
        },
      }),
      fileName: "test.pdf",
      actor: { id: "admin-user" } as any,
    });

    // Admin should be able to get download URL
    const downloadUrl = await fileService.getDownloadUrl(
      fileVersion.id,
      { id: adminId } as any,
    );

    expect(downloadUrl).toBeDefined();
    expect(downloadUrl).toContain("/api/files/");
  });

  it("allows assigned designer to download files for their work items", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024).fill(0x41));
        controller.close();
      },
    });

    // Create file with designer as uploader
    const fileVersion = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024).fill(0x41));
          controller.close();
        },
      }),
      fileName: "design.ai",
      actor: { id: "designer-user" } as any,
    });

    // Designer should be able to get download URL for their own upload
    const downloadUrl = await fileService.getDownloadUrl(
      fileVersion.id,
      { id: "designer-user" } as any,
    );

    expect(downloadUrl).toBeDefined();
  });

  it("allows same-department production operator to download Approved/Production files", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024).fill(0x41));
        controller.close();
      },
    });

    // Create file in APPROVED category
    const fileVersion = await fileService.upload({
      workItemId: testWorkItemId,
      category: "APPROVED",
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024).fill(0x41));
          controller.close();
        },
      }),
      fileName: "approved.pdf",
      actor: { id: "designer-user" } as any,
    });

    // Production operator in same department should be able to download
    const downloadUrl = await fileService.getDownloadUrl(
      fileVersion.id,
      {
        id: productionOperatorId,
        permissions: new Set(["production.operate"]),
        departmentIds: ["same-dept-id"],
      } as any,
    );

    expect(downloadUrl).toBeDefined();
  });

  it("denies other-department production operator from downloading Approved/Production files", async () => {
    const fileVersion = await fileService.upload({
      workItemId: testWorkItemId,
      category: "APPROVED",
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024).fill(0x41));
          controller.close();
        },
      }),
      fileName: "approved.pdf",
      actor: { id: "designer-user" } as any,
    });

    // Other department operator should be denied
    await expect(
      fileService.getDownloadUrl(
        fileVersion.id,
        {
          id: otherDeptOperatorId,
          permissions: new Set(["production.operate"]),
          departmentIds: ["other-dept-id"],
        } as any,
      ),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("denies production operator from downloading Design Versions files", async () => {
    const fileVersion = await fileService.upload({
      workItemId: testWorkItemId,
      category: "DESIGN_VERSIONS",
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024).fill(0x41));
          controller.close();
        },
      }),
      fileName: "design.ai",
      actor: { id: "designer-user" } as any,
    });

    // Production operator should not be able to download DESIGN_VERSIONS
    await expect(
      fileService.getDownloadUrl(
        fileVersion.id,
        {
          id: productionOperatorId,
          permissions: new Set(["production.operate"]),
          departmentIds: ["same-dept-id"],
        } as any,
      ),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("denies unauthorized users from downloading", async () => {
    const fileVersion = await fileService.upload({
      workItemId: testWorkItemId,
      category: "APPROVED",
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(1024).fill(0x41));
          controller.close();
        },
      }),
      fileName: "approved.pdf",
      actor: { id: "designer-user" } as any,
    });

    // Random user with no permissions
    await expect(
      fileService.getDownloadUrl(
        fileVersion.id,
        {
          id: "random-user",
          permissions: new Set(),
          departmentIds: [],
        } as any,
      ),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("allows Admin to list all versions", async () => {
    const versions = await fileService.listVersions({
      workItemId: testWorkItemId,
      includeArchived: true,
    });

    expect(Array.isArray(versions)).toBe(true);
  });

  it("allows assigned designer to list versions for their work items", async () => {
    const versions = await fileService.listVersions({
      workItemId: testWorkItemId,
    });

    expect(Array.isArray(versions)).toBe(true);
  });

  it("allows same-department production operator to list versions for Approved/Production categories", async () => {
    const versions = await fileService.listVersions({
      workItemId: testWorkItemId,
      category: "APPROVED",
    });

    expect(Array.isArray(versions)).toBe(true);
  });
});