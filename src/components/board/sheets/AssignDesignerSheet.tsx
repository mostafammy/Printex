"use client";

/**
 * AssignDesignerSheet: picks a designer for NEW → ASSIGNED or REWORK_REQUIRED → ASSIGNED.
 * (FR-015, research.md R3, plan.md S1)
 */

import { useEffect, useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";
import {
  type EligibleDesigner,
  DesignerSelect,
  ReassignReasonField,
} from "./AssignDesignerFields";

export type { EligibleDesigner };

export interface AssignDesignerSheetProps {
  readonly request: SheetRequest;
  readonly fetchDesigners: (workItemId: string) => Promise<EligibleDesigner[]>;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function useDesignerList(workItemId: string, fetcher: (id: string) => Promise<EligibleDesigner[]>) {
  const [designers, setDesigners] = useState<EligibleDesigner[]>([]);
  const [designerId, setDesignerId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetcher(workItemId)
      .then((list) => {
        if (!mounted) return;
        setDesigners(list);
        setLoading(false);
        const suggested = list.find((d) => d.isSuggested) ?? list[0];
        if (suggested) setDesignerId(suggested.id);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [workItemId, fetcher]);

  return { designers, designerId, setDesignerId, loading };
}

function AssignActions({
  isReassignment,
  disabled,
  onCancel,
}: {
  readonly isReassignment: boolean;
  readonly disabled: boolean;
  readonly onCancel: () => void;
}) {
  return (
    <div className="flex justify-start gap-2 pt-1">
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {isReassignment ? "تأكيد إعادة التعيين" : "تعيين"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
      >
        إلغاء
      </button>
    </div>
  );
}

function DesignerPicker({
  designers,
  designerId,
  loading,
  setDesignerId,
}: {
  readonly designers: readonly EligibleDesigner[];
  readonly designerId: string;
  readonly loading: boolean;
  readonly setDesignerId: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="assign-designer">
        المصمم <span className="text-red-500">*</span>
      </label>
      <DesignerSelect
        designers={designers}
        selectedId={designerId}
        loading={loading}
        onChange={setDesignerId}
      />
    </div>
  );
}

export function AssignDesignerSheet({
  request,
  fetchDesigners,
  onConfirm,
  onCancel,
}: AssignDesignerSheetProps) {
  const { designers, designerId, setDesignerId, loading } = useDesignerList(
    request.card.id,
    fetchDesigners,
  );
  const [reason, setReason] = useState("");
  const isReassignment = Boolean(request.card.assignee?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!designerId) return;
    onConfirm({ designerId, ...(reason.trim() ? { reason: reason.trim() } : {}) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" dir="rtl">
      <h2 className="text-base font-semibold">
        {isReassignment ? "إعادة تعيين مصمم" : "تعيين مصمم"} — {request.card.title}
      </h2>
      <DesignerPicker
        designers={designers}
        designerId={designerId}
        loading={loading}
        setDesignerId={setDesignerId}
      />
      {isReassignment && <ReassignReasonField value={reason} onChange={setReason} />}
      <AssignActions
        isReassignment={isReassignment}
        disabled={!designerId || loading || (isReassignment && !reason.trim())}
        onCancel={onCancel}
      />
    </form>
  );
}
