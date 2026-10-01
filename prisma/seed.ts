// Dev seed script — spec.md FR-016, quickstart.md §1.
//
// Populates just enough data to poke around `pnpm prisma studio` and to run
// the quickstart's `transitionWorkItem`/`deriveOrderStatus` snippets against
// a real database: an admin `User` (Better Auth's table, identity.prisma),
// the five default production `Department`s, the singleton Cash `Customer`,
// and a small number of sample `Order` + `WorkItem` rows in varied
// `WorkItemState`s.
//
// Extended by 001-identity-access-audit:
//   - 7 roles and their permission bundles (the role × permission matrix from
//     data-model.md §"Seeded role × permission matrix")
//   - Admin/Owner dev user with username "admin" and the ADMIN_OWNER role
//
// Not part of `src/server/core/**` — the "core never throws" rule
// (eslint.config.js rule (c)) does not apply here. This is a plain dev
// script: it logs progress with `console.log` and lets any error crash the
// process with a non-zero exit code, which is exactly what you want from a
// seed script run by hand or in CI.
//
// Re-runnable by design: every write is an `upsert` (or, for the sample
// Order/WorkItem graph, an existence check) keyed on a stable seed id/value,
// so running `pnpm exec prisma db seed` twice in a row does not duplicate
// rows or fail on unique constraints.

// Explicit `/index.js` (not the bare directory) — running this file
// directly via `node prisma/seed.ts` (Node 22.6+'s built-in TypeScript
// stripping, no bundler in the loop) does not consult the generated
// client's `package.json#exports` map the way Next's bundler-mode resolver
// does for a plain `"../generated/prisma"` import elsewhere in this repo
// (e.g. src/server/db.ts).
import { Prisma, PrismaClient } from "../generated/prisma/index.js";
// Better Auth's own password hasher — ensures hashes produced here are
// verifiable by Better Auth's credential provider at runtime.
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();

const ADMIN_USER_ID = "seed_admin_user";
const DEPARTMENT_NAMES = ["Digital", "Banner", "Outdoor", "Laser", "External"] as const;
const CASH_CUSTOMER_ID = "seed_cash_customer";
const SAMPLE_CUSTOMER_ID = "seed_sample_customer";
const CLASSIFICATIONS = ["Individual", "Company", "Agency", "VIP"] as const;

// ---------------------------------------------------------------------------
// Role × permission matrix — data-model.md §"Seeded role × permission matrix"
// (authoritative source; SC-001's contract test asserts this exactly).
//
// IMPORTANT: pricing.set_variable and pricing.override are deliberately NOT
// seeded onto ACCOUNTING — they are granted per-user via UserPermission by an
// Admin when explicitly configuring a specific accounting user as a pricing
// user (spec FR-014, PRD §26, data-model.md footnote).
// ---------------------------------------------------------------------------
const ROLE_SEED_DATA = [
  {
    id: "seed_role_reception",
    key: "RECEPTION",
    name: "Reception",
    permissions: [
      "order.create",
      "order.edit",
      "order.cancel",
      "customer.manage",
      "workitem.assign_designer",
      "workitem.send_to_production",
      "collection.receive",
      "delivery.record",
      "pricing.use_fixed",
      "finance.view",
      // Reception takes the customer's money at the counter, so it must be able
      // to RECORD it — `finance.view` above is read-only and is not enough for
      // `recordPayment`. Granted by migration 20261001120000 as well, so a shop
      // provisioned by either route lands on the same matrix.
      "payment.record",
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
    // 012 Clarifications (2026-09-23): a shop MAY opt HEAD_DESIGNER into
    // reassignment by adding "workitem.assign_designer" here — data-model.md
    // "Seed data addition". Not added by default; no default behavior change.
    // 016 FR-013: change.approve added for change control approval.
    permissions: ["design.review", "change.approve"],
  },
  {
    id: "seed_role_production_operator",
    key: "PRODUCTION_OPERATOR",
    name: "Production Operator",
    // collection.receive + delivery.record: every edge out of
    // PRODUCTION_COMPLETED is gated on one of these, so without them the
    // printer sees مكتمل الإنتاج with zero available moves and cannot record a
    // hand-off. In this shop the printer also packs and delivers, alongside
    // reception. Granted by migration 20261001140000 as well, so a shop
    // provisioned by either route lands on the same matrix.
    permissions: [
      "production.operate",
      "files.download_production",
      "collection.receive",
      "delivery.record",
    ],
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
    // pricing.set_variable and pricing.override intentionally omitted — see
    // note above. Grant per-user via UserPermission for specific users.
    // 093 FR-014: workitem.approve_production is what makes ACCOUNTING the
    // stage that releases work to the printer. It is granted HERE and nowhere
    // else (RECEPTION deliberately does not get it) so the
    // RECEPTION → DESIGNER → ACCOUNTANT → PRINTER pipeline cannot be
    // short-circuited by the person who took the order.
    permissions: [
      "payment.record",
      "payment.void",
      "expense.record",
      "finance.view",
      "workitem.approve_production",
      "pricing.use_fixed",
      "pricing.set_variable",
      "pricing.override",
    ],
  },
  {
    id: "seed_role_admin_owner",
    key: "ADMIN_OWNER",
    name: "Admin/Owner",
    // All 24 permission keys — Admin/Owner has full access (016 FR-013,
    // 093 FR-014).
    permissions: [
      "order.create",
      "order.edit",
      "order.cancel",
      "customer.manage",
      "workitem.assign_designer",
      "workitem.send_to_production",
      "workitem.approve_production",
      "design.work",
      "design.review",
      "change.approve",
      "production.operate",
      "collection.receive",
      "delivery.record",
      "pricing.use_fixed",
      "pricing.set_variable",
      "pricing.override",
      "payment.record",
      "payment.void",
      "expense.record",
      "finance.view",
      "files.download_production",
      "audit.view",
      "admin.users",
      "admin.config",
      "admin.override",
    ],
  },
] as const;

async function seedRoles() {
  console.log("  seeding roles and permissions...");
  for (const role of ROLE_SEED_DATA) {
    const seededRole = await db.role.upsert({
      where: { id: role.id },
      update: {
        key: role.key,
        name: role.name,
      },
      create: {
        id: role.id,
        key: role.key,
        name: role.name,
      },
    });
    // Upsert each permission for this role (add if missing, keep if present).
    for (const permission of role.permissions) {
      await db.rolePermission.upsert({
        where: { roleId_permission: { roleId: seededRole.id, permission } },
        update: {},
        create: { roleId: seededRole.id, permission },
      });
    }
    console.log(
      `    role: ${seededRole.key} (${seededRole.id}) — ${role.permissions.length} permissions`,
    );
  }
}

async function seedAdminUser() {
  // ---------------------------------------------------------------------------
  // ⚠️  DEV-ONLY PASSWORD — never use in production.
  // To change: run the seed again with a different password constant below,
  // or reset via the Admin UI once it is built (T020).
  // ---------------------------------------------------------------------------
  const DEV_ADMIN_PASSWORD = "Printex123!"; // Uniform dev seed password

  // Hash using Better Auth's own hasher so the credential provider can verify
  // this password at login time without any additional configuration.
  const hashedPassword = await hashPassword(DEV_ADMIN_PASSWORD);
  const ADMIN_ACCOUNT_ID = "seed_admin_account";

  const user = await db.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: {
      // Update fields added by 001 on subsequent seed runs.
      username: "admin",
      displayUsername: "Admin",
      isActive: true,
    },
    create: {
      id: ADMIN_USER_ID,
      name: "Admin",
      // Synthetic email placeholder per research.md — never surfaced in UI.
      email: "admin@local.invalid",
      emailVerified: false,
      username: "admin",
      displayUsername: "Admin",
      isActive: true,
      failedLoginAttempts: 0,
    },
  });

  // Credential Account — Better Auth stores passwords in the Account table
  // with providerId="credential". The accountId is the user's identifier
  // within that provider (Better Auth uses the userId as accountId for
  // credentials by convention).
  await db.account.upsert({
    where: { id: ADMIN_ACCOUNT_ID },
    update: {
      // Re-hash on every seed run so the dev password stays current.
      password: hashedPassword,
    },
    create: {
      id: ADMIN_ACCOUNT_ID,
      accountId: ADMIN_USER_ID,
      providerId: "credential",
      userId: ADMIN_USER_ID,
      password: hashedPassword,
    },
  });

  // Assign ADMIN_OWNER role to the admin user (idempotent upsert).
  const adminOwnerRole = await db.role.findUniqueOrThrow({
    where: { id: "seed_role_admin_owner" },
  });
  await db.userRole.upsert({
    where: {
      userId_roleId: { userId: ADMIN_USER_ID, roleId: adminOwnerRole.id },
    },
    update: {},
    create: { userId: ADMIN_USER_ID, roleId: adminOwnerRole.id },
  });

  console.log(
    `  user: ${user.username} / ${user.email} (${user.id}) — ADMIN_OWNER role assigned`,
  );
  return user;
}

const WORKFLOW_DEV_USERS = [
  {
    id: "seed_user_reception",
    username: "reception",
    displayUsername: "Reception",
    name: "موظف الاستقبال (Reception)",
    email: "reception@local.invalid",
    roleId: "seed_role_reception",
    assignAllDepartments: false,
  },
  {
    id: "seed_user_designer",
    username: "designer",
    displayUsername: "Designer",
    name: "أحمد مصطفى (Ahmed Moustafa)",
    email: "designer@local.invalid",
    roleId: "seed_role_designer",
    assignAllDepartments: true,
  },
  {
    id: "seed_user_designer_sara",
    username: "sara",
    displayUsername: "Sara",
    name: "سارة خالد (Sara Khaled)",
    email: "sara@local.invalid",
    roleId: "seed_role_designer",
    assignAllDepartments: true,
  },
  {
    id: "seed_user_designer_omar",
    username: "omar",
    displayUsername: "Omar",
    name: "عمر فاروق (Omar Farouk)",
    email: "omar@local.invalid",
    roleId: "seed_role_designer",
    assignAllDepartments: true,
  },
  {
    id: "seed_user_designer_nour",
    username: "nour",
    displayUsername: "Nour",
    name: "نور الدين (Nour Eldin)",
    email: "nour@local.invalid",
    roleId: "seed_role_designer",
    assignAllDepartments: true,
  },
  {
    id: "seed_user_designer_mona",
    username: "mona",
    displayUsername: "Mona",
    name: "منى خليل (Mona Khalil)",
    email: "mona@local.invalid",
    roleId: "seed_role_designer",
    assignAllDepartments: true,
  },
  {
    id: "seed_user_head_designer",
    username: "headdesigner",
    displayUsername: "Head Designer",
    name: "طارق العلي (Head Designer - Tarek)",
    email: "headdesigner@local.invalid",
    roleId: "seed_role_head_designer",
    assignAllDepartments: true,
    extraPermissions: ["design.work"],
  },
  {
    id: "seed_user_production",
    username: "production",
    displayUsername: "Production",
    name: "فني الإنتاج (Production)",
    email: "production@local.invalid",
    roleId: "seed_role_production_operator",
    assignAllDepartments: true,
  },
  {
    id: "seed_user_delivery",
    username: "delivery",
    displayUsername: "Delivery",
    name: "مسؤول التسليم (Delivery)",
    email: "delivery@local.invalid",
    roleId: "seed_role_print_reception_delivery",
    assignAllDepartments: false,
  },
  {
    id: "seed_user_accounting",
    username: "accounting",
    displayUsername: "Accounting",
    name: "المحاسب المالي (Accounting)",
    email: "accounting@local.invalid",
    roleId: "seed_role_accounting",
    assignAllDepartments: false,
    extraPermissions: ["pricing.set_variable", "pricing.override"],
  },
] as const;

async function seedWorkflowUsers(departments: { readonly id: string; readonly name: string }[]) {
  console.log("  seeding workflow role users...");
  const DEV_SHARED_PASSWORD = "Printex123!";
  const hashedPassword = await hashPassword(DEV_SHARED_PASSWORD);

  for (const userDef of WORKFLOW_DEV_USERS) {
    const user = await db.user.upsert({
      where: { id: userDef.id },
      update: {
        username: userDef.username,
        displayUsername: userDef.displayUsername,
        name: userDef.name,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        id: userDef.id,
        name: userDef.name,
        email: userDef.email,
        emailVerified: false,
        username: userDef.username,
        displayUsername: userDef.displayUsername,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    const accountId = `seed_account_${userDef.username}`;
    await db.account.upsert({
      where: { id: accountId },
      update: {
        password: hashedPassword,
        userId: user.id,
      },
      create: {
        id: accountId,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hashedPassword,
      },
    });

    await db.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: userDef.roleId },
      },
      update: {},
      create: { userId: user.id, roleId: userDef.roleId },
    });

    if (userDef.assignAllDepartments && departments.length > 0) {
      for (const dept of departments) {
        await db.userDepartment.upsert({
          where: {
            userId_departmentId: { userId: user.id, departmentId: dept.id },
          },
          update: {},
          create: {
            userId: user.id,
            departmentId: dept.id,
          },
        });
      }
    }

    if ("extraPermissions" in userDef && userDef.extraPermissions) {
      for (const perm of userDef.extraPermissions) {
        await db.userPermission.upsert({
          where: {
            userId_permission: { userId: user.id, permission: perm },
          },
          update: {},
          create: {
            userId: user.id,
            permission: perm,
            grantedById: ADMIN_USER_ID,
          },
        });
      }
    }

    console.log(`    user: ${user.username} (${userDef.roleId}) — ready`);
  }
}

async function seedDepartments() {
  const departments = [];
  for (const name of DEPARTMENT_NAMES) {
    const department = await db.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    departments.push(department);
    console.log(`  department: ${department.name} (${department.id})`);
  }
  return departments;
}

async function seedClassifications() {
  for (const name of CLASSIFICATIONS) {
    await db.customerClassification.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }
}

async function seedCashCustomer() {
  const cashCustomer = await db.customer.upsert({
    where: { id: CASH_CUSTOMER_ID },
    update: { isCashCustomer: true },
    create: {
      id: CASH_CUSTOMER_ID,
      name: "Cash Customer",
      normalizedName: "cash customer",
      isCashCustomer: true,
    },
  });
  console.log(`  cash customer: ${cashCustomer.name} (${cashCustomer.id})`);
  return cashCustomer;
}

// 011-orders-reception starter catalog — spec.md Assumptions "Product type
// starter list". Not a business requirement to validate, just a reasonable
// starting point; an Admin can add more at any time.
//
// 093: "Roll-up Banner" is the ROLL product class the width ladder and the area
// pricing are specified for.
//
// It originally carried `requiresReview: false` on the 093 assumption that this
// business runs RECEPTION → DESIGNER → ACCOUNTANT → PRINTER with no Head-Designer
// review stage. That assumption is wrong: the shop reviews every design before
// the accountant prices it. `markDesignComplete` routes a reviewed item
// DESIGN_COMPLETED → WAITING_REVIEW → APPROVED → WAITING_PRICING, and
// `approveDesign` performs the last two steps, so a false here skipped the Head
// Designer entirely for the shop's main product.
//
// `defaultRequiresReview` is now advisory only. The reception save action sets
// `WorkItem.requiresReview: true` unconditionally, because design review is a
// stage of the pipeline rather than a property of a product; this column records
// the shop's starting preference for the catalogue.
const PRODUCT_TYPE_SEED_DATA = [
  { name: "Roll-up Banner", department: "Banner", requiresReview: true },
  { name: "Business Cards", department: "Digital", requiresReview: false },
  { name: "Flyer/Poster", department: "Digital", requiresReview: true },
  { name: "Vinyl Sticker", department: "Digital", requiresReview: true },
  { name: "Outdoor Sign", department: "Outdoor", requiresReview: true },
  { name: "Laser-cut Sign", department: "Laser", requiresReview: true },
] as const;

// 093 FR-002/FR-003: the production width ladder, in centimetres, strictly
// ascending. `resolveProductionWidth` rounds UP to the first entry >= the
// customer's width; the last entry (320) is the maximum — anything wider
// raises a WidthExceptionTicket and is never clamped (FR-003).
const ROLL_WIDTH_LADDER_CM = [80, 110, 150, 210, 260, 270, 320] as const;

// 093 FR-004: height ceiling in metres, and FR-007: the inclusive EGP/m² band
// the reception-entered base rate must fall inside.
const ROLL_MAX_HEIGHT_M = "50";
const ROLL_MIN_RATE_PER_SQM = "80";
const ROLL_MAX_RATE_PER_SQM = "120";

// 093 FR-009: the seeded finishing catalogue. Sulfan at 90 EGP/m² is the
// worked example in the spec; the other two prove the point — a second
// add-on and a second price band exist purely as rows, with no code change
// and no `switch` anywhere in the pricing path.
const FINISHING_SERVICE_SEED_DATA = [
  { code: "SULFAN", labelAr: "سلوفان", ratePerSqm: "90" },
  { code: "EYELET", labelAr: "عيون", ratePerSqm: "15" },
  { code: "HEMMING", labelAr: "خياطة", ratePerSqm: "25" },
] as const;

// 093 FR-008: the roll class is priced per square metre of PRODUCTION area.
// 100 EGP/m² is the midpoint of the permitted 80–120 band and the value the
// spec's worked example (145 cm × 2 m → 300 EGP) is built on.
const ROLL_BASE_RATE_PER_SQM = "100";

async function seedProductionWidthRules(params: {
  readonly productTypeIdsByName: ReadonlyMap<string, string>;
  readonly updatedById: string;
}) {
  const rollProductTypeId = params.productTypeIdsByName.get("Roll-up Banner");
  if (!rollProductTypeId) {
    throw new Error("Expected the seeded Roll-up Banner product type");
  }

  const rule = await db.productionWidthRule.upsert({
    where: { productTypeId: rollProductTypeId },
    update: {
      ladderCm: [...ROLL_WIDTH_LADDER_CM],
      maxHeightM: new Prisma.Decimal(ROLL_MAX_HEIGHT_M),
      minRatePerSqm: new Prisma.Decimal(ROLL_MIN_RATE_PER_SQM),
      maxRatePerSqm: new Prisma.Decimal(ROLL_MAX_RATE_PER_SQM),
      updatedById: params.updatedById,
    },
    create: {
      productTypeId: rollProductTypeId,
      ladderCm: [...ROLL_WIDTH_LADDER_CM],
      maxHeightM: new Prisma.Decimal(ROLL_MAX_HEIGHT_M),
      minRatePerSqm: new Prisma.Decimal(ROLL_MIN_RATE_PER_SQM),
      maxRatePerSqm: new Prisma.Decimal(ROLL_MAX_RATE_PER_SQM),
      updatedById: params.updatedById,
    },
  });
  console.log(
    `  roll width rule: [${rule.ladderCm.join(", ")}] cm, max ${rule.maxHeightM.toString()} m, ${rule.minRatePerSqm.toString()}-${rule.maxRatePerSqm.toString()} EGP/m2`,
  );
}

async function seedFinishingServices(createdById: string) {
  for (const finishing of FINISHING_SERVICE_SEED_DATA) {
    const seeded = await db.finishingService.upsert({
      where: { code: finishing.code },
      update: { ratePerSqm: new Prisma.Decimal(finishing.ratePerSqm), labelAr: finishing.labelAr },
      create: {
        code: finishing.code,
        labelAr: finishing.labelAr,
        ratePerSqm: new Prisma.Decimal(finishing.ratePerSqm),
        createdById,
      },
    });
    console.log(`  finishing service: ${seeded.code} (${seeded.ratePerSqm.toString()} EGP/m2)`);
  }
}

async function seedRollPriceList(params: {
  readonly productTypeIdsByName: ReadonlyMap<string, string>;
  readonly createdById: string;
}) {
  const rollProductTypeId = params.productTypeIdsByName.get("Roll-up Banner");
  if (!rollProductTypeId) {
    throw new Error("Expected the seeded Roll-up Banner product type");
  }

  // Idempotent: a SQUARE_METER PriceList is only created when the product type
  // does not already have an active one. Re-running the seed must not stack
  // duplicate effective-dated lists, which `createPriceList` rejects anyway
  // (EFFECTIVE_DATE_CONFLICT).
  const existing = await db.priceList.findFirst({
    where: { productTypeId: rollProductTypeId, unit: "SQUARE_METER", status: "ACTIVE" },
    select: { id: true },
  });
  if (existing) {
    console.log("  roll price list: already seeded, skipping");
    return;
  }

  const list = await db.priceList.create({
    data: {
      productTypeId: rollProductTypeId,
      unit: "SQUARE_METER",
      effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
      createdById: params.createdById,
      tiers: {
        // One open-ended tier: roll pricing is area-based, not quantity-tiered.
        create: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: new Prisma.Decimal(ROLL_BASE_RATE_PER_SQM) }],
      },
    },
  });
  console.log(`  roll price list: ${list.id} at ${ROLL_BASE_RATE_PER_SQM} EGP/m2`);
}

async function seedProductTypes(departments: { readonly id: string; readonly name: string }[]) {
  const productTypeIdsByName = new Map<string, string>();
  for (const productType of PRODUCT_TYPE_SEED_DATA) {
    const defaultDepartment = departments.find((d) => d.name === productType.department);
    const seeded = await db.productType.upsert({
      where: { name: productType.name },
      update: {
        defaultDepartmentId: defaultDepartment?.id ?? null,
        defaultRequiresReview: productType.requiresReview,
      },
      create: {
        name: productType.name,
        defaultDepartmentId: defaultDepartment?.id ?? null,
        defaultRequiresDesign: true,
        defaultRequiresReview: productType.requiresReview,
      },
    });
    console.log(`  product type: ${seeded.name} (${seeded.id})`);
    productTypeIdsByName.set(seeded.name, seeded.id);
  }
  return productTypeIdsByName;
}

async function seedSampleCustomer() {
  const customer = await db.customer.upsert({
    where: { id: SAMPLE_CUSTOMER_ID },
    update: {},
    create: {
      id: SAMPLE_CUSTOMER_ID,
      name: "Sample Walk-in Customer",
      normalizedName: "sample walk-in customer",
      isCashCustomer: false,
    },
  });
  console.log(`  sample customer: ${customer.name} (${customer.id})`);
  return customer;
}

// Sample Order/WorkItem graph — Order.number is a real DB sequence
// (FR-008a, 011 research.md §1: `@default(autoincrement())`), so this never
// assigns `number` itself — Postgres does. Re-running the seed must not
// re-insert the same sample orders; the script checks "have we already
// seeded any sample orders for this customer?" and skips the whole block if
// so — safe to re-run, if less granular than a per-row upsert (Order.id has
// no natural business key to upsert on other than the DB-generated
// `number`).
async function seedSampleOrdersAndWorkItems(params: {
  readonly customerId: string;
  readonly createdById: string;
  readonly departmentId: string;
}) {
  const existing = await db.order.findFirst({
    where: { customerId: params.customerId },
  });
  if (existing) {
    console.log(
      `  sample orders: already seeded (found Order #${existing.number}), skipping`,
    );
    return;
  }

  // Order 1 — fully delivered, single work item.
  const order1 = await db.order.create({
    data: {
      customerId: params.customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: params.createdById,
      workItems: {
        create: [{ state: "DELIVERED", departmentId: params.departmentId }],
      },
    },
    include: { workItems: true },
  });
  console.log(`  order #${order1.number}: 1 work item (DELIVERED)`);

  // Order 2 — mixed states, exercises deriveOrderStatus's PARTIALLY_READY
  // bucket (quickstart.md §4): one DELIVERED, one still IN_PRODUCTION.
  const order2 = await db.order.create({
    data: {
      customerId: params.customerId,
      channel: "WHATSAPP",
      priority: "URGENT",
      mode: "SEPARATE",
      createdById: params.createdById,
      workItems: {
        create: [
          { state: "DELIVERED", departmentId: params.departmentId },
          { state: "IN_PRODUCTION", departmentId: params.departmentId },
        ],
      },
    },
    include: { workItems: true },
  });
  console.log(
    `  order #${order2.number}: 2 work items (DELIVERED, IN_PRODUCTION)`,
  );

  // Order 3 — freshly created, work items still in early states, useful for
  // manually exercising transitionWorkItem from the quickstart.
  const order3 = await db.order.create({
    data: {
      customerId: params.customerId,
      channel: "PHONE",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: params.createdById,
      workItems: {
        create: [
          { state: "NEW", departmentId: params.departmentId },
          { state: "IN_DESIGN", departmentId: params.departmentId },
          { state: "WAITING_REVIEW", departmentId: params.departmentId },
        ],
      },
    },
    include: { workItems: true },
  });
  console.log(
    `  order #${order3.number}: 3 work items (NEW, IN_DESIGN, WAITING_REVIEW)`,
  );
}

async function main() {
  console.log("Seeding dev database...");

  // Roles must be seeded before the admin user so the UserRole upsert works.
  await seedRoles();
  const adminUser = await seedAdminUser();
  const departments = await seedDepartments();
  await seedWorkflowUsers(departments);
  const productTypeIdsByName = await seedProductTypes(departments);
  await seedProductionWidthRules({
    productTypeIdsByName,
    updatedById: adminUser.id,
  });
  await seedFinishingServices(adminUser.id);
  await seedRollPriceList({ productTypeIdsByName, createdById: adminUser.id });
  await seedClassifications();
  await seedCashCustomer();
  const sampleCustomer = await seedSampleCustomer();

  const firstDepartment = departments[0];
  if (!firstDepartment) {
    throw new Error("Expected at least one seeded department");
  }

  await seedSampleOrdersAndWorkItems({
    customerId: sampleCustomer.id,
    createdById: adminUser.id,
    departmentId: firstDepartment.id,
  });

  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
