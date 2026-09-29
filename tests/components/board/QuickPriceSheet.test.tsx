// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { QuickPriceSheet } from "~/components/board/sheets/QuickPriceSheet";
import type { QuickPriceContext } from "~/app/(shell)/board/actions";
import type { BoardCard } from "~/lib/board/types";

const card: BoardCard = {
  id: "c-price-1",
  orderId: "ord-9",
  orderNumber: 909,
  orderTagHue: 120,
  customerName: "عميل التجربة",
  title: "بروشور",
  state: "WAITING_PRICING",
  priority: "NORMAL",
  pricing: "PENDING",
  reworkCount: 0,
  quantity: 500,
  targetMinutes: null,
  dueAt: null,
  enteredStationAt: "2026-09-26T12:00:00Z",
  lastTransitionId: null,
  lastTransitionAt: "2026-09-26T12:00:00Z",
  assignee: null,
  departmentId: null,
  moves: [],
};

const quotedCtx: QuickPriceContext = {
  pricing: "PENDING",
  policyMode: "FIXED",
  quoteAmount: "1500",
  quoteUnitAr: "500 قطعة",
  currentAmount: null,
};

const manualCtx: QuickPriceContext = {
  pricing: "PENDING",
  policyMode: "VARIABLE",
  quoteAmount: null,
  quoteUnitAr: null,
  currentAmount: null,
};

function renderSheet(ctx: QuickPriceContext, handlers?: { onConfirm?: (i: Record<string, unknown>) => void; onCancel?: () => void }) {
  const onConfirm = handlers?.onConfirm ?? vi.fn();
  const onCancel = handlers?.onCancel ?? vi.fn();
  render(
    <QuickPriceSheet
      request={{
        card,
        option: {
          edgeId: "WAITING_PRICING->READY_FOR_PRODUCTION",
          to: "READY_FOR_PRODUCTION",
          kind: "SHEET",
          sheet: "quick-price",
          screenHref: null,
          backward: false,
          destructive: false,
          groupable: false,
          labelAr: "تسعير أمر العمل",
        },
        sheetId: "quick-price",
      }}
      fetchContext={async () => ctx}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe("QuickPriceSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows item details and applies the auto-quote in one click", async () => {
    const { onConfirm } = renderSheet(quotedCtx);
    expect(await screen.findByText("بروشور")).toBeInTheDocument();
    expect(screen.getByText("عميل التجربة")).toBeInTheDocument();
    expect(screen.getByText("#909", { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByText("اعتماد السعر والنقل"));
    expect(onConfirm).toHaveBeenCalledWith({ kind: "APPLY_QUOTE" });
  });

  it("falls back to the manual form when no quote exists", async () => {
    const { onConfirm } = renderSheet(manualCtx);
    expect(await screen.findByText("تسعير يدوي")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "2000" } });
    fireEvent.change(screen.getByPlaceholderText("سبب السعر اليدوي"), { target: { value: "سعر خاص للعميل" } });
    fireEvent.click(screen.getByText("اعتماد يدوي والنقل للإنتاج"));
    expect(onConfirm).toHaveBeenCalledWith({
      kind: "VARIABLE",
      amount: "2000",
      reason: "سعر خاص للعميل",
    });
  });

  it("links to the full pricing page and cancels", async () => {
    const { onCancel } = renderSheet(quotedCtx);
    await screen.findByText("بروشور");
    expect(screen.getByText("التسعير الكامل").closest("a")).toHaveAttribute(
      "href",
      "/pricing?workItem=c-price-1",
    );
    fireEvent.click(screen.getByText("الرجوع (Esc)"));
    expect(onCancel).toHaveBeenCalled();
  });
});
