"use server";

// Server actions for the two demo-data buttons on /admin/health.
//
// Like the admin notification actions, this layer only shapes the call and maps
// errors to Arabic copy — the permission check lives inside the service
// (`authorize(actor, "admin.config")` in ~/server/admin/demo), because a check
// that existed only here would be bypassable by calling the service directly.

import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import {
  DemoToolError,
  purgeDemoData,
  reseedDemoData,
  type DemoRunResult,
} from "~/server/admin/demo";
import ar from "~/messages/ar.json";

const N = ar.ui;

export interface DemoActionState {
  readonly status: "idle" | "ok" | "error";
  /** Arabic, safe to render directly (constitution IX — no English leaking). */
  readonly message?: string;
  readonly result?: DemoRunResult;
}

/**
 * The service already invalidates the affected routes; this second
 * `revalidatePath` refreshes the admin page itself so the KPI numbers on screen
 * match what was just done.
 */
function finish(state: DemoActionState): DemoActionState {
  revalidatePath("/admin/health");
  return state;
}

export async function purgeDemoDataAction(): Promise<DemoActionState> {
  try {
    const actor = await getActor();
    const result = await purgeDemoData(actor);
    return finish({
      status: "ok",
      message: N.demoPurgeSuccess,
      result,
    });
  } catch (error) {
    return finish({
      status: "error",
      message:
        error instanceof DemoToolError ? error.message : N.demoPurgeFailed,
    });
  }
}

export async function reseedDemoDataAction(): Promise<DemoActionState> {
  try {
    const actor = await getActor();
    const result = await reseedDemoData(actor);
    return finish({
      status: "ok",
      message: N.demoReseedSuccess,
      result,
    });
  } catch (error) {
    return finish({
      status: "error",
      message:
        error instanceof DemoToolError ? error.message : N.demoReseedFailed,
    });
  }
}
