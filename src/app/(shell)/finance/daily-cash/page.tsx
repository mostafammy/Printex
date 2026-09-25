// Daily cash route — 052-finance US7 (T052). finance.view required.

import { authorize, getActor } from "~/server/auth";
import { dailyCashSummary, todayShopLocalDate } from "~/server/finance";
import { DailyCashSummary } from "~/components/finance/daily-cash-summary";
import ar from "~/messages/ar.json";

type Search = Record<string, string | string[] | undefined>;

export default async function DailyCashPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const actor = await getActor();
  authorize(actor, "finance.view");
  const params = await searchParams;
  const requested = typeof params.date === "string" && params.date ? params.date : null;
  const date = requested ?? (await todayShopLocalDate());
  const summary = await dailyCashSummary(date);

  return (
    <div className="flex flex-col gap-6">
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">{ar.ui.finance.expenseDate}</span>
          <input
            name="date"
            type="date"
            defaultValue={date}
            className="rounded-md border border-input bg-background px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
          ✓
        </button>
      </form>

      <DailyCashSummary summary={summary} />
    </div>
  );
}
