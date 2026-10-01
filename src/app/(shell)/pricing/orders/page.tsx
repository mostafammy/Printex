import { redirect } from "next/navigation";

export default async function PricingOrdersRedirectPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
