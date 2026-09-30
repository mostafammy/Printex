import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL?.split("?")[0];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log("=== DETAILED DEEP-DIVE INSPECTION ===");

  // 1. Users & Roles
  const users = await client.query(`
    SELECT r.name as role_name, r.key as role_key, COUNT(ur."userId") as user_count
    FROM "role" r
    LEFT JOIN "user_role" ur ON r.id = ur."roleId"
    GROUP BY r.id, r.name, r.key
    ORDER BY user_count DESC;
  `);
  console.log("\n[Roles & Assigned Users]");
  console.table(users.rows);

  const totalUsers = await client.query(`SELECT COUNT(*) as total_users, COUNT(CASE WHEN "isActive" THEN 1 END) as active_users FROM "user"`);
  console.log("\n[User Stats]");
  console.table(totalUsers.rows);

  // 2. Orders by Channel
  const channels = await client.query(`
    SELECT channel, COUNT(*) as order_count,
      ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM "Order")::numeric) * 100, 2) as percentage
    FROM "Order"
    GROUP BY channel
    ORDER BY order_count DESC;
  `);
  console.log("\n[Order Channels]");
  console.table(channels.rows);

  // 3. WorkItems by Lifecycle State
  const workStates = await client.query(`
    SELECT state, COUNT(*) as count,
      ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM "WorkItem")::numeric) * 100, 2) as percentage
    FROM "WorkItem"
    GROUP BY state
    ORDER BY count DESC;
  `);
  console.log("\n[WorkItem Pipeline Distribution]");
  console.table(workStates.rows);

  // 4. Canonical Departments vs Test Departments
  const coreDepts = await client.query(`
    SELECT d.id, d.name, d."isActive", d."isExternalProduction", COUNT(w.id) as work_items_count
    FROM "Department" d
    LEFT JOIN "WorkItem" w ON d.id = w."departmentId"
    WHERE d.name IN ('Digital', 'Banner', 'Outdoor', 'Laser', 'External')
    GROUP BY d.id, d.name, d."isActive", d."isExternalProduction"
    ORDER BY work_items_count DESC;
  `);
  console.log("\n[Core Canonical Production Departments]");
  console.table(coreDepts.rows);

  // 5. Total Financials & Payments
  const paymentsByMethod = await client.query(`
    SELECT 
      method, 
      source, 
      COUNT(*) as count, 
      SUM(amount) as total_amount,
      ROUND(AVG(amount), 2) as avg_amount
    FROM "Payment"
    GROUP BY method, source
    ORDER BY total_amount DESC;
  `);
  console.log("\n[Payments by Method & Source]");
  console.table(paymentsByMethod.rows);

  // 6. Expenses by Category
  const expenses = await client.query(`
    SELECT 
      category, 
      COUNT(*) as count, 
      SUM(amount) as total_amount,
      ROUND(AVG(amount), 2) as avg_amount
    FROM "Expense"
    GROUP BY category
    ORDER BY total_amount DESC;
  `);
  console.log("\n[Expenses by Category]");
  console.table(expenses.rows);

  // 7. Pricing Breakdown
  const pricingStatus = await client.query(`
    SELECT status, COUNT(*) as count
    FROM "PricingStatus"
    GROUP BY status;
  `);
  console.log("\n[Pricing Status Breakdown]");
  console.table(pricingStatus.rows);

  // 8. Order Creation Timeline (Monthly / Weekly)
  const timeline = await client.query(`
    SELECT 
      TO_CHAR("createdAt", 'YYYY-MM-DD') as order_date,
      COUNT(*) as orders_count
    FROM "Order"
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
    ORDER BY order_date ASC;
  `);
  console.log("\n[Order Creation Timeline by Day]");
  console.table(timeline.rows);

  // 9. Customers Breakdown
  const custStats = await client.query(`
    SELECT 
      COUNT(*) as total_customers,
      COUNT(CASE WHEN "isCashCustomer" THEN 1 END) as cash_customers,
      COUNT(CASE WHEN "isArchived" THEN 1 END) as archived_customers
    FROM "Customer";
  `);
  console.log("\n[Customer Aggregate Stats]");
  console.table(custStats.rows);

  await client.end();
}

main().catch(console.error);
