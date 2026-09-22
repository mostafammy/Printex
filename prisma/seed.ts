// Dev seed script — spec.md FR-016, quickstart.md §1.
//
// Populates just enough data to poke around `pnpm prisma studio` and to run
// the quickstart's `transitionWorkItem`/`deriveOrderStatus` snippets against
// a real database: an admin `User` (Better Auth's table, identity.prisma),
// the five default production `Department`s, the singleton Cash `Customer`,
// and a small number of sample `Order` + `WorkItem` rows in varied
// `WorkItemState`s.
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

const db = new PrismaClient();

const ADMIN_USER_ID = "seed_admin_user";
const DEPARTMENT_NAMES = ["Digital", "Banner", "Outdoor", "Laser", "External"] as const;
const CASH_CUSTOMER_ID = "seed_cash_customer";
const SAMPLE_CUSTOMER_ID = "seed_sample_customer";

async function seedAdminUser() {
  const user = await db.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: {},
    create: {
      id: ADMIN_USER_ID,
      name: "Admin",
      email: "admin@printex.local",
      emailVerified: true,
    },
  });
  console.log(`  user: ${user.email} (${user.id})`);
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
