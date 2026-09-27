import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Layers,
  FileText,
  CreditCard,
  Tag,
  MessageSquare,
  Sparkles,
  Building2,
} from "lucide-react";

type CustomerProfileProps = {
  customer: {
    name: string;
    phones: { phoneE164: string }[];
    notes: string | null;
    isCashCustomer?: boolean;
    createdAt?: Date | string;
    classification?: { name?: string; segment?: string } | null;
  };
  orders: ReactNode;
  notes?: ReactNode;
  slots?: { paymentsBalance?: ReactNode; specialPricing?: ReactNode; messages?: ReactNode };
};

export function CustomerProfile({ customer, orders, notes, slots }: CustomerProfileProps) {
  const initial = customer.name.trim().charAt(0) || "ع";

  return (
    <section dir="rtl" className="flex flex-col gap-6">
      {/* ── Breadcrumb ── */}
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>العودة إلى دليل العملاء</span>
        </Link>
      </div>

      {/* ── Hero Customer Header Card ── */}
      <header className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-10 -me-10 h-52 w-52 rounded-full bg-linear-to-br from-primary/10 to-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary via-indigo-600 to-purple-600 text-2xl font-bold text-white shadow-md shadow-primary/25">
              <span>{initial}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {customer.name}
                </h1>
                {customer.isCashCustomer ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    عميل نقدي
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="h-3 w-3" />
                    <span>{customer.classification?.name ?? customer.classification?.segment ?? "عميل دائم"}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {customer.phones.length > 0 ? (
                  customer.phones.map((phone) => (
                    <a
                      key={phone.phoneE164}
                      href={`tel:${phone.phoneE164}`}
                      dir="ltr"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 font-mono font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{phone.phoneE164}</span>
                    </a>
                  ))
                ) : (
                  <span>لا يوجد هاتف مسجل</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Segmented Navigation Bar ── */}
      <div
        role="tablist"
        aria-label="Customer profile tabs"
        className="flex w-fit items-center gap-1.5 rounded-2xl border border-border/70 bg-muted/40 p-1.5 shadow-2xs backdrop-blur-md"
      >
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="rounded-xl bg-card px-4 py-1.5 text-xs font-semibold text-foreground shadow-xs transition-all"
        >
          نظرة عامة · Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          className="rounded-xl px-4 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
        >
          الطلبات · Orders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          className="rounded-xl px-4 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
        >
          الملاحظات · Notes
        </button>
      </div>

      {/* ── Primary Bento Grid: Overview / Orders / Notes ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Overview */}
        <section className="apple-card p-6 flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Building2 className="h-4 w-4" />
              <h2 className="text-sm font-bold text-foreground">Overview · نظرة عامة</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {customer.notes ?? "لا توجد ملاحظات عامة مسجلة على ملف هذا العميل."}
            </p>
          </div>
          <div className="mt-4 border-t border-border/50 pt-3 text-2xs text-muted-foreground">
            ملف عميل معتمد في المنظومة
          </div>
        </section>

        {/* Orders */}
        <section className="apple-card p-6 flex flex-col">
          <div className="mb-3 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Layers className="h-4 w-4" />
            <h2 className="text-sm font-bold text-foreground">Orders · الطلبات</h2>
          </div>
          <div className="flex-1 text-xs text-muted-foreground overflow-y-auto max-h-52">
            {orders}
          </div>
        </section>

        {/* Notes */}
        <section className="apple-card p-6 flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <FileText className="h-4 w-4" />
              <h2 className="text-sm font-bold text-foreground">Notes · الملاحظات</h2>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {notes ?? customer.notes ?? "لا توجد ملاحظات إضافية."}
            </div>
          </div>
        </section>
      </div>

      {/* ── Secondary Bento Grid: Financial Balance / Special Pricing / Messages ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="امتدادات الملف">
        {/* Payments Balance slot */}
        <div className="apple-card p-6">
          <div className="mb-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CreditCard className="h-4 w-4" />
            <h3 className="text-sm font-bold text-foreground">الرصيد والحساب المالي</h3>
          </div>
          {slots?.paymentsBalance}
        </div>

        {/* Special Pricing slot */}
        <div className="apple-card p-6">
          <div className="mb-4 flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Tag className="h-4 w-4" />
            <h3 className="text-sm font-bold text-foreground">قواعد الأسعار الخاصة</h3>
          </div>
          {slots?.specialPricing}
        </div>

        {/* Messages slot */}
        <div className="apple-card p-6">
          <div className="mb-4 flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
            <MessageSquare className="h-4 w-4" />
            <h3 className="text-sm font-bold text-foreground">المراسلات والإشعارات</h3>
          </div>
          {slots?.messages}
        </div>
      </div>
    </section>
  );
}
