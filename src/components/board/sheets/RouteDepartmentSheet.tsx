"use client";

/**
 * RouteDepartmentSheet: captures department for READY_FOR_PRODUCTION → IN_PRODUCTION (unrouted jobs).
 * (FR-015, research.md R3, plan.md S1)
 */

import { useEffect, useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

interface Department {
  readonly id: string;
  readonly name: string;
}

export interface RouteDepartmentSheetProps {
  readonly request: SheetRequest;
  readonly fetchDepartments: () => Promise<Department[]>;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function DepartmentSelect({
  departments,
  selectedId,
  loading,
  onChange,
}: {
  readonly departments: readonly Department[];
  readonly selectedId: string;
  readonly loading: boolean;
  readonly onChange: (id: string) => void;
}) {
  if (loading) return <p className="text-sm text-gray-500">جاري التحميل...</p>;
  return (
    <select
      id="route-dept"
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      required
      className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
    >
      <option value="">اختر القسم...</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );
}

export function RouteDepartmentSheet({ request, fetchDepartments, onConfirm, onCancel }: RouteDepartmentSheetProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchDepartments()
      .then((list) => { if (mounted) { setDepartments(list); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [fetchDepartments]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (departmentId) onConfirm({ departmentId }); }} className="flex flex-col gap-4" dir="rtl">
      <h2 className="text-base font-semibold">توجيه للقسم — {request.card.title}</h2>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="route-dept">القسم <span className="text-red-500">*</span></label>
        <DepartmentSelect departments={departments} selectedId={departmentId} loading={loading} onChange={setDepartmentId} />
      </div>
      <div className="flex justify-start gap-2 pt-1">
        <button type="submit" disabled={!departmentId || loading} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
          توجيه
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          إلغاء
        </button>
      </div>
    </form>
  );
}
