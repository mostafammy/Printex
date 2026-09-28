"use client";

/**
 * CompleteProductionSheet: captures produced quantity for IN_PRODUCTION → PRODUCTION_COMPLETED.
 * (FR-015, research.md R3, plan.md S1)
 */

import { useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

export interface CompleteProductionSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function QuantityField({
  quantity,
  cardQuantity,
  onChange,
}: {
  readonly quantity: number;
  readonly cardQuantity: number | null;
  readonly onChange: (val: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="produced-qty">
        الكمية المنتجة <span className="text-red-500">*</span>
      </label>
      <input
        id="produced-qty"
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => onChange(Number(e.target.value))}
        required
        className="w-32 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
      />
      {cardQuantity !== null && <p className="text-xs text-gray-500">الكمية المطلوبة: {cardQuantity}</p>}
    </div>
  );
}

export function CompleteProductionSheet({ request, onConfirm, onCancel }: CompleteProductionSheetProps) {
  const [quantity, setQuantity] = useState(request.card.quantity ?? 1);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity >= 1) onConfirm({ producedQuantity: quantity });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" dir="rtl">
      <h2 className="text-base font-semibold">إتمام الإنتاج — {request.card.title}</h2>
      <QuantityField quantity={quantity} cardQuantity={request.card.quantity} onChange={setQuantity} />
      <div className="flex justify-start gap-2 pt-1">
        <button type="submit" disabled={quantity < 1} className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-40">
          تأكيد الإتمام
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          إلغاء
        </button>
      </div>
    </form>
  );
}
