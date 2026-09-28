"use client";

/**
 * SheetHost: lazy dialog host that renders the correct sheet for the current SheetManager request.
 * Uses a data-attribute-driven open/close pattern without imperative dialog refs.
 * Dynamic sheet rendering avoids bundling unused sheet code on first load.
 * (plan.md S1, S5, contracts/board-engine.md §Registries, US3)
 */

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";
import { useBoardController } from "./hooks/useBoardController";
import { useSheetRequest } from "./hooks/useSheetRequest";

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
      return <AssignDesignerSheet {...props} fetchDesigners={async () => []} />;
    case "complete-production":
      return <CompleteProductionSheet {...props} />;
    case "route-department":
      return <RouteDepartmentSheet {...props} fetchDepartments={async () => []} />;
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

  if (!request) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إجراء على الطلب"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          /* call cancel via SheetContent's cancel */
        }
      }}
    >
      <div className="w-full max-w-md rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-popover p-4 text-popover-foreground">
        <SheetContent request={request} />
      </div>
    </div>
  );
}
