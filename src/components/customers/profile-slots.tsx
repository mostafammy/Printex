import type { ReactNode } from "react";

export type CustomerProfileSlots = {
  paymentsBalance?: ReactNode;
  specialPricing?: ReactNode;
  messages?: ReactNode;
};

export function CustomerProfileSlots({ slots }: { slots: CustomerProfileSlots }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" aria-label="امتدادات ملف العميل">
      <section aria-label="المدفوعات والرصيد">{slots.paymentsBalance}</section>
      <section aria-label="الأسعار الخاصة">{slots.specialPricing}</section>
      <section aria-label="الرسائل">{slots.messages}</section>
    </div>
  );
}
