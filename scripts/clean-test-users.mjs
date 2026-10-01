import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL.split("?")[0] });

const LEGIT_USER_IDS = [
  "seed_admin_user",
  "seed_user_reception",
  "seed_user_designer",
  "seed_user_designer_sara",
  "seed_user_designer_omar",
  "seed_user_designer_nour",
  "seed_user_designer_mona",
  "seed_user_head_designer",
  "seed_user_production",
  "seed_user_delivery",
  "seed_user_accounting",
  "seed_user_printer"
];

async function main() {
  await client.connect();

  console.log("Checking for non-canonical/test users...");
  const placeholders = LEGIT_USER_IDS.map((_, i) => `$${i + 1}`).join(", ");
  
  const testUsersRes = await client.query(
    `SELECT id, name, username FROM "user" WHERE id NOT IN (${placeholders})`,
    LEGIT_USER_IDS
  );

  console.log(`Found ${testUsersRes.rows.length} test users.`);
  if (testUsersRes.rows.length === 0) {
    console.log("No test users found. DB is clean.");
    await client.end();
    return;
  }

  const testIds = testUsersRes.rows.map(r => r.id);
  const testPlaceholders = testIds.map((_, i) => `$${i + 1}`).join(", ");

  // Begin transaction to safely remove references and test users
  await client.query("BEGIN");
  try {
    // 1. Temporarily disable triggers / foreign keys
    await client.query("SET session_replication_role = 'replica';");

    // Reassign or delete any references to test users in operational tables
    // Update createdById / updatedById in config tables if any
    await client.query(`UPDATE "FinishingService" SET "createdById" = 'seed_admin_user' WHERE "createdById" IN (${testPlaceholders})`, testIds);
    await client.query(`UPDATE "ProductionWidthRule" SET "updatedById" = 'seed_admin_user' WHERE "updatedById" IN (${testPlaceholders})`, testIds);

    // Delete test work items and test orders created by tests
    const testOrders = await client.query(`SELECT id FROM "Order" WHERE "createdById" IN (${testPlaceholders})`, testIds);
    const testOrderIds = testOrders.rows.map(r => r.id);
    if (testOrderIds.length > 0) {
      const orderPlaceholders = testOrderIds.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM "WorkItem" WHERE "orderId" IN (${orderPlaceholders})`, testOrderIds);
      await client.query(`DELETE FROM "Order" WHERE id IN (${orderPlaceholders})`, testOrderIds);
      console.log(`Deleted ${testOrderIds.length} test orders and their work items.`);
    }

    // Work items assigned to test users: unassign or reassign
    await client.query(`UPDATE "WorkItem" SET "assigneeId" = NULL WHERE "assigneeId" IN (${testPlaceholders})`, testIds);

    // User permissions, roles, departments, accounts, sessions
    await client.query(`DELETE FROM "user_role" WHERE "userId" IN (${testPlaceholders})`, testIds);
    await client.query(`DELETE FROM "user_permission" WHERE "userId" IN (${testPlaceholders}) OR "grantedById" IN (${testPlaceholders})`, testIds);
    await client.query(`DELETE FROM "user_department" WHERE "userId" IN (${testPlaceholders})`, testIds);
    await client.query(`DELETE FROM "account" WHERE "userId" IN (${testPlaceholders})`, testIds);
    await client.query(`DELETE FROM "session" WHERE "userId" IN (${testPlaceholders})`, testIds);
    await client.query(`DELETE FROM "notification" WHERE "userId" IN (${testPlaceholders})`, testIds);

    // Delete the users
    const deleteRes = await client.query(`DELETE FROM "user" WHERE id IN (${testPlaceholders})`, testIds);
    console.log(`Successfully deleted ${deleteRes.rowCount} test users.`);

    await client.query("SET session_replication_role = 'origin';");
    await client.query("COMMIT");
    console.log("Cleanup transaction committed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    await client.query("SET session_replication_role = 'origin';");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
