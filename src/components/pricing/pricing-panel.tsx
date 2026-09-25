import type { PricingStatusValue, QuoteResult } from "~/server/pricing";

type PricingPanelProps = {
  readonly workItemId: string;
  readonly status: PricingStatusValue;
  readonly quote?: QuoteResult | null;
};

export function PricingPanel({ workItemId, status, quote }: PricingPanelProps) {
  return (
    <section aria-labelledby={`pricing-${workItemId}`} className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`pricing-${workItemId}`} className="text-base font-semibold">التسعير</h2>
        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{status}</span>
      </div>
      {quote ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">المبلغ</dt><dd className="font-semibold">{quote.amount} {quote.currency}</dd></div>
          <div><dt className="text-muted-foreground">الوحدة</dt><dd>{quote.breakdown.unit}</dd></div>
          <div><dt className="text-muted-foreground">الكمية</dt><dd>{quote.breakdown.quantity}</dd></div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">لا يوجد تسعير معتمد لهذا الصنف.</p>
      )}
    </section>
  );
}