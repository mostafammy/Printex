"use client";

// direct-edit-spec-form.tsx — Interactive client form for DIRECT specification editing.
// tasks.md T038, contracts/change-control.md §editSpec.
// "use client" component: renders ONLY the direct edit form. Notice cards (CHANGE_REQUEST, ADMIN_ONLY, LOCKED)
// are rendered by the parent Server Component (edit-spec-form.tsx).

import { useState, useActionState } from "react";
import type { RedesignChoice, SpecSnapshot } from "~/server/changes";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";
import type { EditSpecActionResult } from "./change-error-messages";

const E = ar.changes.edit;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface DirectEditSpecFormProps {
  readonly workItemId: string;
  readonly orderId: string;
  readonly choice: RedesignChoice;
  readonly expectedVersion: number;
  readonly currentSpec: SpecSnapshot;
  readonly departments?: readonly { readonly id: string; readonly name: string }[];
  readonly effectiveDepartmentId?: string | null;
  readonly action: (
    prevState: EditSpecActionResult | null,
    formData: FormData,
  ) => Promise<EditSpecActionResult>;
}

export function DirectEditSpecForm({
  workItemId,
  orderId,
  choice,
  expectedVersion,
  currentSpec,
  departments,
  effectiveDepartmentId,
  action,
}: DirectEditSpecFormProps) {
  // M3: Explicit choice required; no default.
  const [selectedChoice, setSelectedChoice] = useState<"KEEP_DESIGN" | "REDESIGN" | null>(null);

  // M4: Action wrapper that sends ONLY fields whose submitted value differs from rendered currentSpec.
  const submitAction = async (prevState: EditSpecActionResult | null, formData: FormData) => {
    const outgoing = new FormData();
    const rawWorkItemId = formData.get("workItemId");
    outgoing.set("workItemId", typeof rawWorkItemId === "string" ? rawWorkItemId : workItemId);

    const rawOrderId = formData.get("orderId");
    outgoing.set("orderId", typeof rawOrderId === "string" ? rawOrderId : orderId);

    const rawExpectedVersion = formData.get("expectedVersion");
    outgoing.set(
      "expectedVersion",
      typeof rawExpectedVersion === "string" ? rawExpectedVersion : String(expectedVersion),
    );

    const reason = formData.get("reason");
    if (typeof reason === "string" && reason.trim() !== "") {
      outgoing.set("reason", reason.trim());
    }

    const designChoice = formData.get("designChoice");
    if (typeof designChoice === "string" && designChoice !== "") {
      outgoing.set("designChoice", designChoice);
    }

    const originDept = formData.get("originDepartmentId");
    if (typeof originDept === "string" && originDept !== "") {
      outgoing.set("originDepartmentId", originDept);
    }

    const norm = (v: FormDataEntryValue | null): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t === "" ? null : t;
    };

    // 1. quantity: compare number vs number
    const submittedQtyStr = norm(formData.get("quantity"));
    const submittedQty = submittedQtyStr !== null ? Number(submittedQtyStr) : null;
    const currentQty = currentSpec.quantity ?? null;
    if (submittedQty !== currentQty) {
      outgoing.set("quantity", submittedQtyStr ?? "");
    }

    // 2. widthValue: compare decimal values
    const submittedWidth = norm(formData.get("widthValue"));
    const currentWidth = currentSpec.widthValue ?? null;
    const widthDiffers = (() => {
      if (submittedWidth === currentWidth) return false;
      if (submittedWidth === null || currentWidth === null) return true;
      const numSubmitted = Number(submittedWidth);
      const numCurrent = Number(currentWidth);
      if (Number.isFinite(numSubmitted) && Number.isFinite(numCurrent)) {
        return numSubmitted !== numCurrent;
      }
      return submittedWidth !== currentWidth;
    })();
    if (widthDiffers) {
      outgoing.set("widthValue", submittedWidth ?? "");
    }

    // 3. heightValue: compare decimal values
    const submittedHeight = norm(formData.get("heightValue"));
    const currentHeight = currentSpec.heightValue ?? null;
    const heightDiffers = (() => {
      if (submittedHeight === currentHeight) return false;
      if (submittedHeight === null || currentHeight === null) return true;
      const numSubmitted = Number(submittedHeight);
      const numCurrent = Number(currentHeight);
      if (Number.isFinite(numSubmitted) && Number.isFinite(numCurrent)) {
        return numSubmitted !== numCurrent;
      }
      return submittedHeight !== currentHeight;
    })();
    if (heightDiffers) {
      outgoing.set("heightValue", submittedHeight ?? "");
    }

    // 4. dimensionUnit: compare string vs string
    const submittedUnit = norm(formData.get("dimensionUnit"));
    const currentUnit = currentSpec.dimensionUnit ?? null;
    if (submittedUnit !== currentUnit) {
      outgoing.set("dimensionUnit", submittedUnit ?? "");
    }

    // 5. material: compare string vs string
    const submittedMaterial = norm(formData.get("material"));
    const currentMaterial = currentSpec.material ?? null;
    if (submittedMaterial !== currentMaterial) {
      outgoing.set("material", submittedMaterial ?? "");
    }

    // 6. description: compare string vs string
    const submittedDesc = norm(formData.get("description"));
    const currentDesc = currentSpec.description ?? null;
    if (submittedDesc !== currentDesc) {
      outgoing.set("description", submittedDesc ?? "");
    }

    // 7. finishNotes: compare string vs string
    const submittedFinish = norm(formData.get("finishNotes"));
    const currentFinish = currentSpec.finishNotes ?? null;
    if (submittedFinish !== currentFinish) {
      outgoing.set("finishNotes", submittedFinish ?? "");
    }

    return action(prevState, outgoing);
  };

  const [formState, formAction, isPending] = useActionState(submitAction, null);

  return (
    <details className="mt-3 rounded-md border border-border p-3" data-testid="edit-spec-section">
      <summary className="cursor-pointer text-sm font-medium text-primary">
        {E.triggerButton}
      </summary>

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="workItemId" value={workItemId} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        {formState?.error && (
          <div
            className="rounded bg-destructive/10 p-2 text-xs text-destructive"
            role="alert"
            data-testid="edit-spec-error"
          >
            {formState.error}
          </div>
        )}

        {formState?.success && (
          <div
            className="rounded bg-emerald-100 p-2 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            role="status"
            data-testid="edit-spec-success"
          >
            {E.successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${workItemId}-quantity`} className="text-xs text-muted-foreground">
              {E.quantityLabel}
            </label>
            <input
              id={`${workItemId}-quantity`}
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={currentSpec.quantity ?? ""}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${workItemId}-widthValue`} className="text-xs text-muted-foreground">
              {E.widthLabel}
            </label>
            <input
              id={`${workItemId}-widthValue`}
              name="widthValue"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={currentSpec.widthValue ? String(currentSpec.widthValue) : ""}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${workItemId}-heightValue`} className="text-xs text-muted-foreground">
              {E.heightLabel}
            </label>
            <input
              id={`${workItemId}-heightValue`}
              name="heightValue"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={currentSpec.heightValue ? String(currentSpec.heightValue) : ""}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${workItemId}-dimensionUnit`} className="text-xs text-muted-foreground">
              {E.dimensionUnitLabel}
            </label>
            <select
              id={`${workItemId}-dimensionUnit`}
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
            <label htmlFor={`${workItemId}-material`} className="text-xs text-muted-foreground">
              {E.materialLabel}
            </label>
            <input
              id={`${workItemId}-material`}
              name="material"
              type="text"
              defaultValue={currentSpec.material ?? ""}
              placeholder={E.materialPlaceholder}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${workItemId}-description`} className="text-xs text-muted-foreground">
              {E.descriptionLabel}
            </label>
            <input
              id={`${workItemId}-description`}
              name="description"
              type="text"
              defaultValue={currentSpec.description ?? ""}
              placeholder={E.descriptionPlaceholder}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${workItemId}-finishNotes`} className="text-xs text-muted-foreground">
            {E.finishNotesLabel}
          </label>
          <input
            id={`${workItemId}-finishNotes`}
            name="finishNotes"
            type="text"
            defaultValue={currentSpec.finishNotes ?? ""}
            placeholder={E.finishNotesPlaceholder}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${workItemId}-reason`} className="text-xs text-muted-foreground">
            {E.reasonLabel}
          </label>
          <input
            id={`${workItemId}-reason`}
            name="reason"
            type="text"
            placeholder={E.reasonPlaceholder}
            className={inputCls}
          />
        </div>

        {/* Redesign choice radio when REQUIRED */}
        {choice === "REQUIRED" && (
          <div
            className="rounded border border-border/80 bg-muted/20 p-3"
            data-testid="redesign-choice-section"
          >
            <div className="mb-2 text-xs font-semibold text-foreground">
              {E.designChoiceHeading}
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor={`${workItemId}-designChoice-keep`}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <input
                  id={`${workItemId}-designChoice-keep`}
                  type="radio"
                  name="designChoice"
                  value="KEEP_DESIGN"
                  required
                  checked={selectedChoice === "KEEP_DESIGN"}
                  onChange={() => setSelectedChoice("KEEP_DESIGN")}
                />
                <span>{E.keepDesignLabel}</span>
              </label>
              <label
                htmlFor={`${workItemId}-designChoice-redesign`}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <input
                  id={`${workItemId}-designChoice-redesign`}
                  type="radio"
                  name="designChoice"
                  value="REDESIGN"
                  required
                  checked={selectedChoice === "REDESIGN"}
                  onChange={() => setSelectedChoice("REDESIGN")}
                />
                <span>{E.redesignLabel}</span>
              </label>
            </div>

            {selectedChoice === "REDESIGN" && !effectiveDepartmentId && (
              <div className="mt-3 flex flex-col gap-1">
                <label
                  htmlFor={`${workItemId}-originDepartmentId`}
                  className="text-xs text-muted-foreground"
                >
                  {E.originDepartmentLabel}
                </label>
                <select
                  id={`${workItemId}-originDepartmentId`}
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
          </div>
        )}

        <div>
          <Button type="submit" variant="default" size="sm" disabled={isPending}>
            {isPending ? E.savingButton : E.saveButton}
          </Button>
        </div>
      </form>
    </details>
  );
}
