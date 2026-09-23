import Link from "next/link";
import { findCustomers } from "~/server/customers";

export default async function CustomersPage() {
  const customers = await findCustomers({ text: "", limit: 50 });
  return (
    <main dir="rtl" className="space-y-6">
      <h1 className="text-2xl font-semibold">العملاء</h1>
      <ul className="grid gap-3">
        {customers.map((customer) => (
          <li key={customer.id} className="rounded-md border border-border p-4">
            <Link href={`/customers/${customer.id}`} className="font-medium hover:underline">{customer.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
