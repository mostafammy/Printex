import { db } from "~/server/db";
import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import type { WorkItemState } from "~/server/core";

export type PrinterCategory = "OFFSET" | "DIGITAL" | "LASER" | "OTHER";

export interface PrinterQueueItem {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: number;
  readonly customerName: string;
  readonly productName: string;
  readonly departmentName: string;
  readonly printerCategory: PrinterCategory;
  readonly state: WorkItemState;
  readonly priority: "NORMAL" | "URGENT";
  readonly quantity: number;
  readonly dimensions: string | null;
  readonly productionAreaSqm: number | null;
  readonly description: string | null;
  readonly enteredQueueAt: Date;
  readonly fileVersion: number | null;
  readonly originalFilename: string | null;
  readonly storageKey: string | null;
}

export interface PrinterQueueStats {
  readonly countsByCategory: {
    readonly OFFSET: number;
    readonly DIGITAL: number;
    readonly LASER: number;
    readonly OTHER: number;
    readonly ALL: number;
  };
  readonly countsByState: {
    readonly READY: number;
    readonly IN_PRODUCTION: number;
    readonly READY_FOR_COLLECTION: number;
  };
}

export interface PrinterQueueResult {
  readonly rows: readonly PrinterQueueItem[];
  readonly stats: PrinterQueueStats;
}

export function categorizePrinterType(
  departmentName?: string | null,
  productTypeName?: string | null,
): PrinterCategory {
  const d = (departmentName ?? "").toLowerCase().trim();
  const p = (productTypeName ?? "").toLowerCase().trim();

  if (
    d.includes("offset") ||
    d.includes("اوفسيت") ||
    p.includes("offset") ||
    p.includes("اوفسيت") ||
    p.includes("كتب") ||
    p.includes("مجلات")
  ) {
    return "OFFSET";
  }

  if (
    d.includes("digital") ||
    d.includes("ديجيتال") ||
    p.includes("digital") ||
    p.includes("ديجيتال") ||
    p.includes("card") ||
    p.includes("كروت") ||
    p.includes("flyer") ||
    p.includes("فلاير") ||
    p.includes("sticker") ||
    p.includes("استيكر") ||
    p.includes("بروشور")
  ) {
    return "DIGITAL";
  }

  if (
    d.includes("laser") ||
    d.includes("ليزر") ||
    p.includes("laser") ||
    p.includes("ليزر") ||
    p.includes("اكريليك") ||
    p.includes("acrylic") ||
    p.includes("sign")
  ) {
    return "LASER";
  }

  return "OTHER";
}

export async function getPrinterProductionQueue(actor: Actor): Promise<PrinterQueueResult> {
  authorize(actor, "production.operate");

  const productionStates: WorkItemState[] = [
    "READY_FOR_PRODUCTION",
    "IN_PRODUCTION",
    "PRODUCTION_COMPLETED",
    "READY_FOR_COLLECTION",
  ];

  const items = await db.workItem.findMany({
    where: {
      state: { in: productionStates },
    },
    include: {
      order: {
        select: {
          id: true,
          number: true,
          priority: true,
          customer: { select: { name: true } },
        },
      },
      productType: {
        select: {
          name: true,
          defaultDepartment: { select: { name: true } },
        },
      },
      department: {
        select: {
          name: true,
        },
      },
      designVersions: {
        where: { storageKey: { not: "" } },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          version: true,
          storageKey: true,
          fileName: true,
        },
      },
      transitions: {
        where: {
          to: { in: ["READY_FOR_PRODUCTION", "IN_PRODUCTION", "READY_FOR_COLLECTION"] },
        },
        orderBy: { at: "desc" },
        take: 1,
      },
    },
    orderBy: [
      { order: { priority: "desc" } },
      { createdAt: "asc" },
    ],
  });

  const categoryCounts = {
    OFFSET: 0,
    DIGITAL: 0,
    LASER: 0,
    OTHER: 0,
    ALL: items.length,
  };

  const stateCounts = {
    READY: 0,
    IN_PRODUCTION: 0,
    READY_FOR_COLLECTION: 0,
  };

  const rows: PrinterQueueItem[] = items.map((wi) => {
    const deptName = wi.department?.name ?? wi.productType?.defaultDepartment?.name ?? "Other";
    const category = categorizePrinterType(deptName, wi.productType?.name);
    categoryCounts[category] += 1;

    if (wi.state === "READY_FOR_PRODUCTION") {
      stateCounts.READY += 1;
    } else if (wi.state === "IN_PRODUCTION") {
      stateCounts.IN_PRODUCTION += 1;
    } else if (wi.state === "READY_FOR_COLLECTION" || wi.state === "PRODUCTION_COMPLETED") {
      stateCounts.READY_FOR_COLLECTION += 1;
    }

    let dimensions: string | null = null;
    if (wi.customerWidthCm && wi.productionHeightM) {
      dimensions = `${wi.customerWidthCm.toString()} سم × ${wi.productionHeightM.toString()} م`;
    } else if (wi.widthValue && wi.heightValue) {
      dimensions = `${wi.widthValue.toString()} × ${wi.heightValue.toString()}`;
    }

    const design = wi.designVersions[0] ?? null;
    const enteredAt = wi.transitions[0]?.at ?? wi.createdAt;

    return {
      id: wi.id,
      orderId: wi.orderId,
      orderNumber: wi.order.number,
      customerName: wi.order.customer.name,
      productName: wi.productType?.name ?? "أمر طباعة",
      departmentName: deptName,
      printerCategory: category,
      state: wi.state,
      priority: wi.order.priority,
      quantity: wi.quantity ?? 1,
      dimensions,
      productionAreaSqm: wi.productionAreaSqm ? Number(wi.productionAreaSqm) : null,
      description: wi.description,
      enteredQueueAt: enteredAt,
      fileVersion: design?.version ?? null,
      originalFilename: design?.fileName ?? null,
      storageKey: design?.storageKey ?? null,
    };
  });

  return {
    rows,
    stats: {
      countsByCategory: categoryCounts,
      countsByState: stateCounts,
    },
  };
}
