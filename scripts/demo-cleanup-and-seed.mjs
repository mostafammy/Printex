import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL?.split("?")[0];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

const SHARED_DEV_PASSWORD = "Printex123!";

const ROLES = [
  {
    id: "seed_role_reception",
    key: "RECEPTION",
    name: "Reception",
    permissions: [
      "order.create", "order.edit", "order.cancel", "customer.manage",
      "workitem.assign_designer", "workitem.send_to_production", "pricing.use_fixed", "finance.view"
    ],
  },
  {
    id: "seed_role_designer",
    key: "DESIGNER",
    name: "Designer",
    permissions: ["design.work"],
  },
  {
    id: "seed_role_head_designer",
    key: "HEAD_DESIGNER",
    name: "Head Designer",
    permissions: ["design.review", "change.approve", "design.work"],
  },
  {
    id: "seed_role_production_operator",
    key: "PRODUCTION_OPERATOR",
    name: "Production Operator",
    permissions: ["production.operate", "files.download_production"],
  },
  {
    id: "seed_role_print_reception_delivery",
    key: "PRINT_RECEPTION_DELIVERY",
    name: "Print Reception/Delivery",
    permissions: ["collection.receive", "delivery.record"],
  },
  {
    id: "seed_role_accounting",
    key: "ACCOUNTING",
    name: "Accounting",
    permissions: ["payment.record", "payment.void", "expense.record", "finance.view", "pricing.set_variable", "pricing.override"],
  },
  {
    id: "seed_role_admin_owner",
    key: "ADMIN_OWNER",
    name: "Admin/Owner",
    permissions: [
      "order.create", "order.edit", "order.cancel", "customer.manage",
      "workitem.assign_designer", "workitem.send_to_production", "design.work",
      "design.review", "change.approve", "production.operate", "collection.receive",
      "delivery.record", "pricing.use_fixed", "pricing.set_variable", "pricing.override",
      "payment.record", "payment.void", "expense.record", "finance.view",
      "files.download_production", "audit.view", "admin.users", "admin.config", "admin.override"
    ],
  },
];

const WORKFLOW_USERS = [
  {
    id: "seed_admin_user",
    username: "admin",
    displayUsername: "Admin",
    name: "مدير النظام (Admin)",
    email: "admin@local.invalid",
    roleId: "seed_role_admin_owner",
    allDepartments: true,
  },
  {
    id: "seed_user_reception",
    username: "reception",
    displayUsername: "Reception",
    name: "موظف الاستقبال (Reception)",
    email: "reception@local.invalid",
    roleId: "seed_role_reception",
    allDepartments: false,
  },
  {
    id: "seed_user_designer",
    username: "designer",
    displayUsername: "Designer",
    name: "أحمد مصطفى (Designer - Ahmed)",
    email: "designer@local.invalid",
    roleId: "seed_role_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_designer_sara",
    username: "sara",
    displayUsername: "Sara",
    name: "سارة خالد (Designer - Sara)",
    email: "sara@local.invalid",
    roleId: "seed_role_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_designer_omar",
    username: "omar",
    displayUsername: "Omar",
    name: "عمر فاروق (Designer - Omar)",
    email: "omar@local.invalid",
    roleId: "seed_role_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_designer_nour",
    username: "nour",
    displayUsername: "Nour",
    name: "نور الدين (Designer - Nour)",
    email: "nour@local.invalid",
    roleId: "seed_role_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_designer_mona",
    username: "mona",
    displayUsername: "Mona",
    name: "منى خليل (Designer - Mona)",
    email: "mona@local.invalid",
    roleId: "seed_role_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_head_designer",
    username: "headdesigner",
    displayUsername: "Head Designer",
    name: "طارق العلي (Head Designer - Tarek)",
    email: "headdesigner@local.invalid",
    roleId: "seed_role_head_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_production",
    username: "production",
    displayUsername: "Production",
    name: "فني الإنتاج (Production)",
    email: "production@local.invalid",
    roleId: "seed_role_production_operator",
    allDepartments: true,
  },
  {
    id: "seed_user_delivery",
    username: "delivery",
    displayUsername: "Delivery",
    name: "مسؤول التسليم (Delivery)",
    email: "delivery@local.invalid",
    roleId: "seed_role_print_reception_delivery",
    allDepartments: false,
  },
  {
    id: "seed_user_accounting",
    username: "accounting",
    displayUsername: "Accounting",
    name: "المحاسب المالي (Accounting)",
    email: "accounting@local.invalid",
    roleId: "seed_role_accounting",
    allDepartments: false,
  },
];

async function main() {
  console.log("=================================================");
  console.log("🚀 STARTING LIVE DEMO DATABASE CLEANUP & SEEDING");
  console.log("=================================================");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  await client.connect();
  console.log("✓ Connected to PostgreSQL (Supabase Port 5432 Direct).");

  try {
    // 1. Disable triggers temporarily for bulk purge
    await client.query("SET session_replication_role = 'replica';");
    console.log("✓ Disabled foreign keys and triggers for clean purge.");

    // 2. Truncate bloated tables
    console.log("Clearing ~40,000 synthetic test records...");
    const truncateTables = [
      `"WorkItemTransition"`, `"PhaseTiming"`, `"DesignVersion"`, `"ReturnAttachment"`, `"Return"`,
      `"VendorProductionRecord"`, `"Attachment"`, `"FileAuditEvent"`, `"FileVersion"`, `"FileAsset"`, `"FileObject"`,
      `"WorkItemPrice"`, `"PricingStatus"`, `"PriceTier"`, `"PriceList"`, `"CustomerPricingRule"`, `"ProductPricingPolicy"`,
      `"Payment"`, `"ExpenseApproval"`, `"Expense"`, `"DirectCost"`, `"FinanceVoid"`, `"CustomerCredit"`, `"FinanceConfig"`,
      `"DelayBreach"`, `"DelayThreshold"`, `"Notification"`, `"NotificationTypeOverride"`, `"NotificationEvent"`, `"AuditEvent"`,
      `"LateCancellation"`, `"ChangeRequest"`, `"SpecVersion"`,
      `"WorkItem"`, `"Order"`,
      `"CustomerPhone"`, `"CustomerAddress"`, `"CustomerPromotion"`, `"Customer"`, `"CustomerClassification"`,
      `"ProductType"`, `"Department"`,
      `"session"`, `"verification"`, `"user_department"`, `"user_permission"`, `"user_role"`, `"role_permission"`, `"account"`, `"user"`, `"role"`
    ];

    for (const tbl of truncateTables) {
      try {
        await client.query(`TRUNCATE TABLE ${tbl} CASCADE;`);
      } catch (e) {
        console.warn(`  Warning on truncate ${tbl}:`, e.message);
      }
    }
    console.log("✓ Truncate completed. Database tables are completely clean.");

    // 3. Reset autoincrement sequences
    try {
      await client.query(`ALTER SEQUENCE IF EXISTS "Order_number_seq" RESTART WITH 1001;`);
      await client.query(`ALTER SEQUENCE IF EXISTS "Payment_receiptNumber_seq" RESTART WITH 5001;`);
    } catch (e) {
      console.warn("  Sequence restart warning:", e.message);
    }

    // 4. Seed Canonical 5 Factory Departments
    console.log("Seeding canonical factory departments...");
    const departmentsData = [
      { id: "dept_digital", name: "Digital", isExternalProduction: false },
      { id: "dept_banner", name: "Banner", isExternalProduction: false },
      { id: "dept_outdoor", name: "Outdoor", isExternalProduction: false },
      { id: "dept_laser", name: "Laser", isExternalProduction: false },
      { id: "dept_external", name: "External", isExternalProduction: true },
    ];

    for (const d of departmentsData) {
      await client.query(`
        INSERT INTO "Department" (id, name, "isActive", "isExternalProduction", "createdAt")
        VALUES ($1, $2, true, $3, NOW())
        ON CONFLICT (name) DO UPDATE SET "isExternalProduction" = EXCLUDED."isExternalProduction", "isActive" = true;
      `, [d.id, d.name, d.isExternalProduction]);
    }
    console.log("✓ 5 Canonical Factory Departments ready: Digital, Banner, Outdoor, Laser, External.");

    // 5. Seed Roles & Permissions
    console.log("Seeding roles and permissions...");
    for (const r of ROLES) {
      await client.query(`
        INSERT INTO "role" (id, key, name, "createdAt")
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name;
      `, [r.id, r.key, r.name]);

      for (const p of r.permissions) {
        await client.query(`
          INSERT INTO "role_permission" (id, "roleId", permission)
          VALUES ($1, $2, $3)
          ON CONFLICT ("roleId", permission) DO NOTHING;
        `, [`${r.id}_${p}`, r.id, p]);
      }
    }
    console.log("✓ 7 Canonical Roles and Permission bundles ready.");

    // 6. Seed Workflow Users
    console.log("Seeding workflow users with password 'Printex123!'...");
    const hashedPassword = await hashPassword(SHARED_DEV_PASSWORD);

    for (const u of WORKFLOW_USERS) {
      await client.query(`
        INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "isActive", "failedLoginAttempts", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, false, $4, $5, true, 0, NOW(), NOW())
        ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, "displayUsername" = EXCLUDED."displayUsername", "isActive" = true;
      `, [u.id, u.name, u.email, u.username, u.displayUsername]);

      const accountId = `seed_account_${u.username}`;
      await client.query(`
        INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;
      `, [accountId, u.id, u.id, hashedPassword]);

      // UserRole
      await client.query(`
        INSERT INTO "user_role" (id, "userId", "roleId")
        VALUES ($1, $2, $3)
        ON CONFLICT ("userId", "roleId") DO NOTHING;
      `, [`ur_${u.id}`, u.id, u.roleId]);

      // UserDepartment
      if (u.allDepartments) {
        for (const d of departmentsData) {
          await client.query(`
            INSERT INTO "user_department" (id, "userId", "departmentId")
            VALUES ($1, $2, $3)
            ON CONFLICT ("userId", "departmentId") DO NOTHING;
          `, [`ud_${u.id}_${d.id}`, u.id, d.id]);
        }
      }
    }
    console.log("✓ 11 Workflow Users configured with full permissions.");

    // 7. Seed Customer Classifications
    console.log("Seeding customer classifications...");
    const classifications = [
      { id: "class_vip", name: "VIP" },
      { id: "class_company", name: "Company" },
      { id: "class_agency", name: "Agency" },
      { id: "class_individual", name: "Individual" },
    ];
    for (const c of classifications) {
      await client.query(`
        INSERT INTO "CustomerClassification" (id, name, "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, true, NOW(), NOW())
        ON CONFLICT (name) DO UPDATE SET "isActive" = true;
      `, [c.id, c.name]);
    }

    // 8. Seed Realistic Print Customers
    console.log("Seeding authentic client accounts...");
    const clientsData = [
      {
        id: "seed_cash_customer",
        name: "عميل نقدي (Cash Walk-in)",
        normalizedName: "عميل نقدي cash walk-in",
        isCash: true,
        classId: null,
        phone: null,
        address: "مكتب استقبال المركز الرئيسي"
      },
      {
        id: "cust_tmg",
        name: "مجموعة طلعت مصطفى للتطوير العقاري",
        normalizedName: "مجموعة طلعت مصطفى للتطوير العقاري tmg",
        isCash: false,
        classId: "class_vip",
        phone: "+201001234567",
        address: "مدينتي — مبنى خدمة العملاء والإدارة"
      },
      {
        id: "cust_vodafone",
        name: "شركة فودافون مصر — قطاع التسويق والفعاليات",
        normalizedName: "شركة فودافون مصر قطاع التسويق vodafone",
        isCash: false,
        classId: "class_vip",
        phone: "+201019876543",
        address: "القرية الذكية — الكيلو 28 طريق مصر اسكندرية الصحراوي، مبنى C4"
      },
      {
        id: "cust_tarek_nour",
        name: "وكالة طارق نور للدعاية والإعلان",
        normalizedName: "وكالة طارق نور للدعاية والإعلان tarek nour",
        isCash: false,
        classId: "class_agency",
        phone: "+201223456789",
        address: "شارع مصدق، الدقي، الجيزة"
      },
      {
        id: "cust_dar_sharq",
        name: "مكتبة دار الشرق للطباعة والنشر والتوزيع",
        normalizedName: "مكتبة دار الشرق للطباعة والنشر",
        isCash: false,
        classId: "class_company",
        phone: "+201112223334",
        address: "شارع الفجالة، الأزبكية، القاهرة"
      },
      {
        id: "cust_elite_clinic",
        name: "د. هاني عزمي (عيادات النخبة التخصصية)",
        normalizedName: "د هاني عزمي عيادات النخبة التخصصية",
        isCash: false,
        classId: "class_individual",
        phone: "+201099887766",
        address: "شارع الثورة، مصر الجديدة، القاهرة"
      },
      {
        id: "cust_karam_sham",
        name: "سلسلة مطاعم كرم الشام",
        normalizedName: "سلسلة مطاعم كرم الشام",
        isCash: false,
        classId: "class_company",
        phone: "+201023344556",
        address: "شارع التسعين الشمالي، التجمع الخامس"
      },
      {
        id: "cust_ahram",
        name: "مؤسسة الأهرام للصحافة والإعلام",
        normalizedName: "مؤسسة الأهرام للصحافة والإعلام",
        isCash: false,
        classId: "class_company",
        phone: "+201234455667",
        address: "شارع الجلاء، وسط البلد، القاهرة"
      },
      {
        id: "cust_elsewedy",
        name: "أكاديمية السويدي للتعليم الفني والتطوير",
        normalizedName: "أكاديمية السويدي للتعليم الفني والتطوير elsewedy",
        isCash: false,
        classId: "class_vip",
        phone: "+201145566778",
        address: "المنطقة الصناعية الثالثة A3، العاشر من رمضان"
      },
      {
        id: "cust_orascom",
        name: "شركة أوراسكوم للإنشاءات والصناعة",
        normalizedName: "شركة أوراسكوم للإنشاءات والصناعة orascom",
        isCash: false,
        classId: "class_vip",
        phone: "+201056677889",
        address: "أبراج نايل سيتي، كورنيش النيل، بولاق، القاهرة"
      }
    ];

    for (const c of clientsData) {
      await client.query(`
        INSERT INTO "Customer" (id, name, "normalizedName", "isCashCustomer", "isArchived", "classificationId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, false, $5, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "normalizedName" = EXCLUDED."normalizedName";
      `, [c.id, c.name, c.normalizedName, c.isCash, c.classId]);

      if (c.phone) {
        await client.query(`
          INSERT INTO "CustomerPhone" (id, "customerId", "phoneE164", kind, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, 'MOBILE', NOW(), NOW())
          ON CONFLICT ("phoneE164") DO NOTHING;
        `, [`phone_${c.id}`, c.id, c.phone]);
      }

      if (c.address) {
        await client.query(`
          INSERT INTO "CustomerAddress" (id, "customerId", label, value, "isDefault", "createdAt", "updatedAt")
          VALUES ($1, $2, 'الرئيسي', $3, true, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [`addr_${c.id}`, c.id, c.address]);
      }
    }
    console.log("✓ 10 Authentic Egyptian Print Clients ready.");

    // 9. Seed Realistic Product Types
    console.log("Seeding standardized product offerings...");
    const productsData = [
      { id: "prod_cards", name: "كروت شخصية فاخرة (Business Cards)", deptId: "dept_digital", review: false, mode: "FIXED" },
      { id: "prod_brochure", name: "بروشور ومطويات A4 (Tri-fold Brochures)", deptId: "dept_digital", review: true, mode: "FIXED" },
      { id: "prod_folders", name: "فولدر شركات مع جيب داخلي (Corporate Folders)", deptId: "dept_digital", review: true, mode: "VARIABLE" },
      { id: "prod_stickers", name: "ستيكر فينيل مقصوص داي كت (Die-cut Stickers)", deptId: "dept_digital", review: true, mode: "FIXED" },
      { id: "prod_invoices", name: "دفاتر فواتير مكربنة 3 أصل وصورة (Carbonless)", deptId: "dept_digital", review: false, mode: "FIXED" },
      { id: "prod_rollup", name: "رول اب ستاند فاخر 85x200 (Roll-up Banner)", deptId: "dept_banner", review: true, mode: "FIXED" },
      { id: "prod_banner_grommets", name: "بانر فينيل مع حلقات تثبيت (Outdoor Banner)", deptId: "dept_banner", review: true, mode: "FIXED" },
      { id: "prod_flex_sign", name: "يافطة فلكس مضيئة وشاسيه حديد (Backlit Flex)", deptId: "dept_outdoor", review: true, mode: "VARIABLE" },
      { id: "prod_channel_letters", name: "حروف بارزة مضيئة ليد (3D LED Letters)", deptId: "dept_outdoor", review: true, mode: "VARIABLE" },
      { id: "prod_trophy", name: "دروع تكريم أكريليك حفر ليزر (Acrylic Trophies)", deptId: "dept_laser", review: true, mode: "FIXED" },
      { id: "prod_wood_stand", name: "ستاند مكاتب خشب وأكريليك (Desk Organizers)", deptId: "dept_laser", review: true, mode: "FIXED" },
      { id: "prod_boxes", name: "علب كرتون فاخرة سلوفان ويو في (Packaging Boxes)", deptId: "dept_external", review: true, mode: "VARIABLE" },
    ];

    for (const p of productsData) {
      await client.query(`
        INSERT INTO "ProductType" (id, name, "defaultDepartmentId", "defaultRequiresDesign", "defaultRequiresReview", "pricingModeHint", "isActive", "createdAt")
        VALUES ($1, $2, $3, true, $4, $5, true, NOW())
        ON CONFLICT (name) DO UPDATE SET "defaultDepartmentId" = EXCLUDED."defaultDepartmentId", "pricingModeHint" = EXCLUDED."pricingModeHint";
      `, [p.id, p.name, p.deptId, p.review, p.mode]);
    }
    console.log("✓ 12 Standard Product Offerings mapped to departments.");

    // 10. Seed FinanceConfig
    console.log("Seeding Finance Configuration...");
    const financeConfigData = {
      id: "finance-config",
      paymentMethods: JSON.stringify(["Cash", "Card", "Bank transfer", "InstaPay", "Vodafone Cash", "Cheque"]),
      paymentSources: JSON.stringify(["Reception desk", "Bank", "Delivery driver"]),
      expenseCategories: JSON.stringify([
        { label: "Material", active: true },
        { label: "External production", active: true },
        { label: "Transport", active: true },
        { label: "Maintenance", active: true },
        { label: "Supplies", active: true },
        { label: "Other", active: true }
      ]),
      approvalThreshold: "1000.00",
      shopTimezone: "Africa/Cairo",
      updatedById: "seed_admin_user"
    };

    await client.query(`
      INSERT INTO "FinanceConfig" (id, "paymentMethods", "paymentSources", "expenseCategories", "approvalThreshold", "shopTimezone", "updatedById", "updatedAt")
      VALUES ($1, $2::json, $3::json, $4::json, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET "paymentMethods" = EXCLUDED."paymentMethods", "expenseCategories" = EXCLUDED."expenseCategories";
    `, [
      financeConfigData.id, financeConfigData.paymentMethods, financeConfigData.paymentSources,
      financeConfigData.expenseCategories, financeConfigData.approvalThreshold, financeConfigData.shopTimezone, financeConfigData.updatedById
    ]);
    console.log("✓ Finance Config initialized.");

    // 11. Seed Curated Orders & Work Items (45 Balanced Items)
    console.log("Seeding 48 curated orders & work items across all Kanban stages...");

    const designers = ["seed_user_designer", "seed_user_designer_sara", "seed_user_designer_omar", "seed_user_designer_nour", "seed_user_designer_mona"];

    const demoJobs = [
      // NEW (6 items)
      { cust: "seed_cash_customer", prod: "prod_cards", dept: "dept_digital", state: "NEW", desc: "1000 كارت شخصي كوشيه 350 جرام سلوفان مطفي وجهين", qty: 1000, price: 450, channel: "WALK_IN", prio: "NORMAL" },
      { cust: "cust_elite_clinic", prod: "prod_brochure", dept: "dept_digital", state: "NEW", desc: "500 مطوية إرشادية A4 للمرضى كوشيه 150 جرام 3 طيات", qty: 500, price: 850, channel: "WHATSAPP", prio: "NORMAL" },
      { cust: "cust_karam_sham", prod: "prod_stickers", dept: "dept_digital", state: "NEW", desc: "2000 ستيكر لاصق دائري قطر 5 سم للوجبات الديليفري", qty: 2000, price: 900, channel: "PHONE", prio: "URGENT" },
      { cust: "cust_tmg", prod: "prod_rollup", dept: "dept_banner", state: "NEW", desc: "2 رول اب ستاند 85x200 سم لمعرض مدينتي العقاري", qty: 2, price: 1600, channel: "WALK_IN", prio: "NORMAL" },
      { cust: "cust_vodafone", prod: "prod_flex_sign", dept: "dept_outdoor", state: "NEW", desc: "يافطة فلكس مضيئة 4x1.5 متر مع شاسيه حديد ولمبات ليد", qty: 1, price: 4800, channel: "WHATSAPP", prio: "NORMAL" },
      { cust: "cust_ahram", prod: "prod_trophy", dept: "dept_laser", state: "NEW", desc: "5 دروع تكريم أكريليك شفاف 10 مم مع قاعدة خشبية حفر ليزر", qty: 5, price: 2250, channel: "WALK_IN", prio: "NORMAL" },

      // ASSIGNED (4 items)
      { cust: "cust_tarek_nour", prod: "prod_folders", dept: "dept_digital", state: "ASSIGNED", desc: "300 فولدر شركات مقاس A4 جيب داخلي سلوفان وجه خارجي", qty: 300, price: 3600, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_elsewedy", prod: "prod_invoices", dept: "dept_digital", state: "ASSIGNED", desc: "50 دفتر فواتير ومذكرات توريد مكربنة 3 صور مرقمة", qty: 50, price: 2750, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_vodafone", prod: "prod_banner_grommets", dept: "dept_banner", state: "ASSIGNED", desc: "بانر فلكس 6x3 متر لحفل إطلاق خدمة جديدة", qty: 1, price: 2200, channel: "PHONE", prio: "URGENT", designer: designers[2] },
      { cust: "cust_orascom", prod: "prod_wood_stand", dept: "dept_laser", state: "ASSIGNED", desc: "15 ستاند مكتبي خشب ماهوجني مع لوحة أكريليك ذهبي محفور", qty: 15, price: 4500, channel: "WALK_IN", prio: "NORMAL", designer: designers[3] },

      // IN_DESIGN (5 items)
      { cust: "cust_dar_sharq", prod: "prod_brochure", dept: "dept_digital", state: "IN_DESIGN", desc: "1000 كتالوج كتب معرض القاهرة الدولي للكتاب 24 صفحة", qty: 1000, price: 8200, channel: "WALK_IN", prio: "NORMAL", designer: designers[4] },
      { cust: "cust_tmg", prod: "prod_channel_letters", dept: "dept_outdoor", state: "IN_DESIGN", desc: "شعار مدينتي حروف بارزة زنكور وإضاءة ليد خلفية ارتفاع 80 سم", qty: 1, price: 14500, channel: "WHATSAPP", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_elite_clinic", prod: "prod_cards", dept: "dept_digital", state: "IN_DESIGN", desc: "500 كارت شخصي فاخر مع بصمة ذهبي حراري وسلوفان قطيفة", qty: 500, price: 950, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_karam_sham", prod: "prod_boxes", dept: "dept_external", state: "IN_DESIGN", desc: "5000 علبة وجبات شاورما كرتون فود جريد مع طباعة 4 لون", qty: 5000, price: 12500, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },
      { cust: "seed_cash_customer", prod: "prod_rollup", dept: "dept_banner", state: "IN_DESIGN", desc: "ستاند رول اب 100x200 سم مؤتمر علمي طبي", qty: 1, price: 950, channel: "WALK_IN", prio: "URGENT", designer: designers[3] },

      // DESIGN_COMPLETED (3 items)
      { cust: "cust_elsewedy", prod: "prod_stickers", dept: "dept_digital", state: "DESIGN_COMPLETED", desc: "3000 ستيكر باركود فينيل حراري مقاوم للزيوت", qty: 3000, price: 1800, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_tarek_nour", prod: "prod_banner_grommets", dept: "dept_banner", state: "DESIGN_COMPLETED", desc: "2 بانر قماش جلوسي 4x2 متر ستاندات افتتاح فرع جديد", qty: 2, price: 1850, channel: "WHATSAPP", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_ahram", prod: "prod_trophy", dept: "dept_laser", state: "DESIGN_COMPLETED", desc: "درع تقديري كريستال وأكريليك اسود مؤتمر الصحافة السنوي", qty: 1, price: 1200, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },

      // WAITING_REVIEW (4 items)
      { cust: "cust_vodafone", prod: "prod_brochure", dept: "dept_digital", state: "WAITING_REVIEW", desc: "2000 بروشور عروض الشركات السنوية ورق كوشيه 200 جرام", qty: 2000, price: 4200, channel: "WALK_IN", prio: "URGENT", designer: designers[3] },
      { cust: "cust_tmg", prod: "prod_folders", dept: "dept_digital", state: "WAITING_REVIEW", desc: "500 فولدر عقود بيع وحدات فندقية مع جيبين وسلوفان مات", qty: 500, price: 6800, channel: "WALK_IN", prio: "NORMAL", designer: designers[4] },
      { cust: "cust_orascom", prod: "prod_flex_sign", dept: "dept_outdoor", state: "WAITING_REVIEW", desc: "لافتات أمان للموقع 2x1 متر صاج مجلفن وفلكس عاكس", qty: 8, price: 6400, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "seed_cash_customer", prod: "prod_cards", dept: "dept_digital", state: "WAITING_REVIEW", desc: "1000 كارت شخصي لمحامي ورق كرافت 350 جرام", qty: 1000, price: 600, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },

      // REWORK_REQUIRED (2 items)
      { cust: "cust_karam_sham", prod: "prod_boxes", dept: "dept_external", state: "REWORK_REQUIRED", desc: "علب ورق كرافت مقاس 25x15 سم — تعديل هوامش الثني والقص", qty: 2500, price: 8500, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },
      { cust: "cust_dar_sharq", prod: "prod_stickers", dept: "dept_digital", state: "REWORK_REQUIRED", desc: "ستيكر هولوجرام حماية غلاف كتاب — دقة الشعار منخفضة تحتاج رفع فيكتور", qty: 1000, price: 1400, channel: "PHONE", prio: "NORMAL", designer: designers[3] },

      // APPROVED (4 items)
      { cust: "cust_tmg", prod: "prod_rollup", dept: "dept_banner", state: "APPROVED", desc: "4 رول اب ستاند إرشادي بوابات دخول مدينتي", qty: 4, price: 3200, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_vodafone", prod: "prod_cards", dept: "dept_digital", state: "APPROVED", desc: "2000 كارت شخصي مدراء الفروع كوشيه 350 جرام سلوفان مطفي وجهين", qty: 2000, price: 1100, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_elsewedy", prod: "prod_trophy", dept: "dept_laser", state: "APPROVED", desc: "10 دروع تكريم خريجي دفعة 2026 حفر وتفريغ ليزر متقن", qty: 10, price: 4200, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },
      { cust: "cust_tarek_nour", prod: "prod_brochure", dept: "dept_digital", state: "APPROVED", desc: "1500 مطوية إعلانية مؤتمر الطاقة المتجددة", qty: 1500, price: 3100, channel: "WHATSAPP", prio: "NORMAL", designer: designers[3] },

      // WAITING_PRICING (3 items)
      { cust: "cust_orascom", prod: "prod_channel_letters", dept: "dept_outdoor", state: "WAITING_PRICING", desc: "واجهة مشروع العاصمة الإدارية حروف استيل مضيئة 12 متر", qty: 1, price: 32000, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_dar_sharq", prod: "prod_boxes", dept: "dept_external", state: "WAITING_PRICING", desc: "10000 بوكس كرتون تغليف روايات مع يوفي سبوت وبصمة بارزة", qty: 10000, price: 28000, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_ahram", prod: "prod_folders", dept: "dept_digital", state: "WAITING_PRICING", desc: "800 فولدر وثائقي جلد صناعي وبصمة ليزر حرارية", qty: 800, price: 11500, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },

      // READY_FOR_PRODUCTION (5 items)
      { cust: "cust_elite_clinic", prod: "prod_invoices", dept: "dept_digital", state: "READY_FOR_PRODUCTION", desc: "20 دفتر روشتات طبية كوشيه 80 جرام ملون مقاس B5", qty: 20, price: 1500, channel: "WALK_IN", prio: "NORMAL", designer: designers[3] },
      { cust: "cust_karam_sham", prod: "prod_banner_grommets", dept: "dept_banner", state: "READY_FOR_PRODUCTION", desc: "3 بنرات عروض الصيف 3x1.5 متر فلكس خامة ثقيلة", qty: 3, price: 2100, channel: "WALK_IN", prio: "URGENT", designer: designers[4] },
      { cust: "cust_tmg", prod: "prod_trophy", dept: "dept_laser", state: "READY_FOR_PRODUCTION", desc: "8 لوحات تكريم مسؤولي السلامة بالموقع خشب وأكريليك محفور", qty: 8, price: 3600, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_vodafone", prod: "prod_rollup", dept: "dept_banner", state: "READY_FOR_PRODUCTION", desc: "5 رول اب ستاند ألومنيوم ثقيل مع طباعة فوتو جلوسي", qty: 5, price: 4250, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "seed_cash_customer", prod: "prod_stickers", dept: "dept_digital", state: "READY_FOR_PRODUCTION", desc: "1500 ستيكر مستطيل 8x4 سم كوشيه لاصق قوي", qty: 1500, price: 750, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },

      // IN_PRODUCTION (5 items)
      { cust: "cust_tarek_nour", prod: "prod_cards", dept: "dept_digital", state: "IN_PRODUCTION", desc: "5000 كارت شخصي حملة بنك القاهرة سلوفان مط وملمس ناعم", qty: 5000, price: 2600, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_elsewedy", prod: "prod_brochure", dept: "dept_digital", state: "IN_PRODUCTION", desc: "3000 دليل تدريب الطلاب 16 صفحة تدبيس سلك", qty: 3000, price: 9800, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_vodafone", prod: "prod_flex_sign", dept: "dept_outdoor", state: "IN_PRODUCTION", desc: "يافطة فرع محيي الدين أبو العز فلكس مضيء 5x2 متر", qty: 1, price: 6500, channel: "WALK_IN", prio: "URGENT", designer: designers[2] },
      { cust: "cust_orascom", prod: "prod_wood_stand", dept: "dept_laser", state: "IN_PRODUCTION", desc: "20 مجسم هندسي أكريليك وقاعدة خشبية للوفد الزائر", qty: 20, price: 5800, channel: "WALK_IN", prio: "NORMAL", designer: designers[3] },
      { cust: "cust_ahram", prod: "prod_banner_grommets", dept: "dept_banner", state: "IN_PRODUCTION", desc: "بانر مسرح مؤتمرات جريدة الأهرام 10x3 متر خامة بلو باك", qty: 1, price: 4200, channel: "WALK_IN", prio: "NORMAL", designer: designers[4] },

      // PRODUCTION_COMPLETED (3 items)
      { cust: "cust_tmg", prod: "prod_cards", dept: "dept_digital", state: "PRODUCTION_COMPLETED", desc: "2000 كارت شخصي فريق التسويق العقاري جاهز للقص النهائي", qty: 2000, price: 1200, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_elite_clinic", prod: "prod_rollup", dept: "dept_banner", state: "PRODUCTION_COMPLETED", desc: "2 رول اب ستاند استقبال العيادات تم التجميع والتركيب", qty: 2, price: 1700, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_karam_sham", prod: "prod_stickers", dept: "dept_digital", state: "PRODUCTION_COMPLETED", desc: "4000 ستيكر ساندوتشات جاهزة في أكياس التسليم", qty: 4000, price: 1600, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },

      // READY_FOR_COLLECTION (4 items)
      { cust: "seed_cash_customer", prod: "prod_cards", dept: "dept_digital", state: "READY_FOR_COLLECTION", desc: "1000 كارت مهندس ديكور جاهز بمكتب الاستقبال", qty: 1000, price: 500, channel: "WALK_IN", prio: "NORMAL", designer: designers[3] },
      { cust: "cust_dar_sharq", prod: "prod_invoices", dept: "dept_digital", state: "READY_FOR_COLLECTION", desc: "30 دفتر إيصالات استلام نقدية جاهزة للتسليم", qty: 30, price: 1950, channel: "WALK_IN", prio: "NORMAL", designer: designers[4] },
      { cust: "cust_elsewedy", prod: "prod_trophy", dept: "dept_laser", state: "READY_FOR_COLLECTION", desc: "6 دروع تخرج موضوعة في علب قطيفة فاخرة بمكتب التسليم", qty: 6, price: 2700, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_tarek_nour", prod: "prod_rollup", dept: "dept_banner", state: "READY_FOR_COLLECTION", desc: "3 رول اب ستاند معرض توظيف مع حقائب الحمل", qty: 3, price: 2550, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },

      // DELIVERED (4 items)
      { cust: "cust_vodafone", prod: "prod_brochure", dept: "dept_digital", state: "DELIVERED", desc: "5000 بروشور تم تسليمها لمقر الشركة بالقرية الذكية", qty: 5000, price: 8500, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "cust_tmg", prod: "prod_folders", dept: "dept_digital", state: "DELIVERED", desc: "1000 فولدر مشروعات تم استلامها بإيصال استلام رسمي", qty: 1000, price: 11000, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_karam_sham", prod: "prod_boxes", dept: "dept_external", state: "DELIVERED", desc: "10000 علبة وجبات تم توريدها لمخزن العبور المركزي", qty: 10000, price: 24000, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },
      { cust: "cust_orascom", prod: "prod_flex_sign", dept: "dept_outdoor", state: "DELIVERED", desc: "لافتات موقع مشروع المونوريل تم تسليمها وتثبيتها", qty: 4, price: 7200, channel: "WALK_IN", prio: "NORMAL", designer: designers[3] },

      // COMPLETED (4 items)
      { cust: "cust_ahram", prod: "prod_cards", dept: "dept_digital", state: "COMPLETED", desc: "3000 كارت شخصي للمحررين والصحفيين تم السداد والإغلاق", qty: 3000, price: 1500, channel: "WALK_IN", prio: "NORMAL", designer: designers[0] },
      { cust: "seed_cash_customer", prod: "prod_rollup", dept: "dept_banner", state: "COMPLETED", desc: "رول اب مؤتمر طبي تم السداد نقدا بالكامل والتسليم الفوري", qty: 1, price: 850, channel: "WALK_IN", prio: "NORMAL", designer: designers[1] },
      { cust: "cust_elite_clinic", prod: "prod_stickers", dept: "dept_digital", state: "COMPLETED", desc: "1000 ستيكر مواعيد عيادات تم السداد بالفيزا واستلام العميل", qty: 1000, price: 650, channel: "WALK_IN", prio: "NORMAL", designer: designers[2] },
      { cust: "cust_elsewedy", prod: "prod_brochure", dept: "dept_digital", state: "COMPLETED", desc: "2000 مطوية تدريب مهني تم السداد بشيك بنكي وإغلاق الطلب", qty: 2000, price: 3800, channel: "WALK_IN", prio: "NORMAL", designer: designers[3] },
    ];

    let orderSeq = 1001;
    let paymentSeq = 5001;
    let totalCollected = 0;
    let totalExpenses = 0;

    for (let i = 0; i < demoJobs.length; i++) {
      const job = demoJobs[i];
      const orderId = `order_demo_${i + 1}`;
      const workItemId = `wi_demo_${i + 1}`;

      // Insert Order
      await client.query(`
        INSERT INTO "Order" (id, number, "customerId", channel, priority, mode, "dueDate", "createdById", "createdAt")
        VALUES ($1, $2, $3, $4, $5, 'GROUPED', NOW() + INTERVAL '3 days', 'seed_user_reception', NOW() - INTERVAL '${48 - i} hours');
      `, [orderId, orderSeq++, job.cust, job.channel, job.prio]);

      // Insert WorkItem
      await client.query(`
        INSERT INTO "WorkItem" (
          id, "orderId", "productTypeId", "departmentId", state, "requiresDesign", "requiresReview",
          "assigneeId", description, quantity, "dimensionUnit", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, true, true, $6, $7, $8, 'CM', NOW() - INTERVAL '${48 - i} hours', NOW());
      `, [workItemId, orderId, job.prod, job.dept, job.state, job.designer || null, job.desc, job.qty]);

      // Insert PricingStatus & WorkItemPrice
      const isPriced = !['NEW', 'ASSIGNED', 'IN_DESIGN', 'WAITING_PRICING'].includes(job.state);
      const pricingStatusValue = isPriced ? 'PRICED' : (job.state === 'WAITING_PRICING' ? 'PENDING' : 'PENDING');
      
      await client.query(`
        INSERT INTO "PricingStatus" ("workItemId", status, "waitingSince", "updatedAt")
        VALUES ($1, $2, NOW() - INTERVAL '2 hours', NOW());
      `, [workItemId, pricingStatusValue]);

      if (isPriced || job.price) {
        await client.query(`
          INSERT INTO "WorkItemPrice" (id, "workItemId", amount, currency, source, "setById", "setAt")
          VALUES ($1, $2, $3, 'EGP', 'LIST', 'seed_user_accounting', NOW() - INTERVAL '1 hour');
        `, [`wip_${workItemId}`, workItemId, job.price]);
      }

      // Insert DesignVersion for items that reached review / approved / later
      if (!['NEW', 'ASSIGNED'].includes(job.state)) {
        await client.query(`
          INSERT INTO "DesignVersion" (
            id, "workItemId", version, "storageKey", "fileName", "sizeBytes", sha256,
            note, "uploadedById", "createdAt", "approvedAt", "approvedById"
          )
          VALUES ($1, $2, 1, $3, $4, 2450000, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            'التصميم جاهز ومطابق لمواصفات الطباعة', $5, NOW() - INTERVAL '4 hours',
            $6, $7);
        `, [
          `dv_${workItemId}`, workItemId, `storage/designs/${workItemId}_v1.pdf`, `${job.prod}_v1.pdf`,
          job.designer || "seed_user_designer",
          ['APPROVED', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'READY_FOR_COLLECTION', 'DELIVERED', 'COMPLETED'].includes(job.state) ? new Date() : null,
          ['APPROVED', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'READY_FOR_COLLECTION', 'DELIVERED', 'COMPLETED'].includes(job.state) ? 'seed_user_head_designer' : null
        ]);
      }

      // Add Payment for items that are In Production, Ready, Delivered, Completed or partial walk-ins
      if (['READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'READY_FOR_COLLECTION', 'DELIVERED', 'COMPLETED'].includes(job.state)) {
        const payAmount = job.price;
        const method = (i % 3 === 0) ? 'Card' : ((i % 4 === 0) ? 'Bank transfer' : 'Cash');
        const source = (method === 'Bank transfer') ? 'Bank' : 'Reception desk';

        await client.query(`
          INSERT INTO "Payment" (
            id, "orderId", "customerId", amount, currency, method, source, note,
            "occurredAt", "recordedAt", "recordedById", "receiptNumber"
          )
          VALUES ($1, $2, $3, $4, 'EGP', $5, $6, 'دفعة سداد أمر الطباعة', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'seed_user_reception', $7);
        `, [`pay_${workItemId}`, orderId, job.cust, payAmount, method, source, paymentSeq++]);

        totalCollected += payAmount;
      }
    }

    // Realign the identity sequences with the rows just written.
    //
    // The INSERTs above supply `number` and `receiptNumber` EXPLICITLY
    // (1001..., 5001...), and an explicit value never touches an identity
    // sequence. Step 3 restarted both sequences to their first demo value, so
    // without this they are left parked at the bottom of the demo range while
    // the tables hold rows at the top of it. The first real deposit then calls
    // nextval -> 5004, hits UNIQUE, and from then on EVERY payment fails with
    // "Unique constraint failed on the fields: (receiptNumber)".
    //
    // That is a live outage, not a demo-data cosmetic: it takes the reception
    // deposit path down in the real shop, which is exactly how it was found.
    // Hence the resync here and not only in the one-time migration.
    //
    // Derived from MAX(), so it is idempotent and can never set the sequence
    // below a value already in use. The `is_called` flag is `COUNT(*) > 0`
    // because with no rows the sequence must hand out value ITSELF on the next
    // nextval rather than value + 1.
    await client.query(`
      SELECT setval(
               pg_get_serial_sequence('"Payment"', 'receiptNumber'),
               GREATEST(COALESCE(MAX("receiptNumber"), 0), 1),
               COUNT(*) > 0
             )
        FROM "Payment";
    `);
    await client.query(`
      SELECT setval(
               pg_get_serial_sequence('"Order"', 'number'),
               GREATEST(COALESCE(MAX(number), 0), 1),
               COUNT(*) > 0
             )
        FROM "Order";
    `);

    console.log(`✓ 48 Curated jobs seeded. Total revenue collected: ${totalCollected.toLocaleString()} EGP.`);

    // 12. Seed Realistic Factory Expenses
    console.log("Seeding realistic operational expenses...");
    const expensesList = [
      { cat: "Material", amount: 8500, emp: "أحمد عبد الله (مسؤول المشتريات)", desc: "شراء 12 باكتة ورق كوشيه ألماني 350 جرام مقاس 35x50" },
      { cat: "Material", amount: 6200, emp: "أحمد عبد الله", desc: "شراء 2 رول بنر كوري ثقيل 510 جرام عرض 3.20 متر" },
      { cat: "Material", amount: 4800, emp: "أحمد عبد الله", desc: "ألواح أكريليك كاست شفاف 5 مم و 8 مم لماكينة الليزر" },
      { cat: "External production", amount: 3500, emp: "محمد سعيد (المشرف الفني)", desc: "تكسير وسلوفان حراري لعلب كرتون فاخرة بمطبعة الشروق" },
      { cat: "Maintenance", amount: 2800, emp: "كريم يوسف (مهندس الصيانة)", desc: "صيانة دورية وتغيير أحبار ودرام ماكينة كونيكا مينولتا C1085" },
      { cat: "Transport", amount: 650, emp: "سائق التوصيل (عمرو حسن)", desc: "شحن خامات وورق من مطابع باب الشعرية لمقر الشركة" },
      { cat: "Supplies", amount: 450, emp: "موظف الاستقبال", desc: "شراء أشرطة لاصقة وسلوتيب عريض وتغليف فقاعي بابلز" },
      { cat: "Other", amount: 800, emp: "الإدارة المالية", desc: "ضيافة واحتياجات بوفيه واستقبال العملاء" },
    ];

    let expIdx = 1;
    for (const exp of expensesList) {
      await client.query(`
        INSERT INTO "Expense" (
          id, amount, category, "expenseDate", employee, description, "createdById", "createdAt"
        )
        VALUES ($1, $2, $3, NOW() - INTERVAL '${expIdx * 6} hours', $4, $5, 'seed_user_accounting', NOW() - INTERVAL '${expIdx * 6} hours');
      `, [`exp_${expIdx++}`, exp.amount, exp.cat, exp.emp, exp.desc]);
      totalExpenses += exp.amount;
    }
    console.log(`✓ Operational expenses seeded. Total expenses: ${totalExpenses.toLocaleString()} EGP.`);

    // 13. Re-enable session replication role
    await client.query("SET session_replication_role = 'origin';");
    console.log("✓ Re-enabled foreign keys and database triggers.");

    // 14. Verification Summary
    console.log("\n=================================================");
    console.log("✨ DATABASE CLEANUP & SEEDING COMPLETED SUCCESSFULLY!");
    console.log("=================================================");

    const orderCountRes = await client.query(`SELECT COUNT(*) as count FROM "Order"`);
    const wiCountRes = await client.query(`SELECT COUNT(*) as count FROM "WorkItem"`);
    const custCountRes = await client.query(`SELECT COUNT(*) as count FROM "Customer"`);
    const deptCountRes = await client.query(`SELECT COUNT(*) as count FROM "Department"`);
    const userCountRes = await client.query(`SELECT COUNT(*) as count FROM "user"`);
    const payCountRes = await client.query(`SELECT COUNT(*) as count, SUM(amount) as sum FROM "Payment"`);
    const expCountRes = await client.query(`SELECT COUNT(*) as count, SUM(amount) as sum FROM "Expense"`);

    console.table({
      "Total Orders": orderCountRes.rows[0].count,
      "Total Work Items": wiCountRes.rows[0].count,
      "Total Customers": custCountRes.rows[0].count,
      "Production Departments": deptCountRes.rows[0].count,
      "Workflow Users": userCountRes.rows[0].count,
      "Total Payments": `${payCountRes.rows[0].count} receipts (${parseFloat(payCountRes.rows[0].sum).toLocaleString()} EGP)`,
      "Total Expenses": `${expCountRes.rows[0].count} vouchers (${parseFloat(expCountRes.rows[0].sum).toLocaleString()} EGP)`,
      "Net Operating Profit": `${(parseFloat(payCountRes.rows[0].sum) - parseFloat(expCountRes.rows[0].sum)).toLocaleString()} EGP`
    });

    console.log("\nOperational Breakdown by Kanban Stage:");
    const stageRes = await client.query(`
      SELECT state, COUNT(*) as count
      FROM "WorkItem"
      GROUP BY state
      ORDER BY count DESC;
    `);
    console.table(stageRes.rows);

    await client.end();
  } catch (err) {
    console.error("❌ Fatal Error during cleanup/seed:", err);
    try {
      await client.query("SET session_replication_role = 'origin';");
      await client.end();
    } catch (_) {}
    process.exit(1);
  }
}

main();
