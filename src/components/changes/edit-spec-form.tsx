"use client";

// edit-spec-form.tsx — Component for editing Work Item specifications.
// tasks.md T038, contracts/change-control.md §editSpec.

import { useState, useActionState } from "react";
import type { WorkItemState } from "~/server/core";
import { specEditPolicy, redesignChoice } from "~/server/changes";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const E = ar.changes.edit;
const ERRORS: Record<string, string> = ar.changes.errors;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface EditSpecActionResult {
  ok: boolean;
  error?: string;
  success?: boolean;
}

export interface EditSpecFormProps {
  readonly workItemId: string;
  readonly orderId: string;
  readonly state: WorkItemState;
  readonly requiresDesign: boolean;
  readonly expectedVersion: number;
  readonly canEdit: boolean;
  readonly currentSpec: {
    readonly description?: string | null;
    readonly quantity?: number | null;
    readonly widthValue?: string | number | null;
    readonly heightValue?: string | number | null;
    readonly dimensionUnit?: string | null;
    readonly material?: string | null;
    readonly finishNotes?: string | null;
    readonly productTypeId?: string | null;
  };
  readonly departments?: readonly { readonly id: string; readonly name: string }[];
  readonly effectiveDepartmentId?: string | null;
  readonly action: (
    prevState: EditSpecActionResult | null,
    formData: FormData,
  ) => Promise<EditSpecActionResult>;
}

export function EditSpecForm({
  workItemId,
  orderId,
  state,
  requiresDesign,
  expectedVersion,
  canEdit,
  currentSpec,
  departments,
  effectiveDepartmentId,
  action,
}: EditSpecFormProps) {
  const policy = specEditPolicy(state);
  const choice = redesignChoice(state, requiresDesign);
  const [selectedChoice, setSelectedChoice] = useState<"KEEP_DESIGN" | "REDESIGN">("KEEP_DESIGN");

  const [formState, formAction, isPending] = useActionState(action, null);

  // 1. CHANGE_REQUEST state (e.g. IN_PRODUCTION)
  if (policy === "CHANGE_REQUEST") {
    return (
      <div className="mt-3 flex items-center gap-2" data-testid="change-request-section">
        {/* Disabled placeholder for change request — to be wired in User Story 3 (Phase 5, T039-T042) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title={E.requestChangeDisabledTooltip}
        >
          {E.requestChangeButton}
        </Button>
        <span className="text-xs text-muted-foreground">{E.requestChangeNotice}</span>
      </div>
    );
  }

  // 2. ADMIN_ONLY state (e.g. PRODUCTION_COMPLETED..COMPLETED)
  if (policy === "ADMIN_ONLY") {
    return (
      <div className="mt-3 text-xs text-muted-foreground" data-testid="admin-only-notice">
        {E.adminOnlyNotice}
      </div>
    );
  }

  // 3. LOCKED state (CANCELLED)
  if (policy === "LOCKED") {
    return (
      <div className="mt-3 text-xs text-muted-foreground" data-testid="locked-notice">
        {E.lockedNotice}
      </div>
    );
  }

  // 4. DIRECT policy, but user lacks order.edit permission
  if (!canEdit) {
    return null;
  }

  // 5. DIRECT policy with permission: Render collapsible edit form
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
            <label className="text-xs text-muted-foreground">{E.quantityLabel}</label>
            <input
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={currentSpec.quantity ?? ""}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{E.widthLabel}</label>
            <input
              name="widthValue"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={currentSpec.widthValue ? String(currentSpec.widthValue) : ""}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{E.heightLabel}</label>
            <input
              name="heightValue"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={currentSpec.heightValue ? String(currentSpec.heightValue) : ""}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{E.dimensionUnitLabel}</label>
            <select
              name="dimensionUnit"
              defaultValue={currentSpec.dimensionUnit ?? "CM"}
              className={inputCls}
            >
              <option value="MM">MM</option>
              <option value="CM">CM</option>
              <option value="M">M</option>
              <option value="IN">IN</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{E.materialLabel}</label>
            <input
              name="material"
              type="text"
              defaultValue={currentSpec.material ?? ""}
              placeholder={E.materialPlaceholder}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{E.descriptionLabel}</label>
            <input
              name="description"
              type="text"
              defaultValue={currentSpec.description ?? ""}
              placeholder={E.descriptionPlaceholder}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{E.finishNotesLabel}</label>
          <input
            name="finishNotes"
            type="text"
            defaultValue={currentSpec.finishNotes ?? ""}
            placeholder={E.finishNotesPlaceholder}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{E.reasonLabel}</label>
          <input
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
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="designChoice"
                  value="KEEP_DESIGN"
                  checked={selectedChoice === "KEEP_DESIGN"}
                  onChange={() => setSelectedChoice("KEEP_DESIGN")}
                />
                <span>{E.keepDesignLabel}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="designChoice"
                  value="REDESIGN"
                  checked={selectedChoice === "REDESIGN"}
                  onChange={() => setSelectedChoice("REDESIGN")}
                />
                <span>{E.redesignLabel}</span>
              </label>
            </div>

            {selectedChoice === "REDESIGN" && !effectiveDepartmentId && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  {E.originDepartmentLabel}
                </label>
                <select name="originDepartmentId" required className={inputCls}>
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

/**
 * Maps a ChangeResult error code to its Arabic user-facing message.
 */
export function getChangeErrorMessage(code: string): string {
  return ERRORS[code] ?? ERRORS.UNKNOWN ?? "حدث خطأ غير متوقع";
}
