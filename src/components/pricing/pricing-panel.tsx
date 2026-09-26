import { Tag, CheckCircle2 } from "lucide-react";
import type { PricingStatusValue, QuoteResult } from "~/server/pricing";

type PricingPanelProps = {
  readonly workItemId: string;
  readonly status: PricingStatusValue;
  readonly quote?: QuoteResult | null;
};

export function PricingPanel({ workItemId, status, quote }: PricingPanelProps) {
  const isPriced = status === "PRICED" || Boolean(quote);

  return (
    <section aria-labelledby={`pricing-${workItemId}`} className="apple-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Tag className="h-4 w-4" />
          </div>
          <h2 id={`pricing-${workItemId}`} className="text-sm font-bold text-foreground">
            التسعير والقيمة
          </h2>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
            isPriced
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isPriced && <CheckCircle2 className="h-3 w-3" />}
          <span>{status}</span>
        </span>
      </div>

      {quote ? (
        <dl className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <dt className="text-2xs font-medium text-muted-foreground">المبلغ الإجمالي</dt>
            <dd className="mt-1 text-base font-bold text-primary">
              {quote.amount} <span className="text-xs text-muted-foreground">{quote.currency}</span>
            </dd>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <dt className="text-2xs font-medium text-muted-foreground">وحدة التسعير</dt>
            <dd className="mt-1 font-semibold text-foreground">{quote.breakdown.unit}</dd>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <dt className="text-2xs font-medium text-muted-foreground">الكمية المحتسبة</dt>
            <dd className="mt-1 font-semibold text-foreground">{quote.breakdown.quantity}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">لا يوجد تسعير معتمد لهذا الصنف بعد.</p>
      )}
    </section>
  );
}