import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { CustomerProfile } from "~/components/customers/customer-profile";
import { SpecialPricingTab } from "~/components/customers/special-pricing-tab";
import { CustomerBalanceTab } from "~/components/finance/customer-balance-tab";
import { getCustomer } from "~/server/customers";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <CustomerProfile
      customer={customer}
      orders={
        customer.orders.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">لا توجد طلبات مسجلة لهذا العميل بعد.</p>
        ) : (
          <ul className="space-y-2">
            {customer.orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="group flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 transition-all hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      #{order.number}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                        order.priority === "URGENT"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {order.priority === "URGENT" ? "عاجل" : "عادي"}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      }
      slots={{
        paymentsBalance: <CustomerBalanceTab customerId={id} />,
        specialPricing: <SpecialPricingTab customerId={id} />,
        messages: <span className="text-xs text-muted-foreground">الرسائل والإشعارات — قريباً</span>,
      }}
    />
  );
}
