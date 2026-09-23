import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";

export async function listRolesWithPermissions(
  actor: Actor,
): Promise<Array<{ id: string; key: string; name: string; permissions: string[] }>> {
  authorize(actor, "admin.users");

  const roles = await db.role.findMany({ include: { permissions: true } });

  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    permissions: role.permissions.map((rp) => rp.permission),
  }));
}
