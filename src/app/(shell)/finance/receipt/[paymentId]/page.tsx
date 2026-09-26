// Printable payment receipt — 052-finance US8 (T055, FR-022).
// Print-optimized, A5 paper-width-agnostic layout, VOID watermark,
// renders with fields matching the stored payment (SC-010).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Receipt as ReceiptIcon } from "lucide-react";
import { authorize, getActor } from "~/server/auth";
import { DomainFinanceError, getReceipt } from "~/server/finance";
import { PrintButton } from "~/components/finance/print-button";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui.finance;

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const actor = await getActor();
  authorize(actor, "finance.view");
  const { paymentId } = await params;

  let receipt;
  try {
    receipt = await getReceipt(paymentId);
  } catch (error) {
    if (error instanceof DomainFinanceError && error.code === "PAYMENT_NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-[148mm] print:max-w-none py-6">
      {/* ── Receipt Card ── */}
      <div
        className={
          receipt.voided
            ? "relative overflow-hidden rounded-3xl border border-destructive/40 bg-card p-8 shadow-lg print:border-none print:shadow-none"
            : "relative overflow-hidden rounded-3xl border border-border/80 bg-card p-8 shadow-lg print:border-none print:shadow-none"
        }
      >
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 end-0 -mt-10 -me-10 h-40 w-40 rounded-full bg-primary/5 blur-2xl pointer-events-none print:hidden" />

        {receipt.voided && (
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="-rotate-12 select-none rounded-2xl border-4 border-destructive/40 px-6 py-2 text-4xl font-extrabold tracking-widest text-destructive/40 uppercase">
              {S.voided}
            </span>
          </span>
        )}

        {/* Header */}
        <header className="border-b border-border/80 pb-5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary print:hidden">
            <ReceiptIcon className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">{receipt.shopName}</h1>
          <p className="mt-1 font-mono text-xs font-semibold text-muted-foreground">
            {S.receipt} #{receipt.receiptNumber}
          </p>
        </header>

        {/* Receipt Details */}
        <dl className="mt-6 grid gap-3.5 text-xs">
          <div className="flex justify-between gap-3 items-center">
            <dt className="text-muted-foreground font-medium">الطلب / العميل</dt>
            <dd className="font-bold text-foreground">
              #{receipt.orderNumber} — {receipt.customerName}
            </dd>
          </div>

          <div className="flex justify-between gap-3 items-center rounded-xl bg-muted/30 px-3 py-2">
            <dt className="text-foreground font-semibold">{S.amount}</dt>
            <dd className="font-extrabold text-base text-primary">
              {receipt.amount} ج.م
            </dd>
          </div>

          <div className="flex justify-between gap-3 items-center">
            <dt className="text-muted-foreground font-medium">{S.method}</dt>
            <dd className="font-medium text-foreground">
              {receipt.method} / {receipt.source}
            </dd>
          </div>

          <div className="flex justify-between gap-3 items-center">
            <dt className="text-muted-foreground font-medium">{S.date}</dt>
            <dd className="font-medium text-foreground">{receipt.occurredAtLocal}</dd>
          </div>

          <div className="flex justify-between gap-3 items-center">
            <dt className="text-muted-foreground font-medium">{S.recorder}</dt>
            <dd className="font-medium text-foreground">{receipt.recordedByName}</dd>
          </div>

          <div className="flex justify-between gap-3 items-center border-t border-dashed border-border pt-3">
            <dt className="text-muted-foreground font-semibold">{S.remaining}</dt>
            <dd className="font-bold text-sm text-foreground">{receipt.remainingAfter} ج.م</dd>
          </div>
        </dl>

        <footer className="mt-8 border-t border-border/60 pt-4 text-center text-2xs text-muted-foreground">
          شكراً لتعاملكم معنا · نظام Printex لإدارة المطابع
        </footer>
      </div>

      {/* ── Action Buttons (hidden during print) ── */}
      <div className="mt-6 flex items-center justify-center gap-3 print:hidden">
        <PrintButton />
        <Button
          variant="outline"
          render={<Link href={`/orders/${receipt.orderId}`} />}
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة للطلب</span>
        </Button>
      </div>
    </div>
  );
}
