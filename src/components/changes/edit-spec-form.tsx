// edit-spec-form.tsx — Server Component for Work Item specification editing.
// tasks.md T038, contracts/change-control.md §editSpec.
// Server Component: renders notices (CHANGE_REQUEST, ADMIN_ONLY, LOCKED) on the server,
// and delegates to the client-only DirectEditSpecForm for interactive direct editing.

import type { SpecEditPolicy, RedesignChoice, SpecSnapshot } from "~/server/changes";
import ar from "~/messages/ar.json";
import { DirectEditSpecForm } from "./direct-edit-spec-form";
import {
  RequestChangeForm,
  WithdrawChangeRequestForm,
  type ChangeRequestAction,
} from "./request-change-form";
import type { EditSpecActionResult } from "./change-error-messages";

export { getChangeErrorMessage } from "./change-error-messages";
export type { EditSpecActionResult } from "./change-error-messages";

const E = ar.changes.edit;

export interface EditSpecFormProps {
  readonly workItemId: string;
  readonly orderId: string;
  readonly policy: SpecEditPolicy;
  readonly choice: RedesignChoice;
  readonly expectedVersion: number;
  readonly canEdit: boolean;
  readonly currentSpec: SpecSnapshot;
  readonly departments?: readonly { readonly id: string; readonly name: string }[];
  readonly effectiveDepartmentId?: string | null;
  readonly action: (
    prevState: EditSpecActionResult | null,
    formData: FormData,
  ) => Promise<EditSpecActionResult>;
  /** US3: change-request wiring for the CHANGE_REQUEST policy (IN_PRODUCTION). */
  readonly changeRequest?: {
    readonly pendingId: string | null;
    readonly requestAction: ChangeRequestAction;
    readonly withdrawAction: ChangeRequestAction;
  };
}

export function EditSpecForm({
  workItemId,
  orderId,
  policy,
  choice,
  expectedVersion,
  canEdit,
  currentSpec,
  departments,
  effectiveDepartmentId,
  action,
  changeRequest,
}: EditSpecFormProps) {
  // 1. CHANGE_REQUEST state (IN_PRODUCTION): a pending request can be
  // withdrawn; otherwise a new one can be raised (US3, T051).
  if (policy === "CHANGE_REQUEST") {
    if (!canEdit || !changeRequest) {
      return (
        <div className="mt-3 text-xs text-muted-foreground" data-testid="change-request-section">
          {E.requestChangeNotice}
        </div>
      );
    }
    if (changeRequest.pendingId) {
      return (
        <WithdrawChangeRequestForm
          changeRequestId={changeRequest.pendingId}
          orderId={orderId}
          action={changeRequest.withdrawAction}
        />
      );
    }
    return (
      <RequestChangeForm
        workItemId={workItemId}
        orderId={orderId}
        currentSpec={currentSpec}
        action={changeRequest.requestAction}
      />
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

  // 5. DIRECT policy with permission: Render client-side interactive edit form
  return (
    <DirectEditSpecForm
      workItemId={workItemId}
      orderId={orderId}
      choice={choice}
      expectedVersion={expectedVersion}
      currentSpec={currentSpec}
      departments={departments}
      effectiveDepartmentId={effectiveDepartmentId}
      action={action}
    />
  );
}
