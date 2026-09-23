import type { ReactNode } from "react";

type CustomerProfileProps = {
  customer: { name: string; phones: { phoneE164: string }[]; notes: string | null };
  orders: ReactNode;
  notes?: ReactNode;
  slots?: { paymentsBalance?: ReactNode; specialPricing?: ReactNode; messages?: ReactNode };
};

export function CustomerProfile({ customer, orders, notes, slots }: CustomerProfileProps) {
  return (
    <section dir="rtl" className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{customer.name}</h1>
        <p className="text-muted-foreground">{customer.phones.map((phone) => phone.phoneE164).join("، ")}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <section><h2 className="font-medium">نظرة عامة</h2><p>{customer.notes}</p></section>
        <section><h2 className="font-medium">الطلبات</h2>{orders}</section>
        <section><h2 className="font-medium">الملاحظات</h2>{notes ?? customer.notes}</section>
      </div>
      <div className="grid gap-4 md:grid-cols-3" aria-label="امتدادات الملف">
        <div>{slots?.paymentsBalance}</div>
        <div>{slots?.specialPricing}</div>
        <div>{slots?.messages}</div>
      </div>
    </section>
  );
}
