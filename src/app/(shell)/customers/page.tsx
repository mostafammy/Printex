import Link from "next/link";
import {
  Users,
  Phone,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { findCustomers } from "~/server/customers";

export default async function CustomersPage() {
  const customers = await findCustomers({ text: "", limit: 50 });

  const classifiedCount = customers.filter((c) => c.classification).length;
  const phonesCount = customers.reduce((acc, c) => acc + c.phones.length, 0);

  return (
    <div className="flex flex-col gap-8" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              العملاء
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Users className="h-3 w-3" />
              <span>{customers.length} عميل</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            دليل العملاء المعتمدين، الحسابات الجارية، التصنيفات والأسعار الخاصة
          </p>
        </div>
      </div>

      {/* Bento Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              إجمالي العملاء
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {customers.length}
            </span>
            <span className="text-xs text-muted-foreground">سجل مسجل</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              عملاء مصنفون
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {classifiedCount}
            </span>
            <span className="text-xs text-muted-foreground">تصنيف نوعي</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              أرقام التواصل
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Phone className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {phonesCount}
            </span>
            <span className="text-xs text-muted-foreground">هاتف مفعل</span>
          </div>
        </div>
      </div>

      {/* Customer Bento Grid */}
      {customers.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">لا يوجد عملاء حالياً</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            لم يتم العثور على أي عملاء مسجلين في النظام.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => {
            const primaryPhone =
              customer.phones.find((p) => p.kind === "PRIMARY") ??
              customer.phones[0];

            return (
              <div
                key={customer.id}
                className="apple-card group relative flex flex-col justify-between p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/15 via-indigo-500/10 to-transparent text-primary font-bold text-base border border-primary/20 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                        {customer.name.charAt(0) || "ع"}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="truncate font-bold text-foreground group-hover:text-primary transition-colors text-base"
                        >
                          {customer.name}
                        </Link>
                        {customer.notes ? (
                          <span className="truncate text-xs text-muted-foreground mt-0.5">
                            {customer.notes}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 mt-0.5">
                            لا توجد ملاحظات
                          </span>
                        )}
                      </div>
                    </div>

                    {customer.classification && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-400">
                        {customer.classification.name}
                      </span>
                    )}
                  </div>

                  {primaryPhone && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-mono">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                      <span dir="ltr" className="tracking-wide">
                        {primaryPhone.phoneE164}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-border/60 pt-3">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="inline-flex w-full items-center justify-between text-xs font-semibold text-primary group-hover:underline"
                  >
                    <span>عرض الملف والأسعار</span>
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-[-2px] group-hover:translate-y-[-2px]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
