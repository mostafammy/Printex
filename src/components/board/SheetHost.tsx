"use client";

/**
 * SheetHost: lazy dialog host that renders the correct sheet for the current SheetManager request.
 * World-class Apple frosted glass modal container with backdrop blur, smooth entrance,
 * ambient highlights, click-outside dismissal, and keyboard Escape trapping.
 * (plan.md S1, S5, contracts/board-engine.md §Registries, US3)
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";
import { useBoardController } from "./hooks/useBoardController";
import { useSheetRequest } from "./hooks/useSheetRequest";

async function fetchDesigners(workItemId: string) {
  const { getEligibleDesignersAction } = await import("~/app/(shell)/board/actions");
  return getEligibleDesignersAction(workItemId);
}

async function fetchDepartments() {
  const { getDepartmentsAction } = await import("~/app/(shell)/board/actions");
  return getDepartmentsAction();
}

// Lazy-load sheet components to keep initial bundle small
const RejectDesignSheet = dynamic(
  () => import("./sheets/RejectDesignSheet").then((m) => ({ default: m.RejectDesignSheet })),
  { ssr: false },
);
const AssignDesignerSheet = dynamic(
  () => import("./sheets/AssignDesignerSheet").then((m) => ({ default: m.AssignDesignerSheet })),
  { ssr: false },
);
const CompleteProductionSheet = dynamic(
  () => import("./sheets/CompleteProductionSheet").then((m) => ({ default: m.CompleteProductionSheet })),
  { ssr: false },
);
const RouteDepartmentSheet = dynamic(
  () => import("./sheets/RouteDepartmentSheet").then((m) => ({ default: m.RouteDepartmentSheet })),
  { ssr: false },
);
const SendBackSheet = dynamic(
  () => import("./sheets/SendBackSheet").then((m) => ({ default: m.SendBackSheet })),
  { ssr: false },
);
const CancelSheet = dynamic(
  () => import("./sheets/CancelSheet").then((m) => ({ default: m.CancelSheet })),
  { ssr: false },
);

function SheetContent({ request }: { request: SheetRequest }) {
  const controller = useBoardController();
  const manager = controller.sheetManager;

  const confirm = useCallback(
    (input: Record<string, unknown>) => manager?.confirm(input),
    [manager],
  );
  const cancel = useCallback(() => manager?.cancel(), [manager]);

  const props = { request, onConfirm: confirm, onCancel: cancel };

  switch (request.sheetId) {
    case "reject-design":
      return <RejectDesignSheet {...props} />;
    case "assign-designer":
      return <AssignDesignerSheet {...props} fetchDesigners={fetchDesigners} />;
    case "complete-production":
      return <CompleteProductionSheet {...props} />;
    case "route-department":
      return <RouteDepartmentSheet {...props} fetchDepartments={fetchDepartments} />;
    case "send-back":
      return <SendBackSheet {...props} />;
    case "cancel":
      return <CancelSheet {...props} />;
    default:
      return null;
  }
}

export function SheetHost() {
  const request = useSheetRequest();
  const controller = useBoardController();

  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        controller.sheetManager?.cancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [request, controller]);

  if (!request) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إجراء على الطلب"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          controller.sheetManager?.cancel();
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl p-6 text-card-foreground shadow-2xl shadow-black/30 animate-in zoom-in-95 duration-200 overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent">
        <SheetContent request={request} />
      </div>
    </div>
  );
}
