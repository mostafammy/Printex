import { authorize, getActor } from "~/server/auth";

export async function requireCustomerManager() {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  return actor;
}

export async function requireCustomerAdmin() {
  const actor = await requireCustomerManager();
  if (!actor.roles.includes("ADMIN_OWNER")) throw new Error("ADMIN_REQUIRED");
  return actor;
}
