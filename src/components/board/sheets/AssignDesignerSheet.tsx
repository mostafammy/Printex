"use client";

/**
 * AssignDesignerSheet: picks a designer for NEW → ASSIGNED or REWORK_REQUIRED → ASSIGNED.
 * (FR-015, research.md R3, plan.md S1)
 */

import { useEffect, useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

interface EligibleDesigner {
  readonly id: string;
  readonly name: string;
  readonly activeCount: number;
}

export interface AssignDesignerSheetProps {
  readonly request: SheetRequest;
  readonly fetchDesigners: (workItemId: string) => Promise<EligibleDesigner[]>;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function DesignerSelect({
  designers,
  selectedId,
  loading,
  onChange,
}: {
  readonly designers: readonly EligibleDesigner[];
  readonly selectedId: string;
  readonly loading: boolean;
  readonly onChange: (id: string) => void;
}) {
  if (loading) return <p className="text-sm text-gray-500">جاري التحميل...</p>;
  return (
    <select
      id="assign-designer"
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      required
      className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
    >
      <option value="">اختر المصمم...</option>
      {designers.map((d) => (
        <option key={d.id} value={d.id}>{d.name} ({d.activeCount} طلب نشط)</option>
      ))}
    </select>
  );
}

export function AssignDesignerSheet({ request, fetchDesigners, onConfirm, onCancel }: AssignDesignerSheetProps) {
  const [designers, setDesigners] = useState<EligibleDesigner[]>([]);
  const [designerId, setDesignerId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchDesigners(request.card.id)
      .then((list) => { if (mounted) { setDesigners(list); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [request.card.id, fetchDesigners]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (designerId) onConfirm({ designerId }); }} className="flex flex-col gap-4" dir="rtl">
      <h2 className="text-base font-semibold">تعيين مصمم — {request.card.title}</h2>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="assign-designer">المصمم <span className="text-red-500">*</span></label>
        <DesignerSelect designers={designers} selectedId={designerId} loading={loading} onChange={setDesignerId} />
      </div>
      <div className="flex justify-start gap-2 pt-1">
        <button type="submit" disabled={!designerId || loading} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
          تعيين
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          إلغاء
        </button>
      </div>
    </form>
  );
}
