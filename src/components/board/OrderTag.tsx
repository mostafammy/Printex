"use client";

/**
 * OrderTag chip rendering order reference, sibling highlight triggers, and group drag handle.
 * (specs/017-press-floor-board/spec.md FR-004, FR-019, contracts/board-engine.md §React surface)
 */

import React from "react";
import { GripVertical } from "lucide-react";

export interface OrderTagProps {
  readonly orderId: string;
  readonly orderNumber: number;
  readonly orderTagHue: number;
  readonly hiddenSiblingCount?: number;
  readonly onHover?: (orderId: string | null) => void;
  readonly isHighlighted?: boolean;
  readonly eligibleCount?: number;
  readonly totalCount?: number;
  readonly onGroupClick?: (orderId: string) => void;
}

function OrderCountBadge({ eligible, total }: { readonly eligible?: number; readonly total?: number }) {
  if (eligible === undefined || total === undefined || total <= 1) return null;
  return (
    <span
      className="ms-1 rounded bg-black/10 px-1 py-0.2 font-mono text-[10px] font-bold"
      title={`${eligible} من أصل ${total} بطاقات قابلة للنقل`}
    >
      {eligible} من {total}
    </span>
  );
}

function OrderGroupButton({
  orderId,
  orderNumber,
  onGroupClick,
}: {
  readonly orderId: string;
  readonly orderNumber: number;
  readonly onGroupClick?: (orderId: string) => void;
}) {
  if (!onGroupClick) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onGroupClick(orderId);
      }}
      className="cursor-grab active:cursor-grabbing p-0.5 -ms-1 hover:bg-black/10 rounded transition-colors"
      aria-label={`نقل طلب #${orderNumber} جماعياً`}
    >
      <GripVertical className="h-3 w-3 opacity-60" />
    </button>
  );
}

export const OrderTag = React.memo(function OrderTag({
  orderId,
  orderNumber,
  orderTagHue,
  hiddenSiblingCount,
  onHover,
  isHighlighted = false,
  eligibleCount,
  totalCount,
  onGroupClick,
}: OrderTagProps) {
  const chipStyle: React.CSSProperties = {
    backgroundColor: `hsl(${orderTagHue} 75% 95%)`,
    borderColor: `hsl(${orderTagHue} 50% 80%)`,
    color: `hsl(${orderTagHue} 85% 25%)`,
  };

  return (
    <div
      data-testid={`order-tag-${orderId}`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold transition-all ${
        isHighlighted ? "ring-2 ring-offset-1 ring-primary" : ""
      }`}
      style={chipStyle}
      onMouseEnter={() => onHover?.(orderId)}
      onMouseLeave={() => onHover?.(null)}
    >
      <OrderGroupButton orderId={orderId} orderNumber={orderNumber} onGroupClick={onGroupClick} />
      <span className="font-mono">#{orderNumber}</span>
      <OrderCountBadge eligible={eligibleCount} total={totalCount} />
      {hiddenSiblingCount && hiddenSiblingCount > 0 ? (
        <span className="text-[10px] opacity-80" title={`${hiddenSiblingCount} بطاقات أخرى في محطات خارج نطاق هذا العرض`}>
          +{hiddenSiblingCount}
        </span>
      ) : null}
    </div>
  );
});
