import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL?.split("?")[0];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database successfully.");

    // 1. Core Summary Metrics
    const counts = {};
    const tableList = [
      'Customer', 'CustomerPhone', 'CustomerAddress', 'CustomerClassification',
      'Order', 'WorkItem', 'Department', 'ProductType', 'DesignVersion',
      'Payment', 'Expense', 'DirectCost', 'CustomerCredit', 'FinanceVoid',
      'User', 'Role', 'DelayBreach', 'PriceList', 'PriceTier',
      'CustomerPricingRule', 'WorkItemPrice', 'PricingStatus', 'ChangeRequest'
    ];

    for (const t of tableList) {
      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM "${t}"`);
        counts[t] = parseInt(res.rows[0].count, 10);
      } catch (e) {
        counts[t] = `Error: ${e.message}`;
      }
    }

    console.log("\n=== 1. DATABASE ROW COUNTS ===");
    console.table(counts);

    // 2. Customer Breakdown
    console.log("\n=== 2. CUSTOMER CLASSIFICATION BREAKDOWN ===");
    const custRes = await client.query(`
      SELECT 
        COALESCE(cc.name, 'Unclassified') as classification,
        COUNT(c.id) as total_customers,
        COUNT(CASE WHEN c."isCashCustomer" = true THEN 1 END) as cash_customers,
        COUNT(CASE WHEN c."isArchived" = true THEN 1 END) as archived_customers
      FROM "Customer" c
      LEFT JOIN "CustomerClassification" cc ON c."classificationId" = cc.id
      GROUP BY cc.name
      ORDER BY total_customers DESC;
    `);
    console.table(custRes.rows);

    // 3. Customer Phone & Contact Quality
    const custContactRes = await client.query(`
      SELECT
        COUNT(c.id) as total_customers,
        COUNT(cp.id) as customers_with_phones,
        COUNT(CASE WHEN c."nationalId" IS NOT NULL THEN 1 END) as with_national_id,
        COUNT(CASE WHEN c.notes IS NOT NULL AND c.notes != '' THEN 1 END) as with_notes
      FROM "Customer" c
      LEFT JOIN "CustomerPhone" cp ON c.id = cp."customerId";
    `);
    console.table(custContactRes.rows);

    // 4. Order Channels & Priorities
    console.log("\n=== 4. ORDER CHANNELS & PRIORITY BREAKDOWN ===");
    const orderChanRes = await client.query(`
      SELECT 
        channel,
        priority,
        mode,
        COUNT(*) as total_orders
      FROM "Order"
      GROUP BY channel, priority, mode
      ORDER BY total_orders DESC;
    `);
    console.table(orderChanRes.rows);

    // 5. Work Item States Breakdown
    console.log("\n=== 5. WORK ITEM STATE DISTRIBUTION (OPERATIONAL PIPELINE) ===");
    const workStateRes = await client.query(`
      SELECT 
        state,
        COUNT(*) as total_items,
        ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM "WorkItem")::numeric) * 100, 2) as pct
      FROM "WorkItem"
      GROUP BY state
      ORDER BY total_items DESC;
    `);
    console.table(workStateRes.rows);

    // 6. Departments Workload
    console.log("\n=== 6. DEPARTMENT WORKLOAD DISTRIBUTION ===");
    const deptWorkRes = await client.query(`
      SELECT 
        d.name as department_name,
        d."isActive",
        d."isExternalProduction",
        COUNT(w.id) as total_work_items,
        COUNT(CASE WHEN w.state IN ('NEW', 'ASSIGNED', 'IN_DESIGN', 'WAITING_REVIEW', 'REWORK_REQUIRED', 'APPROVED', 'WAITING_PRICING', 'READY_FOR_PRODUCTION', 'IN_PRODUCTION') THEN 1 END) as active_in_progress,
        COUNT(CASE WHEN w.state = 'COMPLETED' THEN 1 END) as completed_items,
        COUNT(CASE WHEN w.state = 'CANCELLED' THEN 1 END) as cancelled_items
      FROM "Department" d
      LEFT JOIN "WorkItem" w ON d.id = w."departmentId"
      GROUP BY d.id, d.name, d."isActive", d."isExternalProduction"
      ORDER BY total_work_items DESC
      LIMIT 15;
    `);
    console.table(deptWorkRes.rows);

    // 7. Finance & Payments Breakdown
    console.log("\n=== 7. FINANCE & PAYMENTS SUMMARY ===");
    const financeRes = await client.query(`
      SELECT 
        method,
        source,
        currency,
        COUNT(*) as transaction_count,
        SUM(amount) as total_collected,
        ROUND(AVG(amount), 2) as avg_transaction
      FROM "Payment"
      GROUP BY method, source, currency
      ORDER BY total_collected DESC;
    `);
    console.table(financeRes.rows);

    // 8. Expense Breakdown
    console.log("\n=== 8. EXPENSES BREAKDOWN ===");
    const expRes = await client.query(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_expenses,
        ROUND(AVG(amount), 2) as avg_expense
      FROM "Expense"
      GROUP BY category
      ORDER BY total_expenses DESC;
    `);
    console.table(expRes.rows);

    // 9. Pricing Coverage & WorkItem Pricing
    console.log("\n=== 9. PRICING STATUS DISTRIBUTION ===");
    const pricingRes = await client.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM "PricingStatus"
      GROUP BY status;
    `);
    console.table(pricingRes.rows);

    // 10. Top 10 Customers by Volume
    console.log("\n=== 10. TOP 10 CUSTOMERS BY ORDER VOLUME ===");
    const topCustRes = await client.query(`
      SELECT 
        c.id,
        c.name,
        COALESCE(cc.name, 'Unclassified') as classification,
        c."isCashCustomer",
        COUNT(o.id) as total_orders
      FROM "Customer" c
      LEFT JOIN "CustomerClassification" cc ON c."classificationId" = cc.id
      JOIN "Order" o ON c.id = o."customerId"
      GROUP BY c.id, c.name, cc.name, c."isCashCustomer"
      ORDER BY total_orders DESC
      LIMIT 10;
    `);
    console.table(topCustRes.rows);

    // 11. Top Product Types
    console.log("\n=== 11. TOP PRODUCT TYPES ===");
    const prodRes = await client.query(`
      SELECT 
        pt.name as product_type,
        d.name as default_department,
        COUNT(w.id) as total_work_items
      FROM "ProductType" pt
      LEFT JOIN "Department" d ON pt."defaultDepartmentId" = d.id
      LEFT JOIN "WorkItem" w ON pt.id = w."productTypeId"
      GROUP BY pt.id, pt.name, d.name
      ORDER BY total_work_items DESC
      LIMIT 10;
    `);
    console.table(prodRes.rows);

    // 12. Date Ranges & Trends
    console.log("\n=== 12. ORDER TIMELINE & DATE RANGE ===");
    const dateRes = await client.query(`
      SELECT 
        MIN("createdAt") as oldest_order,
        MAX("createdAt") as newest_order,
        COUNT(*) as total_orders
      FROM "Order";
    `);
    console.table(dateRes.rows);

    // 13. Revenue vs Costs
    console.log("\n=== 13. TOTAL FINANCIAL ROLLUP ===");
    const totRevRes = await client.query(`SELECT SUM(amount) as total_revenue, COUNT(*) as count FROM "Payment"`);
    const totExpRes = await client.query(`SELECT SUM(amount) as total_expense, COUNT(*) as count FROM "Expense"`);
    const totCostRes = await client.query(`SELECT SUM(amount) as total_direct_costs, COUNT(*) as count FROM "DirectCost"`);
    
    const rev = parseFloat(totRevRes.rows[0]?.total_revenue || 0);
    const exp = parseFloat(totExpRes.rows[0]?.total_expense || 0);
    const cost = parseFloat(totCostRes.rows[0]?.total_direct_costs || 0);
    const net = rev - exp - cost;

    console.log({
      total_revenue_collected: rev,
      total_expenses: exp,
      total_direct_costs: cost,
      net_operating_profit: net,
      operating_margin_pct: rev > 0 ? ((net / rev) * 100).toFixed(2) + "%" : "N/A"
    });

    await client.end();
  } catch (err) {
    console.error("Database Query Error:", err);
    try { await client.end(); } catch (_) {}
  }
}

run();
