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

  it("renders with exact accessible name '<customer> — <title> — <state>' and button role", () => {
    render(<JobTicket card={mockCard} />);

    const button = screen.getByRole("button", {
      name: "مطبعة الأهرام — كروت شخصية فاخرة — قيد التصميم",
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("tabindex", "0");
    expect(button).toHaveAttribute("data-station", "design");
  });

  it("handles keyboard shortcut M to trigger onMoveKey", () => {
    const handleMoveKey = vi.fn();
    render(<JobTicket card={mockCard} onMoveKey={handleMoveKey} />);

    const button = screen.getByRole("button");
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
