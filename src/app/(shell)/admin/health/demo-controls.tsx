"use client";

// Demo data controls for /admin/health.
//
// Client component only because both actions are long-running (they block on a
// child process driving several hundred SQL statements against a remote pooler)
// and the user needs a pending state plus a confirmation step. The
// authorization is NOT here — it is enforced inside the service behind both
// server actions, so hiding these buttons is presentation, not the control.
//
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-).

import { useState, useTransition } from "react";
import { Eraser, DatabaseZap, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "~/components/ui/alert";
import {
  purgeDemoDataAction,
  reseedDemoDataAction,
  type DemoActionState,
} from "./actions";
import ar from "~/messages/ar.json";

const S = ar.ui;

type PendingAction = "purge" | "reseed" | null;

interface PendingActionCopy {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
}

const CONFIRM_COPY: Record<Exclude<PendingAction, null>, PendingActionCopy> = {
  purge: {
    title: S.demoPurgeConfirmTitle,
    body: S.demoPurgeConfirmBody,
    confirmLabel: S.demoPurgeButton,
  },
  reseed: {
    title: S.demoReseedConfirmTitle,
    body: S.demoReseedConfirmBody,
    confirmLabel: S.demoReseedButton,
  },
};

export default function DemoControls() {
  // `confirming` is the action awaiting confirmation in the dialog; `running`
  // is the one currently executing. Two separate pieces of state on purpose —
  // the dialog closes before the request starts, so a single flag would leave
  // the spinner pointing at the wrong button (or at nothing at all).
  const [confirming, setConfirming] = useState<PendingAction>(null);
  const [running, setRunning] = useState<PendingAction>(null);
  const [state, setState] = useState<DemoActionState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function requestDemoAction(action: Exclude<PendingAction, null>) {
    setState({ status: "idle" });
    setConfirming(action);
  }

  function cancel() {
    setConfirming(null);
  }

  function confirm() {
    const action = confirming;
    if (!action) return;
    setConfirming(null);
    setRunning(action);

    startTransition(async () => {
      const result =
        action === "purge"
          ? await purgeDemoDataAction()
          : await reseedDemoDataAction();
      setRunning(null);
      setState(result);
    });
  }

  const busy = isPending && running !== null;

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-xs p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <DatabaseZap className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-foreground">{S.demoControlsHeading}</h2>
            <p className="text-xs text-muted-foreground">{S.demoControlsDescription}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => requestDemoAction("purge")}
        >
          {busy && running === "purge" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eraser className="h-3.5 w-3.5" />
          )}
          <span>{S.demoPurgeButton}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => requestDemoAction("reseed")}
        >
          {busy && running === "reseed" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <DatabaseZap className="h-3.5 w-3.5" />
          )}
          <span>{S.demoReseedButton}</span>
        </Button>

        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 text-destructive" />
          <span>{S.demoControlsWarning}</span>
        </span>
      </div>

      {state.status !== "idle" && (
        <div className="mt-5">
          <Alert
            variant={state.status === "ok" ? "success" : "destructive"}
            appearance="light"
            size="sm"
          >
            <AlertIcon>
              {state.status === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </AlertIcon>
            <div className="flex flex-col gap-0.5">
              <AlertTitle>
                {state.status === "ok" ? "تم" : "تعذّر التنفيذ"}
              </AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
              {state.result && <DemoResultCounts result={state.result} />}
            </div>
          </Alert>
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <h3 id="demo-confirm-title" className="pt-1 text-sm font-bold text-foreground">
                {CONFIRM_COPY[confirming].title}
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {CONFIRM_COPY[confirming].body}
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                إلغاء
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={confirm}>
                {CONFIRM_COPY[confirming].confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Before/after counts, so the admin sees the size of what just happened. */
function DemoResultCounts({ result }: { result: NonNullable<DemoActionState["result"]> }) {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["الطلبات", "orders"],
    ["عناصر العمل", "workItems"],
    ["المدفوعات", "payments"],
    ["المصروفات", "expenses"],
  ];

  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
      {rows.map(([label, key]) => {
        const before = result.before?.[key];
        const after = result.after[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-1">
            <dt>{label}:</dt>
            <dd className="font-mono font-semibold text-foreground">
              {before === undefined ? after : `${before} ← ${after}`}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
