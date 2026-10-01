// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { BoardHeader } from "~/components/board/views/BoardHeader";

describe("BoardHeader Component", () => {
  afterEach(cleanup);

  it("renders the button navigating to /reception/new to add an order or item", () => {
    const handleUpdateFilters = vi.fn();
    const handleSelectSlice = vi.fn();

    render(
      <BoardHeader
        activeSlice="floor"
        availableSlices={["floor", "production"]}
        onSelectSlice={handleSelectSlice}
        filters={{}}
        onUpdateFilters={handleUpdateFilters}
      />
    );

    const addOrderLink = screen.getByTestId("board-add-order-btn");
    expect(addOrderLink).toBeInTheDocument();
    expect(addOrderLink).toHaveAttribute("href", "/reception/new");
    expect(addOrderLink).toHaveTextContent("إضافة طلب / صنف");
  });
});
