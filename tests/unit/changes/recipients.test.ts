import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../generated/prisma";
import { usersWithPermission } from "~/server/changes/recipients";

describe("usersWithPermission (T020)", () => {
  it("executes a single query checking roles and extraPermissions for active users", async () => {
    const findManyMock = vi.fn().mockResolvedValue([
      { id: "user-1" },
      { id: "user-2" },
    ]);

    const fakeTx = {
      user: {
        findMany: findManyMock,
      },
    } as unknown as Prisma.TransactionClient;

    const userIds = await usersWithPermission(fakeTx, "change.approve");

    expect(userIds).toEqual(["user-1", "user-2"]);
    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [
          {
            roles: {
              some: {
                role: {
                  permissions: {
                    some: { permission: "change.approve" },
                  },
                },
              },
            },
          },
          {
            extraPermissions: {
              some: { permission: "change.approve" },
            },
          },
        ],
      },
      select: { id: true },
    });
  });
});
