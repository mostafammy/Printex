// Master Print Order Screen — إصدار أمر طباعة جديد
// Server Component: no "use client".

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import { listActiveProductTypes } from "~/server/orders";
import { MasterPrintOrderView } from "~/components/reception/master-order/MasterPrintOrderView";

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
  const [customerRows, departments, productTypes] = await Promise.all([
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
  ]);

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
        defaultRatePerSqm={100}
      />
    </div>
  );
}
