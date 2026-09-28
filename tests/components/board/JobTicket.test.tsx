// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { JobTicket } from "~/components/board/JobTicket";
import type { BoardCard } from "~/lib/board/types";

const mockCard: BoardCard = {
  id: "wi-1",
  orderId: "ord-1",
  orderNumber: 1001,
  orderTagHue: 120,
  customerName: "مطبعة الأهرام",
  title: "كروت شخصية فاخرة",
  state: "IN_DESIGN",
  priority: "NORMAL",
  pricing: "PRICED",
  reworkCount: 1,
  quantity: 500,
  targetMinutes: 1440,
  dueAt: null,
  enteredStationAt: "2026-09-26T10:00:00Z",
  lastTransitionId: "tr-1",
  lastTransitionAt: "2026-09-26T10:30:00Z",
  assignee: { id: "u-1", name: "أحمد مصمم" },
  departmentId: "dept-1",
  moves: [],
};

describe("JobTicket Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with an accessible name carrying the operational facts, and button role", () => {
    render(<JobTicket card={mockCard} />);

    // The name must carry what the card shows but a screen reader would
    // otherwise miss: the order reference, quantity, rework, and pricing
    // state. Asserted with a regex because the exact set grows with the card.
    const button = screen.getByRole("button", {
      name: /مطبعة الأهرام — كروت شخصية فاخرة — قيد التصميم — .*#1001/,
    });
    expect(button).toHaveAccessibleName(expect.stringContaining("500 نسخة"));
    expect(button).toHaveAccessibleName(expect.stringContaining("تعديل 1"));
    expect(button).toHaveAttribute("tabindex", "0");
    expect(button).toHaveAttribute("data-station", "design");
  });

  it("exposes an explicit non-drag move control, so touch is not drag-only", () => {
    render(<JobTicket card={mockCard} />);

    // Drag-and-drop is the fast path, never the only one: a print floor is a
    // touch environment and a drag is the least reliable gesture with a wet
    // hand. The card's own click used to be a no-op in production.
    const moveButton = screen.getByRole("button", { name: "نقل" });
    expect(moveButton).toBeInTheDocument();
    expect(moveButton).toHaveClass("min-h-11");
  });

  it("handles keyboard shortcut M to trigger onMoveKey", () => {
    const handleMoveKey = vi.fn();
    render(<JobTicket card={mockCard} onMoveKey={handleMoveKey} />);

    // The ticket itself is a button, and it now contains the explicit move
    // control, so the shortcut target is scoped by the card's test id.
    const button = screen.getByTestId(`job-ticket-${mockCard.id}`);
    fireEvent.keyDown(button, { key: "m" });
    expect(handleMoveKey).toHaveBeenCalledTimes(1);
    expect(handleMoveKey).toHaveBeenCalledWith(mockCard);

    fireEvent.keyDown(button, { key: "M" });
    expect(handleMoveKey).toHaveBeenCalledTimes(2);
  });

  it("renders ticket anatomy (badges, registration mark, order tag, customer, title)", () => {
    render(<JobTicket card={mockCard} isSiblingHighlighted={true} />);

    expect(screen.getByText("مطبعة الأهرام")).toBeInTheDocument();
    expect(screen.getByText("كروت شخصية فاخرة")).toBeInTheDocument();
    expect(screen.getByText("#1001")).toBeInTheDocument();
    expect(screen.getByText(/تعديل #/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText("مسعّر")).toBeInTheDocument();
    expect(screen.getByText("⌖")).toBeInTheDocument();
  });
});
