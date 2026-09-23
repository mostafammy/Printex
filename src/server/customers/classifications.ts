import { db } from "~/server/db";
import { authorize, getActor } from "~/server/auth";

async function requireAdmin() {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  if (!actor.roles.includes("ADMIN_OWNER")) throw new Error("ADMIN_REQUIRED");
  return actor;
}

export async function findClassifications() {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  return db.customerClassification.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function createClassification(name: string) {
  await requireAdmin();
  return db.customerClassification.create({ data: { name: name.trim() } });
}

export async function updateClassification(id: string, name: string) {
  await requireAdmin();
  return db.customerClassification.update({ where: { id }, data: { name: name.trim() } });
}

export async function deactivateClassification(id: string) {
  await requireAdmin();
  return db.customerClassification.update({ where: { id }, data: { isActive: false } });
}
