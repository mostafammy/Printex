import { redirect } from "next/navigation";
import { getActor } from "~/server/auth";

export default async function PricingOrdersRedirectPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor.roles.includes("ACCOUNTING") && !actor.roles.includes("ADMIN_OWNER")) {
    redirect("/board");
  }

  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      qs.set(key, value);
    }
  }
  const query = qs.toString();
  redirect(`/accounting/orders${query ? `?${query}` : ""}`);
}
