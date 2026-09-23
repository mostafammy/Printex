import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";

export async function addDepartment(
  actor: Actor,
  name: string,
): Promise<{ departmentId: string }> {
  authorize(actor, "admin.config");

  let departmentId!: string;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const department = await tx.department.create({ data: { name } });
    departmentId = department.id;

    await audit.record(tx, {
      action: "department.created",
      entityType: "Department",
      entityId: department.id,
      actorId: actor.userId,
      after: { name },
    });
  });

  return { departmentId };
}

export async function renameDepartment(
  actor: Actor,
  departmentId: string,
  newName: string,
): Promise<void> {
  authorize(actor, "admin.config");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.department.findUniqueOrThrow({
      where: { id: departmentId },
    });
    const oldName = existing.name;

    await tx.department.update({
      where: { id: departmentId },
      data: { name: newName },
    });

    await audit.record(tx, {
      action: "department.renamed",
      entityType: "Department",
      entityId: departmentId,
      actorId: actor.userId,
      before: { name: oldName },
      after: { name: newName },
    });
  });
}

export async function deactivateDepartment(
  actor: Actor,
  departmentId: string,
): Promise<void> {
  authorize(actor, "admin.config");

  const department = await db.department.findUnique({
    where: { id: departmentId },
  });
  // Spec edge case: silently no-op if the department doesn't exist or is already inactive.
  // No delete path exists — deactivate only (constitution VI).
  if (!department?.isActive) return;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.department.update({
      where: { id: departmentId },
      data: { isActive: false },
    });

    await audit.record(tx, {
      action: "department.deactivated",
      entityType: "Department",
      entityId: departmentId,
      actorId: actor.userId,
      before: { isActive: true },
      after: { isActive: false },
    });
  });
}
