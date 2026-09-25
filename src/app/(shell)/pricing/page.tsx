import { getActor } from "~/server/auth";
import { getPricingQueue } from "~/server/pricing";
import { PricingQueue } from "~/components/pricing/pricing-queue";
import ar from "~/messages/ar.json";

export default async function PricingQueuePage() {
  const actor = await getActor();
  const result = await getPricingQueue(actor);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{ar.ui.pricingQueuePageTitle}</h1>
      <PricingQueue rows={result.rows} />
    </div>
  );
}