"use client";

// admin-override-form.tsx — Admin override of a Work Item's specification
// (fields plus a mandatory reason; an outcome while in production; the
// editSpec design choice before production). tasks.md T070,
// contracts/change-control.md §adminOverrideSpec. The Server Action lives on
// the order page, which renders this only for holders of admin.override.

import { useState, useActionState } from "react";
import type { RedesignChoice, SpecSnapshot } from "~/server/changes";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";
import type { EditSpecActionResult } from "./change-error-messages";
import { copyChangedSpecFields } from "./change-request-format";
import type { ChangeRequestAction } from "./request-change-form";

const E = ar.changes.edit;
const O = ar.changes.override;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface AdminOverrideFormProps {
  readonly workItemId: string;
  readonly orderId: string;
  readonly expectedVersion: number;
  readonly currentSpec: SpecSnapshot;
  /** IN_PRODUCTION: an outcome is required. */
  readonly inProduction: boolean;
  /** Whether the REDESIGN outcome may be offered in production. */
  readonly canRedesign: boolean;
  /** editSpec's design-choice rule, for states before production. */
  readonly choice: RedesignChoice;
  readonly departments?: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly effectiveDepartmentId?: string | null;
  readonly action: ChangeRequestAction;
}

function RadioOption({
  id,
  name,
  value,
  label,
  checked,
  onSelect,
}: {
  id: string;
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-xs"
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        required
        checked={checked}
        onChange={onSelect}
      />
      <span>{label}</span>
    </label>
  );
}

export function AdminOverrideForm({
  workItemId,
  orderId,
  expectedVersion,
  currentSpec,
  inProduction,
  canRedesign,
  choice,
  departments,
  effectiveDepartmentId,
  action,
}: AdminOverrideFormProps) {
  const [outcome, setOutcome] = useState<
    "CONTINUE_PRODUCTION" | "REDESIGN" | null
  >(null);
  const [designChoice, setDesignChoice] = useState<
    "KEEP_DESIGN" | "REDESIGN" | null
  >(null);

  // Send only the fields that differ from the rendered specification.
  const submitAction = async (
    prevState: EditSpecActionResult | null,
    formData: FormData,
  ) => {
    const outgoing = new FormData();
    outgoing.set("workItemId", workItemId);
    outgoing.set("orderId", orderId);
    outgoing.set("expectedVersion", String(expectedVersion));
    const reason = formData.get("reason");
    outgoing.set("reason", typeof reason === "string" ? reason.trim() : "");
    for (const key of ["outcome", "designChoice", "originDepartmentId"]) {
      const value = formData.get(key);
      if (typeof value === "string" && value !== "") outgoing.set(key, value);
    }
    copyChangedSpecFields(formData, currentSpec, outgoing);
    return action(prevState, outgoing);
  };

  const [state, formAction, isPending] = useActionState(submitAction, null);
  const id = (field: string) => `${workItemId}-ov-${field}`;

  return (
    <details
      className="mt-3 rounded-md border border-amber-300 p-3 dark:border-amber-900"
      data-testid="admin-override-section"
    >
      <summary className="cursor-pointer text-sm font-medium text-amber-900 dark:text-amber-300">
        {O.triggerButton}
      </summary>
      <p className="text-muted-foreground mt-2 text-xs">
        {inProduction ? O.productionNotice : O.notice}
      </p>

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        {state?.error && (
          <div
            className="bg-destructive/10 text-destructive rounded p-2 text-xs"
            role="alert"
            data-testid="admin-override-error"
          >
            {state.error}
          </div>
        )}
        {state?.success && (
          <div
            className="rounded bg-emerald-100 p-2 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            role="status"
            data-testid="admin-override-success"
          >
            {O.successMessage}
          </div>
        )}

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
            {O.reasonLabel}
          </label>
          <textarea
            id={id("reason")}
            name="reason"
            required
            rows={2}
            placeholder={O.reasonPlaceholder}
            className={inputCls}
          />
        </div>

        {inProduction && (
          <fieldset
            className="border-border/80 bg-muted/20 rounded border p-3"
            data-testid="override-outcome-section"
          >
            <legend className="text-foreground px-1 text-xs font-semibold">
              {O.outcomeHeading}
            </legend>
            <div className="flex flex-col gap-2">
              <RadioOption
                id={id("outcome-continue")}
                name="outcome"
                value="CONTINUE_PRODUCTION"
                label={O.continueProductionLabel}
                checked={outcome === "CONTINUE_PRODUCTION"}
                onSelect={() => setOutcome("CONTINUE_PRODUCTION")}
              />
              {canRedesign && (
                <RadioOption
                  id={id("outcome-redesign")}
                  name="outcome"
                  value="REDESIGN"
                  label={O.redesignLabel}
                  checked={outcome === "REDESIGN"}
                  onSelect={() => setOutcome("REDESIGN")}
                />
              )}
            </div>
          </fieldset>
        )}

        {!inProduction && choice === "REQUIRED" && (
          <fieldset
            className="border-border/80 bg-muted/20 rounded border p-3"
            data-testid="override-design-choice-section"
          >
            <legend className="text-foreground px-1 text-xs font-semibold">
              {E.designChoiceHeading}
            </legend>
            <div className="flex flex-col gap-2">
              <RadioOption
                id={id("designChoice-keep")}
                name="designChoice"
                value="KEEP_DESIGN"
                label={E.keepDesignLabel}
                checked={designChoice === "KEEP_DESIGN"}
                onSelect={() => setDesignChoice("KEEP_DESIGN")}
              />
              <RadioOption
                id={id("designChoice-redesign")}
                name="designChoice"
                value="REDESIGN"
                label={E.redesignLabel}
                checked={designChoice === "REDESIGN"}
                onSelect={() => setDesignChoice("REDESIGN")}
              />
            </div>

            {designChoice === "REDESIGN" && !effectiveDepartmentId && (
              <div className="mt-3 flex flex-col gap-1">
                <label
                  htmlFor={id("originDepartmentId")}
                  className="text-muted-foreground text-xs"
                >
                  {E.originDepartmentLabel}
                </label>
                <select
                  id={id("originDepartmentId")}
                  name="originDepartmentId"
                  required
                  className={inputCls}
                >
                  <option value="">{E.originDepartmentPlaceholder}</option>
                  {(departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>
        )}

        <div>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isPending}
          >
            {isPending ? O.submittingButton : O.submitButton}
          </Button>
        </div>
      </form>
    </details>
  );
}
