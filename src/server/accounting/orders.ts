import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import { ForbiddenError } from "~/server/auth/authorize";
import {
  getShopTimezone,
  shopLocalDayBoundsUtc,
  shopLocalDate,
  todayShopLocalDate,
} from "~/server/finance";
import type { WorkItemState } from "~/server/core";

export interface AccountantOrdersFilter {
  readonly day?: string; // "today" | "yesterday" | "last7days" | "all" | "YYYY-MM-DD"
  readonly status?: "ALL" | "PENDING" | "APPROVED" | "COMPLETED";
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * One add-on line as it was priced, with the rate and label frozen at selection
 * time. The accountant is approving a number he can be asked to defend, so the
 * composition of that number has to be visible, not just its sum.
 */
export interface AccountantFinishingLine {
  readonly labelAr: string;
  readonly ratePerSqm: number;
  readonly totalAmount: number;
}

export interface AccountantOrderItem {
  readonly id: string;
  readonly state: WorkItemState;
  readonly productName: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly dimensions: string | null;
  readonly productionAreaSqm: number | null;
  readonly baseTotal: number | null;
  readonly productionTotal: number | null;
  readonly pricingStatus: "PENDING" | "PRICED" | "DISPUTED" | "NOT_REQUIRED";
  readonly approvedAt: Date | null;
  readonly approvedByName: string | null;
  readonly note: string | null;

  // ── The quote breakdown the accountant approves or overrides ──────────────
  //
  // `productionTotal` alone is not something an accountant can meaningfully
  // approve: it is one number with no visible derivation. These are the inputs
  // and the add-on lines that produced it, so "approve" and "change it" are
  // both informed decisions rather than a rubber stamp on a mystery figure.
  readonly customerWidthCm: number | null;
  readonly productionWidthCm: number | null;
  readonly productionHeightM: number | null;
  readonly baseRatePerSqm: number | null;
  readonly finishingTotal: number | null;
  readonly finishingLines: readonly AccountantFinishingLine[];
}

export interface AccountantOrderRow {
  readonly orderId: string;
  readonly orderNumber: number;
  readonly customerName: string;
  readonly customerPhone: string | null;
  readonly channel: string;
  readonly priority: "NORMAL" | "URGENT";
  readonly createdAt: Date;
  readonly dueDate: Date | null;
  readonly workItems: readonly AccountantOrderItem[];
  readonly totalAmount: number;
  readonly isPendingApproval: boolean;
  readonly isApproved: boolean;
  readonly latestApprovedAt: Date | null;
  readonly currentStageLabelAr: string;
}

export interface AccountantOrdersMetrics {
  readonly totalOrders: number;
  readonly pendingCount: number;
  readonly approvedCount: number;
  readonly totalAmount: number;
}

export interface AccountantOrdersResult {
  readonly selectedDay: string;
  readonly dayLabel: string;
  readonly timezone: string;
  readonly metrics: AccountantOrdersMetrics;
  readonly orders: readonly AccountantOrderRow[];
}

function canAccessAccounting(actor: Actor): boolean {
  return (
    actor.roles.includes("ACCOUNTING") ||
    actor.roles.includes("ADMIN_OWNER") ||
    actor.permissions.has("pricing.use_fixed") ||
    actor.permissions.has("finance.view") ||
    actor.permissions.has("workitem.approve_production")
  );
}

export async function getAccountantOrders(
  actor: Actor,
  filter: AccountantOrdersFilter = {},
): Promise<AccountantOrdersResult> {
  if (!canAccessAccounting(actor)) {
    throw new ForbiddenError("pricing.use_fixed");
  }

  const timezone = await getShopTimezone();
  const today = await todayShopLocalDate();

  const rawDay = filter.day?.trim();
  let selectedDay = rawDay && rawDay.length > 0 ? rawDay : "today";
  let dayBounds: { startUtc: Date; endUtc: Date } | null = null;
  let dayLabel = "اليوم";

  if (selectedDay === "today") {
    selectedDay = today;
    dayBounds = shopLocalDayBoundsUtc(today, timezone);
    dayLabel = `اليوم (${today})`;
  } else if (selectedDay === "yesterday") {
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = shopLocalDate(yesterdayDate, timezone);
    dayBounds = shopLocalDayBoundsUtc(yesterdayStr, timezone);
    dayLabel = `أمس (${yesterdayStr})`;
  } else if (selectedDay === "last7days") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = shopLocalDate(sevenDaysAgo, timezone);
    const start = shopLocalDayBoundsUtc(sevenDaysAgoStr, timezone).startUtc;
    const end = shopLocalDayBoundsUtc(today, timezone).endUtc;
    dayBounds = { startUtc: start, endUtc: end };
    dayLabel = "آخر 7 أيام";
  } else if (selectedDay === "all") {
    dayBounds = null;
    dayLabel = "جميع الأيام";
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) {
    try {
      dayBounds = shopLocalDayBoundsUtc(selectedDay, timezone);
      dayLabel = selectedDay === today ? `اليوم (${selectedDay})` : selectedDay;
    } catch {
      dayBounds = null;
      dayLabel = selectedDay;
    }
  }

  const postPricingStates: WorkItemState[] = [
    "READY_FOR_PRODUCTION",
    "IN_PRODUCTION",
    "PRODUCTION_COMPLETED",
    "READY_FOR_COLLECTION",
    "DELIVERED",
    "COMPLETED",
  ];

  // Base scope: orders that have reached or passed through accounting
  const accountingWorkItemCondition = {
    OR: [
      { state: "WAITING_PRICING" as const },
      { accountingApprovals: { some: {} } },
      { state: { in: postPricingStates } },
    ],
  };

  // Date filtering condition
  const dateCondition = dayBounds
    ? {
        OR: [
          { createdAt: { gte: dayBounds.startUtc, lte: dayBounds.endUtc } },
          {
            workItems: {
              some: {
                accountingApprovals: {
                  some: {
                    approvedAt: { gte: dayBounds.startUtc, lte: dayBounds.endUtc },
                  },
                },
              },
            },
          },
          {
            workItems: {
              some: {
                transitions: {
                  some: {
                    at: { gte: dayBounds.startUtc, lte: dayBounds.endUtc },
                    OR: [
                      { from: "WAITING_PRICING" as const },
                      { to: "WAITING_PRICING" as const },
                    ],
                  },
                },
              },
            },
          },
        ],
      }
    : {};

  // Search filter
  const search = filter.search?.trim();
  const searchNum = search ? Number(search) : NaN;
  const isSearchNumber = Number.isInteger(searchNum) && searchNum > 0;

  const searchCondition = search
    ? {
        OR: [
          ...(isSearchNumber ? [{ number: searchNum }] : []),
          { customer: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const orders = await db.order.findMany({
    where: {
      workItems: {
        some: accountingWorkItemCondition,
      },
      ...dateCondition,
      ...searchCondition,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      workItems: {
        include: {
          productType: { select: { name: true } },
          pricingStatus: { select: { status: true, waitingSince: true } },
          // The frozen add-on lines behind `finishingTotal`. Ordered newest
          // first so the mapping below can keep only the latest quote
          // generation -- WorkItemFinishing is append-only, so a re-price adds
          // rows rather than replacing them, and showing a superseded generation
          // to the accountant would add up to a total that no longer exists.
          finishings: {
            orderBy: [{ generation: "desc" }, { quotedAt: "desc" }],
            select: {
              generation: true,
              labelSnapshot: true,
              rateSnapshot: true,
              totalAmount: true,
            },
          },
          accountingApprovals: {
            orderBy: { approvedAt: "desc" },
            take: 1,
            include: {
              approvedBy: { select: { name: true } },
            },
          },
          transitions: {
            where: {
              OR: [
                { from: "WAITING_PRICING" },
                { to: "WAITING_PRICING" },
              ],
            },
            orderBy: { at: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 150,
  });

  const rows: AccountantOrderRow[] = orders.map((order) => {
    let orderTotal = 0;
    let hasPending = false;
    let hasApproved = false;
    let latestApproval: Date | null = null;

    const mappedItems: AccountantOrderItem[] = order.workItems.map((item) => {
      const pTotal = item.productionTotal ? Number(item.productionTotal) : null;
      const bTotal = item.baseTotal ? Number(item.baseTotal) : null;
      const itemAmount = pTotal ?? bTotal ?? 0;
      orderTotal += itemAmount;

      const approval = item.accountingApprovals[0] ?? null;
      if (approval) {
        hasApproved = true;
        if (!latestApproval || approval.approvedAt > latestApproval) {
          latestApproval = approval.approvedAt;
        }
      }

      if (item.state === "WAITING_PRICING") {
        hasPending = true;
      }

      let dimensions: string | null = null;
      if (item.customerWidthCm && item.productionHeightM) {
        dimensions = `${item.customerWidthCm.toString()} سم × ${item.productionHeightM.toString()} م`;
      } else if (item.widthValue && item.heightValue) {
        dimensions = `${item.widthValue.toString()} × ${item.heightValue.toString()}`;
      }

      // Only the newest quote generation's lines. `finishings` arrives
      // ordered by generation DESC, so a single pass dropping everything after
      // the first generation boundary keeps exactly the current quote. An item
      // with no add-ons yields an empty list, not a stale one.
      const currentGeneration = item.finishings[0]?.generation ?? null;
      const finishingLines: AccountantFinishingLine[] =
        currentGeneration === null
          ? []
          : item.finishings
              .filter((line) => line.generation === currentGeneration)
              .map((line) => ({
                labelAr: line.labelSnapshot,
                ratePerSqm: Number(line.rateSnapshot),
                totalAmount: Number(line.totalAmount),
              }));

      return {
        id: item.id,
        state: item.state,
        productName: item.productType?.name ?? "صنف طباعة",
        description: item.description,
        quantity: item.quantity ?? 1,
        dimensions,
        productionAreaSqm: item.productionAreaSqm ? Number(item.productionAreaSqm) : null,
        baseTotal: bTotal,
        productionTotal: pTotal,
        pricingStatus: item.pricingStatus?.status ?? "NOT_REQUIRED",
        approvedAt: approval?.approvedAt ?? null,
        approvedByName: approval?.approvedBy?.name ?? null,
        note: approval?.note ?? null,
        customerWidthCm: item.customerWidthCm ? Number(item.customerWidthCm) : null,
        productionWidthCm: item.productionWidthCm ? Number(item.productionWidthCm) : null,
        productionHeightM: item.productionHeightM ? Number(item.productionHeightM) : null,
        baseRatePerSqm: item.baseRatePerSqm ? Number(item.baseRatePerSqm) : null,
        finishingTotal: item.finishingTotal ? Number(item.finishingTotal) : null,
        finishingLines,
      };
    });

    let currentStageLabelAr = "مكتمل";
    if (hasPending) {
      currentStageLabelAr = "بانتظار تسعير/اعتماد المحاسب";
    } else if (order.workItems.some((w) => w.state === "READY_FOR_PRODUCTION")) {
      currentStageLabelAr = "معتمد - بانتظار بدء الطباعة";
    } else if (order.workItems.some((w) => w.state === "IN_PRODUCTION")) {
      currentStageLabelAr = "قيد الطباعة والإنتاج";
    } else if (order.workItems.some((w) => w.state === "PRODUCTION_COMPLETED")) {
      currentStageLabelAr = "تمت الطباعة - التجهيز والتسليم";
    } else if (order.workItems.some((w) => w.state === "DELIVERED" || w.state === "COMPLETED")) {
      currentStageLabelAr = "تم التسليم للعميل";
    }

    return {
      orderId: order.id,
      orderNumber: order.number,
      customerName: order.customer.name,
      customerPhone: null,
      channel: order.channel,
      priority: order.priority,
      createdAt: order.createdAt,
      dueDate: order.dueDate,
      workItems: mappedItems,
      totalAmount: Math.round(orderTotal * 100) / 100,
      isPendingApproval: hasPending,
      isApproved: hasApproved || !hasPending,
      latestApprovedAt: latestApproval,
      currentStageLabelAr,
    };
  });

  // Filter by status if specified
  const filteredRows = rows.filter((r) => {
    if (!filter.status || filter.status === "ALL") return true;
    if (filter.status === "PENDING") return r.isPendingApproval;
    if (filter.status === "APPROVED") return !r.isPendingApproval;
    if (filter.status === "COMPLETED") {
      return r.workItems.every((w) => w.state === "DELIVERED" || w.state === "COMPLETED");
    }
    return true;
  });

  // Calculate metrics
  const totalOrders = rows.length;
  const pendingCount = rows.filter((r) => r.isPendingApproval).length;
  const approvedCount = rows.filter((r) => !r.isPendingApproval).length;
  const totalAmount = rows.reduce((acc, r) => acc + r.totalAmount, 0);

  return {
    selectedDay,
    dayLabel,
    timezone,
    metrics: {
      totalOrders,
      pendingCount,
      approvedCount,
      totalAmount: Math.round(totalAmount * 100) / 100,
    },
    orders: filteredRows,
  };
}
