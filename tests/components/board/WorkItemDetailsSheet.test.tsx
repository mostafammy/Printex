// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { WorkItemDetailsSheet } from "~/components/board/WorkItemDetailsSheet";
import type { BoardCard, BoardSnapshot, WorkItemFullDetail } from "~/lib/board/types";
import { BoardContext } from "~/components/board/hooks/useBoardController";
import { BoardController } from "~/lib/board/BoardController";
import { BoardStore } from "~/lib/board/store/BoardStore";
import { FakeClock } from "../../unit/board/fakes";

const mockCard: BoardCard = {
  id: "wi-1",
  orderId: "ord-1",
  orderNumber: 1001,
  orderTagHue: 120,
  customerName: "مطبعة الأهرام",
  title: "كروت شخصية فاخرة",
  state: "IN_DESIGN",
  priority: "URGENT",
  pricing: "PRICED",
  reworkCount: 1,
  quantity: 500,
  targetMinutes: 1440,
  dueAt: "2026-10-01T12:00:00Z",
  enteredStationAt: "2026-09-26T10:00:00Z",
  lastTransitionId: "tr-1",
  lastTransitionAt: "2026-09-26T10:30:00Z",
  assignee: { id: "u-1", name: "أحمد مصمم" },
  departmentId: "dept-1",
  moves: [
    {
      edgeId: "design_to_review",
      to: "WAITING_REVIEW",
      kind: "DIRECT",
      sheet: null,
      screenHref: null,
      backward: false,
      destructive: false,
      groupable: true,
      labelAr: "إرسال للمراجعة",
    },
  ],
};

const mockDetail: WorkItemFullDetail = {
  id: "wi-1",
  orderId: "ord-1",
  orderNumber: 1001,
  orderChannel: "WHATSAPP",
  orderPriority: "URGENT",
  orderCreatedAt: "2026-09-26T09:00:00Z",
  orderDueDate: "2026-10-01T12:00:00Z",
  customer: {
    id: "cust-1",
    name: "مطبعة الأهرام",
    phones: ["01001234567"],
    notes: "عميل مميز",
    isCashCustomer: true,
  },
  createdBy: {
    id: "user-1",
    name: "موظف الاستقبال",
  },
  title: "كروت شخصية فاخرة",
  description: "كروت شخصية فاخرة مع سلوفان مطفي",
  productType: {
    id: "pt-1",
    name: "كروت شخصية",
  },
  department: {
    id: "dept-1",
    name: "قسم الديجيتال",
    isExternalProduction: false,
  },
  state: "IN_DESIGN",
  quantity: 500,
  producedQuantity: null,
  widthValue: "9.00",
  heightValue: "5.00",
  dimensionUnit: "CM",
  material: "كوشيه 350 جرام",
  finishNotes: "سلوفان مطفي وجهين + بصمة ذهبية",
  productionNotes: null,
  requiresDesign: true,
  requiresReview: true,
  createdAt: "2026-09-26T09:00:00Z",
  updatedAt: "2026-09-26T10:30:00Z",
  dueDate: "2026-10-01T12:00:00Z",
  assignee: {
    id: "u-1",
    name: "أحمد مصمم",
    email: "ahmed@example.com",
  },
  pricingStatus: {
    status: "PRICED",
    disputeReason: null,
    waitingSince: null,
  },
  currentPrice: {
    amount: "450.00",
    currency: "EGP",
    source: "LIST",
    setAt: "2026-09-26T09:15:00Z",
    setByName: "موظف التسعير",
  },
  reworkCount: 1,
  returns: [
    {
      id: "ret-1",
      originDepartmentName: "قسم المراجعة",
      category: "DESIGN_ISSUE",
      explanation: "تعديل درجة لون الشعار لتطابق الهوية",
      note: "تم إرفاق الشعار الصحيح",
      createdAt: "2026-09-26T10:00:00Z",
      raisedByName: "مراجع الجودة",
      assignedToName: "أحمد مصمم",
    },
  ],
  designVersions: [
    {
      id: "dv-1",
      version: 1,
      fileName: "business_card_v1.pdf",
      sizeBytes: 2450000,
      mimeType: "application/pdf",
      note: "التصميم المبدئي",
      createdAt: "2026-09-26T09:45:00Z",
      approvedAt: null,
      uploadedByName: "أحمد مصمم",
    },
  ],
  fileAssets: [],
  transitions: [
    {
      id: "tr-1",
      from: "ASSIGNED",
      to: "IN_DESIGN",
      at: "2026-09-26T09:30:00Z",
      reason: null,
      rejectionCategory: null,
      actorName: "أحمد مصمم",
    },
  ],
  lateCancellation: null,
  vendorRecords: [],
};

const emptySnapshot: BoardSnapshot = {
  cards: [mockCard],
  hiddenSiblingCounts: {},
  slice: "floor",
  availableSlices: ["floor"],
  blockedHints: [],
  generatedAt: new Date().toISOString(),
};

function createMockController() {
  const store = new BoardStore(emptySnapshot, new FakeClock(1000));
  return new BoardController({
    store,
    snapshotGateway: {
      snapshot: async () => emptySnapshot,
      lanePage: async (req) => ({
        state: req.state,
        cards: [],
        pagination: { page: 1, pageSize: 20, totalCount: 0, hasMore: false, nextCursor: null },
      }),
    },
  });
}

describe("WorkItemDetailsSheet Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders instantly with card data while loading full details", () => {
    const handleClose = vi.fn();
    const controller = createMockController();

    render(
      <BoardContext.Provider value={controller}>
        <WorkItemDetailsSheet
          card={mockCard}
          isOpen={true}
          onClose={handleClose}
          fetchDetail={async () => mockDetail}
        />
      </BoardContext.Provider>,
    );

    expect(screen.getByText("#1001")).toBeInTheDocument();
    expect(screen.getByText("مطبعة الأهرام")).toBeInTheDocument();
    expect(screen.getByText("كروت شخصية فاخرة")).toBeInTheDocument();
    expect(screen.getByText("عاجل")).toBeInTheDocument();
    expect(screen.getByText("500 نسخة")).toBeInTheDocument();
    expect(screen.getByText("أحمد مصمم")).toBeInTheDocument();
  });

  it("loads and displays deep technical specifications, dimensions and material", async () => {
    const handleClose = vi.fn();
    const controller = createMockController();

    render(
      <BoardContext.Provider value={controller}>
        <WorkItemDetailsSheet
          card={mockCard}
          isOpen={true}
          onClose={handleClose}
          fetchDetail={async () => mockDetail}
        />
      </BoardContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("9.00 × 5.00 CM")).toBeInTheDocument();
      expect(screen.getByText("كوشيه 350 جرام")).toBeInTheDocument();
      expect(screen.getByText("سلوفان مطفي وجهين + بصمة ذهبية")).toBeInTheDocument();
      expect(screen.getByText("450.00")).toBeInTheDocument();
    });
  });

  it("supports switching tabs to view files, rework and timeline", async () => {
    const handleClose = vi.fn();
    const controller = createMockController();

    render(
      <BoardContext.Provider value={controller}>
        <WorkItemDetailsSheet
          card={mockCard}
          isOpen={true}
          onClose={handleClose}
          fetchDetail={async () => mockDetail}
        />
      </BoardContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("9.00 × 5.00 CM")).toBeInTheDocument();
    });

    // Click files tab
    const filesTab = screen.getByRole("button", { name: /الملفات والتصاميم/ });
    fireEvent.click(filesTab);
    expect(screen.getByText("business_card_v1.pdf")).toBeInTheDocument();
    expect(screen.getByText("التصميم المبدئي")).toBeInTheDocument();

    // Click rework tab
    const reworkTab = screen.getByRole("button", { name: /سجل التعديل/ });
    fireEvent.click(reworkTab);
    expect(screen.getByText("تعديل درجة لون الشعار لتطابق الهوية")).toBeInTheDocument();
    expect(screen.getByText(/قسم المراجعة/)).toBeInTheDocument();

    // Click timeline tab
    const timelineTab = screen.getByRole("button", { name: /المسار الزمني/ });
    fireEvent.click(timelineTab);
    expect(screen.getAllByText("قيد التصميم").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("معين")).toBeInTheDocument();
  });

  it("triggers move execution from available moves inside details modal", async () => {
    const handleClose = vi.fn();
    const controller = createMockController();
    const executeSpy = vi.spyOn(controller, "executeMove").mockResolvedValue(undefined);

    render(
      <BoardContext.Provider value={controller}>
        <WorkItemDetailsSheet
          card={mockCard}
          isOpen={true}
          onClose={handleClose}
          fetchDetail={async () => mockDetail}
        />
      </BoardContext.Provider>,
    );

    const moveBtn = screen.getByRole("button", { name: /إرسال للمراجعة/ });
    fireEvent.click(moveBtn);

    expect(executeSpy).toHaveBeenCalledWith(mockCard, mockCard.moves[0]);
    expect(handleClose).toHaveBeenCalled();
  });

  it("closes when ESC key is pressed", () => {
    const handleClose = vi.fn();
    const controller = createMockController();

    render(
      <BoardContext.Provider value={controller}>
        <WorkItemDetailsSheet
          card={mockCard}
          isOpen={true}
          onClose={handleClose}
          fetchDetail={async () => mockDetail}
        />
      </BoardContext.Provider>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalled();
  });
});
