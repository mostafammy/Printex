/**
 * Demo floor seed script for Feature 017: Press Floor Board.
 * (specs/017-press-floor-board/quickstart.md §2, tasks.md T179)
 *
 * Usage:
 *   node scripts/seed-board-demo.mjs
 *   node scripts/seed-board-demo.mjs --count 500
 */

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

// Parse CLI flags
function parseArgs() {
  const args = process.argv.slice(2);
  let count = 60;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" && args[i + 1]) {
      count = Math.max(10, parseInt(args[i + 1], 10) || 60);
      i++;
    }
  }
  return { count };
}

const NON_TERMINAL_STATES = [
  "NEW",
  "ASSIGNED",
  "IN_DESIGN",
  "REWORK_REQUIRED",
  "DESIGN_COMPLETED",
  "WAITING_REVIEW",
  "APPROVED",
  "WAITING_PRICING",
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION",
  "PRODUCTION_COMPLETED",
  "READY_FOR_COLLECTION",
  "DELIVERED",
];

const DEMO_CUSTOMER_NAMES = [
  "مطبعة الأهرام التجارية",
  "شركة الفجر للدعاية والإعلان",
  "وكالة النور للتسويق",
  "مؤسسة الأمل للطباعة الرقمية",
  "شركة البريق للهدايا والمطبوعات",
];

const ITEM_TITLES = [
  "رول اب ستاند فاخر",
  "كروت شخصية سيلوفان مطفي",
  "بروشور ثلاثي الطيات A4",
  "ستيكر فينيل لاصق مقاوم للماء",
  "يافطة محلات مضيئة خارجية",
  "لوحة كانفاس مشدودة خشب",
  "أكياس ورقية مطبوعة مقاس وسط",
  "فولدر شركات مع جيب داخلي",
  "بوستر إعلاني مقاس A2",
  "دفاتر فواتير مكربنة 3 أصل وصورة",
];

async function main() {
  const { count } = parseArgs();
  console.log(`[seed-board-demo] Seeding ${count} demo Work Items for Press Floor Board...`);

  // 1. Get or create Admin user for transitions
  let admin = await db.user.findFirst({ where: { username: "admin" } });
  if (!admin) {
    admin = await db.user.findFirst();
  }
  if (!admin) {
    throw new Error("No user found in database. Run `pnpm prisma db seed` first.");
  }

  // 2. Ensure departments exist
  const deptNames = ["Digital", "Banner", "Outdoor"];
  const departments = [];
  for (const name of deptNames) {
    const dept = await db.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    departments.push(dept);
  }

  // 3. Ensure demo customers exist
  const customers = [];
  for (let i = 0; i < DEMO_CUSTOMER_NAMES.length; i++) {
    const name = DEMO_CUSTOMER_NAMES[i];
    const customer = await db.customer.upsert({
      where: { id: `demo_cust_${i + 1}` },
      update: { name },
      create: {
        id: `demo_cust_${i + 1}`,
        name,
        normalizedName: name.toLowerCase(),
        isCashCustomer: false,
      },
    });
    customers.push(customer);
  }

  // 4. Ensure demo product types exist
  const productTypes = [];
  for (let i = 0; i < ITEM_TITLES.length; i++) {
    const pt = await db.productType.upsert({
      where: { name: ITEM_TITLES[i] },
      update: {},
      create: {
        name: ITEM_TITLES[i],
        defaultDepartmentId: departments[i % departments.length].id,
        defaultRequiresDesign: true,
        defaultRequiresReview: true,
      },
    });
    productTypes.push(pt);
  }

  // 5. Clean up previous demo items if any
  console.log("[seed-board-demo] Cleaning up previous demo items...");
  const oldDemoWorkItems = await db.workItem.findMany({
    where: { id: { startsWith: "demo_wi_" } },
    select: { id: true, orderId: true },
  });
  if (oldDemoWorkItems.length > 0) {
    const wiIds = oldDemoWorkItems.map((w) => w.id);
    const orderIds = [...new Set(oldDemoWorkItems.map((w) => w.orderId))];
    await db.workItemTransition.deleteMany({ where: { workItemId: { in: wiIds } } });
    await db.pricingStatus.deleteMany({ where: { workItemId: { in: wiIds } } });
    await db.workItem.deleteMany({ where: { id: { in: wiIds } } });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  // 6. Special Case A: 4-Item Order for Group Move (quickstart §2 & §3 step 10)
  // 4 items in READY_FOR_COLLECTION: 3 PRICED, 1 PENDING
  console.log("[seed-board-demo] Creating 4-item group move test order...");
  const groupOrder = await db.order.create({
    data: {
      customerId: customers[0].id,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: admin.id,
    },
  });

  for (let i = 0; i < 4; i++) {
    const wiId = `demo_wi_group_${i + 1}`;
    const isPriced = i < 3; // 3 priced, 1 pending
    await db.workItem.create({
      data: {
        id: wiId,
        orderId: groupOrder.id,
        state: "READY_FOR_COLLECTION",
        productTypeId: productTypes[i % productTypes.length].id,
        departmentId: departments[i % departments.length].id,
        description: `بند طلب مجمع #${i + 1}`,
        quantity: 50 * (i + 1),
        requiresDesign: true,
        requiresReview: true,
        transitions: {
          create: {
            from: "PRODUCTION_COMPLETED",
            to: "READY_FOR_COLLECTION",
            actorId: admin.id,
          },
        },
        pricingStatus: {
          create: {
            status: isPriced ? "PRICED" : "PENDING",
          },
        },
      },
    });
  }

  // 7. Special Case B: No-design item in NEW (quickstart §2 & §3 step 3)
  console.log("[seed-board-demo] Creating no-design NEW item...");
  const noDesignOrder = await db.order.create({
    data: {
      customerId: customers[1].id,
      channel: "WHATSAPP",
      priority: "NORMAL",
      mode: "SEPARATE",
      createdById: admin.id,
    },
  });
  await db.workItem.create({
    data: {
      id: "demo_wi_nodesign",
      orderId: noDesignOrder.id,
      state: "NEW",
      productTypeId: productTypes[0].id,
      departmentId: departments[0].id,
      description: "طباعة فورية بدون تصميم (جاهز للإنتاج)",
      quantity: 100,
      requiresDesign: false,
      requiresReview: false,
      transitions: {
        create: {
          from: "NEW",
          to: "NEW",
          actorId: admin.id,
        },
      },
      pricingStatus: {
        create: {
          status: "PRICED",
        },
      },
    },
  });

  // 8. Generate remaining Work Items up to `count`
  const remainingCount = Math.max(0, count - 5);
  console.log(`[seed-board-demo] Generating ${remainingCount} items across non-terminal states...`);

  // Create batch of orders
  const ordersNeeded = Math.ceil(remainingCount / 2);
  const createdOrders = [];
  for (let o = 0; o < ordersNeeded; o++) {
    const cust = customers[o % customers.length];
    const isUrgent = o % 5 === 0;
    const order = await db.order.create({
      data: {
        customerId: cust.id,
        channel: o % 3 === 0 ? "WALK_IN" : o % 3 === 1 ? "WHATSAPP" : "PHONE",
        priority: isUrgent ? "URGENT" : "NORMAL",
        mode: o % 2 === 0 ? "GROUPED" : "SEPARATE",
        createdById: admin.id,
      },
    });
    createdOrders.push(order);
  }

  for (let i = 0; i < remainingCount; i++) {
    const state = NON_TERMINAL_STATES[i % NON_TERMINAL_STATES.length];
    const order = createdOrders[Math.floor(i / 2)];
    const dept = departments[i % departments.length];
    const pt = productTypes[i % productTypes.length];
    const isPriced = i % 4 !== 0; // 75% priced, 25% pending
    const wiId = `demo_wi_item_${i + 1}`;

    await db.workItem.create({
      data: {
        id: wiId,
        orderId: order.id,
        state,
        productTypeId: pt.id,
        departmentId: dept.id,
        description: `${pt.name} - دفعة رقم ${i + 1}`,
        quantity: ((i % 10) + 1) * 25,
        requiresDesign: true,
        requiresReview: state !== "ASSIGNED" && state !== "NEW",
        assigneeId: state.includes("DESIGN") ? admin.id : null,
        transitions: {
          create: {
            from: "NEW",
            to: state,
            actorId: admin.id,
            at: new Date(Date.now() - (i + 1) * 3600000), // staggered times
          },
        },
        pricingStatus: {
          create: {
            status: isPriced ? "PRICED" : "PENDING",
          },
        },
      },
    });
  }

  console.log(`[seed-board-demo] Successfully seeded ${count} demo cards across all 7 stations!`);
}

main()
  .catch((err) => {
    console.error("[seed-board-demo] Seeding error:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
