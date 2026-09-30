/**
 * Backfill realistic chronological transitions, phase timings, and audit events
 * for all orders and work items in the database.
 *
 * Uses fast batch inserts.
 * Does NOT delete audit_event (which is append-only by database security rule).
 */

import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL?.split("?")[0];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

function buildTransitions(targetState, { designerId }) {
  const reception = "seed_user_reception";
  const headDesigner = "seed_user_head_designer";
  const designer = designerId || "seed_user_designer";
  const production = "seed_user_production";
  const accounting = "seed_user_accounting";
  const delivery = "seed_user_delivery";

  switch (targetState) {
    case "NEW":
      return [];

    case "ASSIGNED":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "تم إسناد الطلب للمصمم للبدء في تجهيز بروفة الطباعة وتدقيق الأبعاد",
        },
      ];

    case "IN_DESIGN":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "تم إسناد الطلب للمصمم لتجهيز التصميم الفني",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "بدء العمل على التصميم وضبط نظام الألوان CMYK وهوامش القطع",
        },
      ];

    case "DESIGN_COMPLETED":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم لتنفيذ الملفات",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "بدء التصميم ورسم الخطوط التوضيحية وتنسيق النصوص",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال إعداد التصميم وتصدير ملف PDF عالي الدقة جاهز للفرز",
        },
      ];

    case "WAITING_REVIEW":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر العمل للمصمم المختص",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "العمل على إعداد البروفة الأولية ومراجعة مقاسات المنتج",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال الملفات التنسيقية وتصدير البروفة",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "إرسال التصميم إلى رئيس المصممين للمراجعة الفنية واعتماد العينات",
        },
      ];

    case "REWORK_REQUIRED":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر العمل للمصمم لتجهيز القوالب",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "إعداد التصميم والبروفة الأولى للعميل",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "تم الانتهاء من الملفات الأولية",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "إرسال الملفات للمراجعة الفنية",
        },
        {
          from: "WAITING_REVIEW",
          to: "REWORK_REQUIRED",
          actorId: headDesigner,
          reason: "مطلوب زيادة هوامش القص 3 مم وتعديل دقة الشعار إلى 300DPI",
          rejectionCategory: "DESIGN_ISSUE",
        },
      ];

    case "APPROVED":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "بدء التصميم وضبط القياسات الفنية",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال البروفة وتجهيز ملفات الطباعة",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "تقديم البروفة للاعتماد الفني",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "تم تدقيق البروفة واعتماد الألوان والقياسات، جاهز للتنفيذ",
        },
      ];

    case "WAITING_PRICING":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر العمل للمصمم",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "إعداد المواصفات الفنية وتصميم النموذج",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال التصميم ورفع النسخة النهائية",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "إرسال البروفة للاعتماد",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "اعتماد المواصفات الفنية والتصميم",
        },
        {
          from: "APPROVED",
          to: "WAITING_PRICING",
          actorId: reception,
          reason: "تحويل الطلب للإدارة المالية لتسعير الخامات الخاصة والكميات",
        },
      ];

    case "READY_FOR_PRODUCTION":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم لتجهيز الملفات",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "تنفيذ التصميم وضبط خطوط القص والريجة",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال التصميم ورفع النسخة الرقمية المعتمدة",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "إرسال التصميم للمراجعة الفنية",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "اعتماد البروفة الفنية ومطابقة ملفات الطباعة",
        },
        {
          from: "APPROVED",
          to: "READY_FOR_PRODUCTION",
          actorId: reception,
          reason: "تم اعتماد التسعير وجدولة أمر الشغل على خط الإنتاج والطباعة",
        },
      ];

    case "IN_PRODUCTION":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "تجهيز ملفات CTP وفرز الألوان",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال الملفات التجهيزية للطباعة",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "مراجعة جودة الملفات",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "اعتماد أوامر الفرز والتجهيز الطباعي",
        },
        {
          from: "APPROVED",
          to: "READY_FOR_PRODUCTION",
          actorId: reception,
          reason: "تحويل أمر الشغل لصالة الطباعة وتجهيز الخامات",
        },
        {
          from: "READY_FOR_PRODUCTION",
          to: "IN_PRODUCTION",
          actorId: production,
          reason: "سحب أمر الشغل على ماكينة الطباعة وبدء التشغيل الفعلي",
        },
      ];

    case "PRODUCTION_COMPLETED":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "إعداد ملفات الإنتاج وتجهيز الزنكات",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال الملفات الفنية",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "إرسال للمراجعة والتدقيق",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "اعتماد أوامر التشغيل الفنية",
        },
        {
          from: "APPROVED",
          to: "READY_FOR_PRODUCTION",
          actorId: reception,
          reason: "جدولة التشغيل بصالة الإنتاج",
        },
        {
          from: "READY_FOR_PRODUCTION",
          to: "IN_PRODUCTION",
          actorId: production,
          reason: "بدء الطباعة وسحب الكميات المطلوبة",
        },
        {
          from: "IN_PRODUCTION",
          to: "PRODUCTION_COMPLETED",
          actorId: production,
          reason: "اكتمال الطباعة والتشطيب والتكسير ومطابقة الجودة",
        },
      ];

    case "READY_FOR_COLLECTION":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "إعداد بروفات الطباعة",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال التصميم والتجهيز الفني",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "مراجعة وتدقيق التصميم",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "اعتماد ملفات الإنتاج النهائية",
        },
        {
          from: "APPROVED",
          to: "READY_FOR_PRODUCTION",
          actorId: reception,
          reason: "تحويل أمر الشغل للإنتاج الفعلي",
        },
        {
          from: "READY_FOR_PRODUCTION",
          to: "IN_PRODUCTION",
          actorId: production,
          reason: "بدء عمليات الطباعة والتشطيب",
        },
        {
          from: "IN_PRODUCTION",
          to: "PRODUCTION_COMPLETED",
          actorId: production,
          reason: "اكتمال الطباعة والتغليف النهائي",
        },
        {
          from: "PRODUCTION_COMPLETED",
          to: "READY_FOR_COLLECTION",
          actorId: reception,
          reason: "استلام المطبوعات وتجهيزها في قسم التسليم وإشعار العميل",
        },
      ];

    case "DELIVERED":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "إعداد وتجهيز ملفات العمل",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال البروفة الفنية",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "إرسال للاعتماد الفني",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "اعتماد مواصفات التشغيل",
        },
        {
          from: "APPROVED",
          to: "READY_FOR_PRODUCTION",
          actorId: reception,
          reason: "تحويل لصالة الطباعة",
        },
        {
          from: "READY_FOR_PRODUCTION",
          to: "IN_PRODUCTION",
          actorId: production,
          reason: "بدء الطباعة على الماكينات",
        },
        {
          from: "IN_PRODUCTION",
          to: "PRODUCTION_COMPLETED",
          actorId: production,
          reason: "اكتمال الطباعة والقص النهائي",
        },
        {
          from: "PRODUCTION_COMPLETED",
          to: "READY_FOR_COLLECTION",
          actorId: reception,
          reason: "جاهز للتسليم في المعرض",
        },
        {
          from: "READY_FOR_COLLECTION",
          to: "DELIVERED",
          actorId: delivery,
          reason: "تم تسليم الطلب للعميل واستلام إشعار الاستلام المعتمد",
        },
      ];

    case "COMPLETED":
      return [
        {
          from: "NEW",
          to: "ASSIGNED",
          actorId: reception,
          reason: "إسناد أمر الشغل للمصمم",
        },
        {
          from: "ASSIGNED",
          to: "IN_DESIGN",
          actorId: designer,
          reason: "إعداد وتجهيز ملفات العمل",
        },
        {
          from: "IN_DESIGN",
          to: "DESIGN_COMPLETED",
          actorId: designer,
          reason: "اكتمال التصميم والتجهيز الفني",
        },
        {
          from: "DESIGN_COMPLETED",
          to: "WAITING_REVIEW",
          actorId: designer,
          reason: "مراجعة الجودة الفنية",
        },
        {
          from: "WAITING_REVIEW",
          to: "APPROVED",
          actorId: headDesigner,
          reason: "اعتماد البروفة الفنية",
        },
        {
          from: "APPROVED",
          to: "READY_FOR_PRODUCTION",
          actorId: reception,
          reason: "تحويل لصالة الطباعة",
        },
        {
          from: "READY_FOR_PRODUCTION",
          to: "IN_PRODUCTION",
          actorId: production,
          reason: "تشغيل الطباعة والتشطيب",
        },
        {
          from: "IN_PRODUCTION",
          to: "PRODUCTION_COMPLETED",
          actorId: production,
          reason: "اكتمال المطبوعات وفحص الجودة",
        },
        {
          from: "PRODUCTION_COMPLETED",
          to: "READY_FOR_COLLECTION",
          actorId: reception,
          reason: "تجهيز الطلب للتسليم",
        },
        {
          from: "READY_FOR_COLLECTION",
          to: "DELIVERED",
          actorId: delivery,
          reason: "تم تسليم المطبوعات للعميل بنجاح",
        },
        {
          from: "DELIVERED",
          to: "COMPLETED",
          actorId: accounting,
          reason: "تمت تسوية الفاتورة وسداد كامل القيمة وإغلاق أمر الشغل",
        },
      ];

    default:
      return [];
  }
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to PostgreSQL for timeline backfill...");

  try {
    // 1. Fetch all orders and work items
    const ordersRes = await client.query(`SELECT * FROM "Order" ORDER BY "createdAt" ASC;`);
    const wisRes = await client.query(`SELECT * FROM "WorkItem" ORDER BY "createdAt" ASC;`);

    console.log(`Found ${ordersRes.rows.length} orders and ${wisRes.rows.length} work items.`);

    // 2. Clear existing demo transitions and phase timings
    console.log("Cleaning existing demo WorkItemTransition and PhaseTiming rows...");
    await client.query(`
      DELETE FROM "WorkItemTransition" WHERE "workItemId" LIKE 'wi_demo_%';
      DELETE FROM "PhaseTiming" WHERE "workItemId" LIKE 'wi_demo_%';
    `);

    const now = new Date();

    const transitionRows = [];
    const phaseTimingRows = [];
    const auditRows = [];

    // 3. Prepare Audit Events for Order creation
    for (const order of ordersRes.rows) {
      const orderCreatedAuditId = `audit_ord_${order.id}`;
      auditRows.push([
        orderCreatedAuditId,
        order.createdById || "seed_user_reception",
        "order.created",
        "Order",
        order.id,
        null,
        JSON.stringify({
          source: "reception",
          orderNumber: order.number,
          customerId: order.customerId,
          channel: order.channel,
          priority: order.priority,
        }),
        "إنشاء طلب جديد في صالة الاستقبال",
        order.createdAt,
      ]);
    }

    // 4. Build transitions and phase timings for all work items
    for (let wiIndex = 0; wiIndex < wisRes.rows.length; wiIndex++) {
      const wi = wisRes.rows[wiIndex];
      const designerId = wi.assigneeId || "seed_user_designer";
      const steps = buildTransitions(wi.state, { designerId });

      const createdAtMs = new Date(wi.createdAt).getTime();
      const endTimeMs = Math.min(now.getTime() - 10 * 60 * 1000, createdAtMs + 46 * 3600 * 1000);
      const totalSpan = Math.max(endTimeMs - createdAtMs, (steps.length + 1) * 20 * 60 * 1000);

      let currentPhaseStart = new Date(createdAtMs);

      if (steps.length === 0) {
        // Item is in NEW state
        const ptId = `pt_${wi.id}_0`;
        phaseTimingRows.push([
          ptId,
          wi.id,
          "NEW",
          null,
          "QUEUE",
          currentPhaseStart,
          null,
        ]);
        continue;
      }

      // Generate step timestamps
      const timestamps = steps.map((_, i) => {
        const fraction = (i + 1) / (steps.length + 0.5);
        return new Date(createdAtMs + Math.round(totalSpan * fraction));
      });

      for (let sIdx = 0; sIdx < steps.length; sIdx++) {
        const step = steps[sIdx];
        const stepAt = timestamps[sIdx];
        const transitionId = `tr_${wi.id}_${sIdx + 1}`;

        transitionRows.push([
          transitionId,
          wi.id,
          step.from,
          step.to,
          step.actorId,
          stepAt,
          step.reason || null,
          step.rejectionCategory || null,
        ]);

        const prevPtId = `pt_${wi.id}_${sIdx}`;
        const prevKind = (step.from === "IN_DESIGN" || step.from === "IN_PRODUCTION") ? "ACTIVE" : "QUEUE";
        const prevUserId = (step.from === "IN_DESIGN") ? designerId : (step.from === "IN_PRODUCTION" ? "seed_user_production" : null);

        phaseTimingRows.push([
          prevPtId,
          wi.id,
          step.from,
          prevUserId,
          prevKind,
          currentPhaseStart,
          stepAt,
        ]);

        currentPhaseStart = stepAt;

        // Audit row for transition
        const auditWiId = `audit_wi_${wi.id}_${sIdx + 1}`;
        auditRows.push([
          auditWiId,
          step.actorId,
          "workitem.transition",
          "WorkItem",
          wi.id,
          JSON.stringify({ state: step.from }),
          JSON.stringify({ state: step.to }),
          step.reason,
          stepAt,
        ]);

        if (sIdx === steps.length - 1) {
          const activePtId = `pt_${wi.id}_${sIdx + 1}`;
          const activeKind = (step.to === "IN_DESIGN" || step.to === "IN_PRODUCTION") ? "ACTIVE" : "QUEUE";
          const activeUserId = (step.to === "IN_DESIGN") ? designerId : (step.to === "IN_PRODUCTION" ? "seed_user_production" : null);

          phaseTimingRows.push([
            activePtId,
            wi.id,
            step.to,
            activeUserId,
            activeKind,
            currentPhaseStart,
            null,
          ]);
        }
      }
    }

    console.log(`Generated:
- ${transitionRows.length} WorkItemTransition records
- ${phaseTimingRows.length} PhaseTiming records
- ${auditRows.length} audit_event records`);

    // Helper for chunked batch insert
    async function batchInsert(tableName, columns, rows, onConflict = "") {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const colList = columns.map(c => `"${c}"`).join(", ");
        const valuesClauses = [];
        const params = [];
        let pIdx = 1;

        for (const row of chunk) {
          const placeholders = row.map(() => `$${pIdx++}`).join(", ");
          valuesClauses.push(`(${placeholders})`);
          params.push(...row);
        }

        const query = `
          INSERT INTO "${tableName}" (${colList})
          VALUES ${valuesClauses.join(", ")}
          ${onConflict};
        `;
        await client.query(query, params);
      }
    }

    console.log("Inserting WorkItemTransition rows...");
    await batchInsert(
      "WorkItemTransition",
      ["id", "workItemId", "from", "to", "actorId", "at", "reason", "rejectionCategory"],
      transitionRows,
      'ON CONFLICT ("id") DO NOTHING'
    );

    console.log("Inserting PhaseTiming rows...");
    await batchInsert(
      "PhaseTiming",
      ["id", "workItemId", "phase", "userId", "kind", "startedAt", "endedAt"],
      phaseTimingRows,
      'ON CONFLICT ("id") DO NOTHING'
    );

    console.log("Inserting audit_event rows...");
    await batchInsert(
      "audit_event",
      ["id", "actorId", "action", "entityType", "entityId", "before", "after", "reason", "createdAt"],
      auditRows,
      'ON CONFLICT ("id") DO NOTHING'
    );

    console.log("✓ All records successfully inserted!");

    // Final database verification
    const finalCounts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM "Order") as orders,
        (SELECT COUNT(*) FROM "WorkItem") as work_items,
        (SELECT COUNT(*) FROM "WorkItemTransition") as transitions,
        (SELECT COUNT(*) FROM "PhaseTiming") as phase_timings,
        (SELECT COUNT(*) FROM "audit_event") as audit_events;
    `);
    console.log("Current Database Totals:", finalCounts.rows[0]);

  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
