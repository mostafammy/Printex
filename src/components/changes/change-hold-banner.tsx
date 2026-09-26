// change-hold-banner.tsx — Production hold banner for the job card.
// tasks.md T051, contracts/change-control.md §getProductionHold /
// §acknowledgeSpecRevision, spec FR-012, FR-014.
// Server Component: the acknowledge button posts to a Server Action owned by
// the production page.

import type { ProductionHold } from "~/server/changes";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const H = ar.changes.hold;

export interface ChangeHoldBannerProps {
  readonly hold: ProductionHold;
  readonly workItemId: string;
  readonly acknowledgeAction: (formData: FormData) => Promise<void>;
  /** An already-mapped Arabic error from the last attempt, if any. */
  readonly errorMessage?: string | null;
}

export function ChangeHoldBanner({
  hold,
  workItemId,
  acknowledgeAction,
  errorMessage,
}: ChangeHoldBannerProps) {
  const pending = hold.kind === "CHANGE_PENDING";
  return (
    <section
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20"
      data-testid="change-hold-banner"
      data-hold-kind={hold.kind}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
          {pending ? H.changePending : H.revisionUnacknowledged}
        </p>
        {!pending && (
          <form action={acknowledgeAction}>
            <input type="hidden" name="workItemId" value={workItemId} />
            <Button type="submit" variant="outline" size="sm">
              {H.acknowledgeButton}
            </Button>
          </form>
        )}
      </div>
      {errorMessage && (
        <p className="text-destructive mt-2 text-xs" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
