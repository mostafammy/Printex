import { notFound } from "next/navigation";
import { CustomerProfile } from "~/components/customers/customer-profile";
import { SpecialPricingTab } from "~/components/customers/special-pricing-tab";
import { getCustomer } from "~/server/customers";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <CustomerProfile
      customer={customer}
      orders={
        <ul className="space-y-1">
          {customer.orders.map((order) => <li key={order.id}>#{order.number}</li>)}
        </ul>
      }
      slots={{
        paymentsBalance: <span className="text-sm text-muted-foreground">الرصيد والمدفوعات — قريباً</span>,
        specialPricing: <SpecialPricingTab customerId={id} />,
        messages: <span className="text-sm text-muted-foreground">الرسائل — قريباً</span>,
      }}
    />
  );
}
