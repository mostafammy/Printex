"use client";

/**
 * CancelSheet: captures cancellation reason for *any* → CANCELLED.
 * (FR-015, research.md R3, plan.md S1)
 */

import { useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

export interface CancelSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function ReasonInput({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="cancel-reason">
        سبب الإلغاء <span className="text-red-500">*</span>
      </label>
      <textarea
        id="cancel-reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={5}
        rows={3}
        placeholder="اشرح سبب إلغاء الطلب..."
        className="resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
      />
    </div>
  );
}

export function CancelSheet({ request, onConfirm, onCancel }: CancelSheetProps) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= 5;
  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); if (canSubmit) onConfirm({ reason: reason.trim() }); };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" dir="rtl">
      <div>
        <h2 className="text-base font-semibold text-red-700">إلغاء الطلب — {request.card.title}</h2>
        <p className="text-sm text-gray-600">هذا الإجراء لا يمكن التراجع عنه.</p>
      </div>
      <ReasonInput value={reason} onChange={setReason} />
      <div className="flex justify-start gap-2 pt-1">
        <button type="submit" disabled={!canSubmit} className="rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800 disabled:opacity-40">
          تأكيد الإلغاء
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          العودة
        </button>
      </div>
    </form>
  );
}
