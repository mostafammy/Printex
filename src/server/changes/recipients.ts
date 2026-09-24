// recipients.ts — Single-query recipient resolution for notifications.
// research.md §17, §19 (specs/016-change-control/research.md).

import type { Prisma } from "../../../generated/prisma";
import type { Permission } from "~/server/auth";

/**
 * Resolves active user IDs holding the specified permission through assigned
 * roles or extra permissions in a single database query (no N+1).
 */
export async function usersWithPermission(
  tx: Prisma.TransactionClient,
  permission: Permission,
): Promise<string[]> {
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      OR: [
        {
          roles: {
            some: {
              role: {
                permissions: {
                  some: { permission },
                },
              },
            },
          },
        },
        {
          extraPermissions: {
            some: { permission },
          },
        },
      ],
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}
