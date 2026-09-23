import { notFound } from "next/navigation";
import { CustomerProfile } from "~/components/customers/customer-profile";
import { getCustomer } from "~/server/customers";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCustomer((await params).id);
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
        specialPricing: <span className="text-sm text-muted-foreground">الأسعار الخاصة — قريباً</span>,
        messages: <span className="text-sm text-muted-foreground">الرسائل — قريباً</span>,
      }}
    />
  );
}
