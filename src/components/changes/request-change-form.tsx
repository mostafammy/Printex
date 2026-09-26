"use client";

// request-change-form.tsx — Change request (proposed fields + reason) and
// withdraw forms for a Work Item in production. tasks.md T051,
// contracts/change-control.md §createChangeRequest / §withdrawChangeRequest.
// Rendered by the Server Component edit-spec-form.tsx for the CHANGE_REQUEST
// policy; the Server Actions live on the order page.

import { useActionState } from "react";
import type { SpecSnapshot } from "~/server/changes";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";
import type { EditSpecActionResult } from "./change-error-messages";
import { copyChangedSpecFields } from "./change-request-format";

const E = ar.changes.edit;
const R = ar.changes.request;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export type ChangeRequestAction = (
  prevState: EditSpecActionResult | null,
  formData: FormData,
) => Promise<EditSpecActionResult>;

function ResultMessage({
  state,
  successText,
  testId,
}: {
  state: EditSpecActionResult | null;
  successText: string;
  testId: string;
}) {
  if (state?.error) {
    return (
      <div
        className="bg-destructive/10 text-destructive rounded p-2 text-xs"
        role="alert"
        data-testid={`${testId}-error`}
      >
        {state.error}
      </div>
    );
  }
  if (state?.success) {
    return (
      <div
        className="rounded bg-emerald-100 p-2 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
        role="status"
        data-testid={`${testId}-success`}
      >
        {successText}
      </div>
    );
  }
  return null;
}

export interface RequestChangeFormProps {
  readonly workItemId: string;
  readonly orderId: string;
  readonly currentSpec: SpecSnapshot;
  readonly action: ChangeRequestAction;
}

export function RequestChangeForm({
  workItemId,
  orderId,
  currentSpec,
  action,
}: RequestChangeFormProps) {
  // Send only the fields that differ from the rendered specification.
  const submitAction = async (
    prevState: EditSpecActionResult | null,
    formData: FormData,
  ) => {
    const outgoing = new FormData();
    outgoing.set("workItemId", workItemId);
    outgoing.set("orderId", orderId);
    const reason = formData.get("reason");
    outgoing.set("reason", typeof reason === "string" ? reason.trim() : "");
    copyChangedSpecFields(formData, currentSpec, outgoing);
    return action(prevState, outgoing);
  };

  const [state, formAction, isPending] = useActionState(submitAction, null);
  const id = (field: string) => `${workItemId}-cr-${field}`;

  return (
    <details
      className="border-border mt-3 rounded-md border p-3"
      data-testid="request-change-section"
    >
      <summary className="text-primary cursor-pointer text-sm font-medium">
        {R.triggerButton}
      </summary>
      <p className="text-muted-foreground mt-2 text-xs">{R.notice}</p>

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <ResultMessage
          state={state}
          successText={R.successMessage}
          testId="request-change"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={id("quantity")}
              className="text-muted-foreground text-xs"
            >
              {E.quantityLabel}
            </label>
            <input
              id={id("quantity")}
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={currentSpec.quantity ?? ""}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={id("widthValue")}
              className="text-muted-foreground text-xs"
            >
              {E.widthLabel}
            </label>
            <input
              id={id("widthValue")}
              name="widthValue"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={currentSpec.widthValue ?? ""}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={id("heightValue")}
              className="text-muted-foreground text-xs"
            >
              {E.heightLabel}
            </label>
            <input
              id={id("heightValue")}
              name="heightValue"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={currentSpec.heightValue ?? ""}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={id("dimensionUnit")}
              className="text-muted-foreground text-xs"
            >
              {E.dimensionUnitLabel}
            </label>
            <select
              id={id("dimensionUnit")}
              name="dimensionUnit"
              defaultValue={currentSpec.dimensionUnit ?? ""}
              className={inputCls}
            >
              <option value="">—</option>
              <option value="MM">MM</option>
              <option value="CM">CM</option>
              <option value="M">M</option>
              <option value="IN">IN</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={id("material")}
              className="text-muted-foreground text-xs"
            >
              {E.materialLabel}
            </label>
            <input
              id={id("material")}
              name="material"
              type="text"
              defaultValue={currentSpec.material ?? ""}
              placeholder={E.materialPlaceholder}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={id("description")}
              className="text-muted-foreground text-xs"
            >
              {E.descriptionLabel}
            </label>
            <input
              id={id("description")}
              name="description"
              type="text"
              defaultValue={currentSpec.description ?? ""}
              placeholder={E.descriptionPlaceholder}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={id("finishNotes")}
            className="text-muted-foreground text-xs"
          >
            {E.finishNotesLabel}
          </label>
          <input
            id={id("finishNotes")}
            name="finishNotes"
            type="text"
            defaultValue={currentSpec.finishNotes ?? ""}
            placeholder={E.finishNotesPlaceholder}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={id("reason")}
            className="text-muted-foreground text-xs"
          >
            {R.reasonLabel}
          </label>
          <textarea
            id={id("reason")}
            name="reason"
            required
            rows={2}
            placeholder={R.reasonPlaceholder}
            className={inputCls}
          />
        </div>

        <div>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isPending}
          >
            {isPending ? R.submittingButton : R.submitButton}
          </Button>
        </div>
      </form>
    </details>
  );
}

export interface WithdrawChangeRequestFormProps {
  readonly changeRequestId: string;
  readonly orderId: string;
  readonly action: ChangeRequestAction;
}

export function WithdrawChangeRequestForm({
  changeRequestId,
  orderId,
  action,
}: WithdrawChangeRequestFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const reasonId = `${changeRequestId}-withdraw-reason`;

  return (
    <div
      className="mt-3 flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-900/20"
      data-testid="pending-change-request"
    >
      <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
        {R.pendingNotice}
      </p>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="changeRequestId" value={changeRequestId} />
        <input type="hidden" name="orderId" value={orderId} />
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor={reasonId} className="text-muted-foreground text-xs">
            {R.withdrawReasonLabel}
          </label>
          <input
            id={reasonId}
            name="reason"
            type="text"
            required
            className={inputCls}
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? R.withdrawingButton : R.withdrawButton}
        </Button>
      </form>
      <ResultMessage
        state={state}
        successText={R.withdrawSuccessMessage}
        testId="withdraw-change"
      />
    </div>
  );
}
