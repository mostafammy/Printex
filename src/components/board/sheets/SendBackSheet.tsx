"use client";

/**
 * SendBackSheet: captures reason for IN_PRODUCTION → REWORK_REQUIRED (production send-back).
 * (FR-015, research.md R3, plan.md S1)
 */

import { useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

export interface SendBackSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function ReasonArea({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="send-back-reason">
        السبب <span className="text-red-500">*</span>
      </label>
      <textarea
        id="send-back-reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={5}
        rows={3}
        placeholder="اشرح سبب إعادة الطلب للتصميم..."
        className="resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
      />
    </div>
  );
}

export function SendBackSheet({ request, onConfirm, onCancel }: SendBackSheetProps) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= 5;
  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); if (canSubmit) onConfirm({ reason: reason.trim() }); };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" dir="rtl">
      <h2 className="text-base font-semibold">إعادة للتصميم — {request.card.title}</h2>
      <ReasonArea value={reason} onChange={setReason} />
      <div className="flex justify-start gap-2 pt-1">
        <button type="submit" disabled={!canSubmit} className="rounded bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-40">
          إعادة للتصميم
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          إلغاء
        </button>
      </div>
    </form>
  );
}
