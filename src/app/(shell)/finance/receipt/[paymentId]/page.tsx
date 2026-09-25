// Printable payment receipt — 052-finance US8 (T055, FR-022).
// Print-optimized, A5 paper-width-agnostic layout, VOID watermark,
// renders with fields matching the stored payment (SC-010).

import Link from "next/link";
import { notFound } from "next/navigation";
import { authorize, getActor } from "~/server/auth";
import { DomainFinanceError, getReceipt } from "~/server/finance";
import { PrintButton } from "~/components/finance/print-button";
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
    <div className="mx-auto w-full max-w-[148mm] print:max-w-none">
      <div
        className={
          receipt.voided
            ? "relative rounded-lg border border-destructive/50 bg-card p-6 print:border-none"
            : "rounded-lg border border-border bg-card p-6 print:border-none"
        }
      >
        {receipt.voided && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 text-4xl font-bold tracking-widest text-destructive/40">
              {S.voided}
            </span>
          </span>
        )}

        <header className="border-b border-border pb-3 text-center">
          <h1 className="text-lg font-bold">{receipt.shopName}</h1>
          <p className="text-sm text-muted-foreground">
            {S.receipt} #{receipt.receiptNumber}
          </p>
        </header>

        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">#{receipt.orderNumber}</dt>
            <dd>{receipt.customerName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{S.amount}</dt>
            <dd className="font-semibold">{receipt.amount} ج.م</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{S.method}</dt>
            <dd>
              {receipt.method} / {receipt.source}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{S.date}</dt>
            <dd>{receipt.occurredAtLocal}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{S.recorder}</dt>
            <dd>{receipt.recordedByName}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-border pt-2">
            <dt className="text-muted-foreground">{S.remaining}</dt>
            <dd className="font-semibold">{receipt.remainingAfter} ج.م</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex justify-center gap-3 print:hidden">
        <PrintButton />
        <Link
          href={`/orders/${receipt.orderId}`}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          ←
        </Link>
      </div>
    </div>
  );
}
