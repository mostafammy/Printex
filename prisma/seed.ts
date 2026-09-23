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
import { PrismaClient } from "../generated/prisma/index.js";
// Better Auth's own password hasher — ensures hashes produced here are
// verifiable by Better Auth's credential provider at runtime.
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();

const ADMIN_USER_ID = "seed_admin_user";
const DEPARTMENT_NAMES = ["Digital", "Banner", "Outdoor", "Laser", "External"] as const;
const CASH_CUSTOMER_ID = "seed_cash_customer";
const SAMPLE_CUSTOMER_ID = "seed_sample_customer";

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
      "pricing.use_fixed",
      "finance.view",
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
    permissions: ["design.review"],
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
    // pricing.set_variable and pricing.override intentionally omitted — see
    // note above. Grant per-user via UserPermission for specific users.
    permissions: ["payment.record", "payment.void", "expense.record", "finance.view"],
  },
  {
    id: "seed_role_admin_owner",
    key: "ADMIN_OWNER",
    name: "Admin/Owner",
    // All 21 permission keys — Admin/Owner has full access.
    permissions: [
      "order.create",
      "order.edit",
      "order.cancel",
      "customer.manage",
      "workitem.assign_designer",
      "design.work",
      "design.review",
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
  const DEV_ADMIN_PASSWORD = "Admin123!DevOnly"; // DEV ONLY

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

async function seedCashCustomer() {
  const cashCustomer = await db.customer.upsert({
    where: { id: CASH_CUSTOMER_ID },
    update: { isCashCustomer: true },
    create: {
      id: CASH_CUSTOMER_ID,
      name: "Cash Customer",
      isCashCustomer: true,
    },
  });
  console.log(`  cash customer: ${cashCustomer.name} (${cashCustomer.id})`);
  return cashCustomer;
}

async function seedSampleCustomer() {
  const customer = await db.customer.upsert({
    where: { id: SAMPLE_CUSTOMER_ID },
    update: {},
    create: {
      id: SAMPLE_CUSTOMER_ID,
      name: "Sample Walk-in Customer",
      isCashCustomer: false,
    },
  });
  console.log(`  sample customer: ${customer.name} (${customer.id})`);
  return customer;
}

// Sample Order/WorkItem graph — Order.number is a real DB sequence
// (FR-008a), so re-running the seed must not try to re-insert an Order with
// the same number. Each sample order is looked up by a stable marker
// (encoded in nothing but the fact that we only ever create the first N we
// find missing) — simplest safe approach: key on whether an order created
// by the admin seed user with this exact index already exists, tracked via
// a deterministic `id`, which — like every other model here — is a `cuid()`
// default. Since `id` can't be pinned via `create` the way `User`/
// `Department`/`Customer` ids can (Order.id has no natural business key to
// upsert on other than the DB-generated `number`), the script instead
// checks "have we already seeded any sample orders for this customer?" and
// skips the whole block if so — safe to re-run, if less granular than a
// per-row upsert.
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

  // `Order.number` (FR-008a) has no DB-level `@default(autoincrement())` in
  // core.prisma today — it's a plain unique `Int` the application layer is
  // expected to assign (see contracts/orders.md for the real sequence
  // logic, owned outside this feature). This dev seed picks large,
  // effectively-unique numbers derived from the current time, the same
  // approach tests/helpers/seed.ts uses, so re-running the seed after the
  // "already seeded" guard above short-circuits never collides either way.
  const baseNumber = Number(process.hrtime.bigint() % 1_000_000_000n);

  // Order 1 — fully delivered, single work item.
  const order1 = await db.order.create({
    data: {
      number: baseNumber,
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
      number: baseNumber + 1,
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
      number: baseNumber + 2,
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
