"use client";

// late-cancel-form.tsx — Late cancellation (reason + explicit cost) for a Work
// Item whose production started, and the order-cancel form that lists the
// items needing it. tasks.md T067, contracts/change-control.md
// §cancelAfterProductionStarted, spec FR-024–026. The Server Actions live on
// the order page.

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";
import type { EditSpecActionResult } from "./change-error-messages";

const L = ar.changes.lateCancel;
const S = ar.ui;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/** Mirrors the server's cost rule so the browser refuses "1.234" or "-5" early. */
const COST_PATTERN = "\\d{1,10}(\\.\\d{1,2})?";

export type LateCancelAction = (
  prevState: EditSpecActionResult | null,
  formData: FormData,
) => Promise<EditSpecActionResult>;

export interface LateCancelFormProps {
  readonly workItemId: string;
  readonly orderId: string;
  readonly action: LateCancelAction;
}

export function LateCancelForm({ workItemId, orderId, action }: LateCancelFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const id = (field: string) => `${workItemId}-late-${field}`;

  return (
    <details className="rounded-md border border-destructive/40 p-3" data-testid="late-cancel-section">
      <summary className="cursor-pointer text-sm font-medium text-destructive">{L.triggerButton}</summary>
      <p className="mt-2 text-xs text-muted-foreground">{L.requiredNotice}</p>

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="workItemId" value={workItemId} />
        <input type="hidden" name="orderId" value={orderId} />

        {state?.error && (
          <div className="rounded bg-destructive/10 p-2 text-xs text-destructive" role="alert" data-testid="late-cancel-error">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div
            className="rounded bg-emerald-100 p-2 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            role="status"
            data-testid="late-cancel-success"
          >
            {L.successMessage}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={id("reason")} className="text-xs text-muted-foreground">
            {L.reasonLabel}
          </label>
          <textarea
            id={id("reason")}
            name="reason"
            required
            rows={2}
            placeholder={L.reasonPlaceholder}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={id("cost")} className="text-xs text-muted-foreground">
              {L.costLabel}
            </label>
            {/* Text, not number: the amount is an exact decimal, never a float. No default. */}
            <input
              id={id("cost")}
              name="costIncurred"
              type="text"
              inputMode="decimal"
              dir="ltr"
              required
              pattern={COST_PATTERN}
              placeholder={L.costPlaceholder}
              aria-describedby={id("cost-hint")}
              className={inputCls}
            />
            <p id={id("cost-hint")} className="text-xs text-muted-foreground">
              {L.costHint}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={id("produced")} className="text-xs text-muted-foreground">
              {L.producedLabel}
            </label>
            <input id={id("produced")} name="producedQuantitySoFar" type="number" min={0} step={1} className={inputCls} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id("note")} className="text-xs text-muted-foreground">
            {L.noteLabel}
          </label>
          <input id={id("note")} name="costNote" type="text" className={inputCls} />
        </div>

        <div>
          <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
            {isPending ? L.submittingButton : L.submitButton}
          </Button>
        </div>
      </form>
    </details>
  );
}

export type CancelOrderActionResult = {
  readonly cancelledCount: number;
  readonly requiresLateCancellation: readonly string[];
};

export interface CancelOrderFormProps {
  readonly orderId: string;
  /** Work Item id → display label, for the "needs late cancellation" list. */
  readonly workItemLabels: Readonly<Record<string, string>>;
  readonly action: (
    prevState: CancelOrderActionResult | null,
    formData: FormData,
  ) => Promise<CancelOrderActionResult | null>;
}

/** Order-level cancel that reports the items it could not cancel (FR-026). */
export function CancelOrderForm({ orderId, workItemLabels, action }: CancelOrderFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <div className="mt-4 flex flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${orderId}-cancel-reason`} className="text-xs text-muted-foreground">
            {S.cancelReasonLabel}
          </label>
          <input id={`${orderId}-cancel-reason`} name="reason" type="text" required className={inputCls} />
        </div>
        <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
          {S.cancelOrderButton}
        </Button>
      </form>

      {state && (
        <div className="rounded-md bg-muted p-3 text-sm" role="status" data-testid="cancel-order-result">
          <p>
            {L.orderCancelledCount} {state.cancelledCount}
          </p>
          {state.requiresLateCancellation.length > 0 && (
            <div className="mt-2 text-destructive">
              <p className="font-medium">{L.orderRequiresHeading}</p>
              <ul className="mt-1 list-inside list-disc">
                {state.requiresLateCancellation.map((wid) => (
                  <li key={wid}>{workItemLabels[wid] ?? wid}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
