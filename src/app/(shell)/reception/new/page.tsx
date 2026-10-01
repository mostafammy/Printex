// Master Print Order Screen — إصدار أمر طباعة جديد
// Server Component: no "use client".

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { listActiveProductTypes } from "~/server/orders";
import {
  listActiveFinishingServices,
  loadProductionConstraints,
} from "~/server/production-spec";
import { MasterPrintOrderView } from "~/components/reception/master-order/MasterPrintOrderView";
import type {
  FinishingServiceOption,
  ProductionGovernance,
} from "~/components/reception/master-order/types";

export default async function NewOrderPage() {
  const actor = await getActor();
  authorize(actor, "order.create");

  // Pre-generate order number e.g. WO-00001
  const latestOrder = await db.order.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const preGeneratedOrderNumber = `WO-${String((latestOrder?.number ?? 0) + 1).padStart(5, "0")}`;

  // Default dates
  const today = new Date();
  const defaultOrderDate = today.toISOString().split("T")[0] ?? "2026-10-01";
  const dueDateObj = new Date();
  dueDateObj.setDate(dueDateObj.getDate() + 4);
  const defaultDueDate = dueDateObj.toISOString().split("T")[0] ?? "2026-10-05";

  // Data loads
  const [customerRows, departments, productTypes, designerRows, finishingSnapshots] =
    await Promise.all([
      db.customer.findMany({
        where: { isArchived: false },
        select: {
          id: true,
          name: true,
          isCashCustomer: true,
          phones: { select: { phoneE164: true }, take: 1 },
        },
        orderBy: { name: "asc" },
        take: 100,
      }),
      db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      listActiveProductTypes(actor),
      // The designer roster reception may hand work to: active users holding
      // `design.work` through a role or a per-user extra grant. Same predicate
      // `getEligibleDesigners` uses, so the dropdown cannot offer someone who
      // would be refused at assignment.
      db.user.findMany({
        where: {
          isActive: true,
          OR: [
            { roles: { some: { role: { permissions: { some: { permission: "design.work" } } } } } },
            { extraPermissions: { some: { permission: "design.work" } } },
          ],
        },
        select: { id: true, name: true, username: true },
        orderBy: { name: "asc" },
      }),
      // The extensible finishing catalogue. Sulfan at 90 EGP/m² is a ROW here,
      // not a branch in the pricing code — adding the next add-on is one insert.
      listActiveFinishingServices(),
    ]);

  // 093 configuration, read through the ONE boundary that validates it
  // (`loadProductionConstraints`). The reception form derives from this rather
  // than from a ladder literal, so the width ladder, the height ceiling and the
  // EGP/m² band each come from `ProductionWidthRule` and cannot drift.
  const governed = await Promise.all(
    productTypes.map(async (pt) => {
      const constraints = await loadProductionConstraints(pt.id);
      if (!constraints) return null;
      const mid = constraints.minRatePerSqm.plus(constraints.maxRatePerSqm).div(2);
      return [
        pt.id,
        {
          productTypeId: pt.id,
          productTypeName: pt.name,
          ladderCm: constraints.ladder,
          maxHeightM: constraints.maxHeightM.toString(),
          minRatePerSqm: constraints.minRatePerSqm.toString(),
          maxRatePerSqm: constraints.maxRatePerSqm.toString(),
          suggestedRatePerSqm: mid.toDecimalPlaces(2).toString(),
        } satisfies ProductionGovernance,
      ] as const;
    }),
  );

  const governance: Record<string, ProductionGovernance> = Object.fromEntries(
    governed.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  );

  const finishingServices: FinishingServiceOption[] = finishingSnapshots.map((f) => ({
    id: f.id,
    code: f.code,
    labelAr: f.labelAr,
    ratePerSqm: f.ratePerSqm,
  }));

  const customers = customerRows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phones[0]?.phoneE164 ?? null,
    isCashCustomer: c.isCashCustomer,
  }));

  const cashCustomer = customers.find((c) => c.isCashCustomer) ?? null;
  const salesRepName = actor.name ?? "مسؤول الاستقبال";

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/reception"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>العودة لطابور الاستقبال</span>
        </Link>
      </div>

      <MasterPrintOrderView
        preGeneratedOrderNumber={preGeneratedOrderNumber}
        defaultOrderDate={defaultOrderDate}
        defaultDueDate={defaultDueDate}
        salesRepName={salesRepName}
        customers={customers}
        cashCustomer={cashCustomer}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        productTypes={productTypes.map((pt) => ({
          id: pt.id,
          name: pt.name,
          defaultDepartmentId: pt.defaultDepartmentId,
          defaultRequiresDesign: pt.defaultRequiresDesign,
          defaultRequiresReview: pt.defaultRequiresReview,
        }))}
        designers={designerRows.map((d) => ({
          id: d.id,
          name: d.name,
          username: d.username,
        }))}
        governance={governance}
        finishingServices={finishingServices}
      />
    </div>
  );
}