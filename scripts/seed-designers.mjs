import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL?.split("?")[0];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const SHARED_DEV_PASSWORD = "Printex123!";

const DESIGNERS = [
  {
    id: "seed_user_designer",
    username: "designer",
    displayUsername: "Designer",
    name: "أحمد مصطفى - مصمم أول (Ahmed Moustafa)",
    email: "designer@local.invalid",
    roleId: "seed_role_designer",
    extraPermissions: ["design.work"],
  },
  {
    id: "seed_user_designer_sara",
    username: "sara",
    displayUsername: "Sara",
    name: "سارة خالد - مصممة جرافيك (Sara Khaled)",
    email: "sara@local.invalid",
    roleId: "seed_role_designer",
    extraPermissions: ["design.work"],
  },
  {
    id: "seed_user_designer_omar",
    username: "omar",
    displayUsername: "Omar",
    name: "عمر فاروق - مصمم هويات وبانرات (Omar Farouk)",
    email: "omar@local.invalid",
    roleId: "seed_role_designer",
    extraPermissions: ["design.work"],
  },
  {
    id: "seed_user_designer_nour",
    username: "nour",
    displayUsername: "Nour",
    name: "نور الدين - مصمم مطبوعات (Nour Eldin)",
    email: "nour@local.invalid",
    roleId: "seed_role_designer",
    extraPermissions: ["design.work"],
  },
  {
    id: "seed_user_designer_mona",
    username: "mona",
    displayUsername: "Mona",
    name: "منى خليل - مصممة إعلانات وتغليف (Mona Khalil)",
    email: "mona@local.invalid",
    roleId: "seed_role_designer",
    extraPermissions: ["design.work"],
  },
  {
    id: "seed_user_head_designer",
    username: "headdesigner",
    displayUsername: "Head Designer",
    name: "طارق العلي - رئيس قسم التصميم (Tarek Al-Ali)",
    email: "headdesigner@local.invalid",
    roleId: "seed_role_head_designer",
    extraPermissions: ["design.work", "design.review", "change.approve"],
  },
];

async function main() {
  console.log("Connecting to database pooler (port 6543)...");
  await client.connect();
  console.log("Connected! Generating password hash...");
  const hashedPassword = await hashPassword(SHARED_DEV_PASSWORD);

  // 1. Ensure roles exist
  await client.query(`
    INSERT INTO "role" (id, key, name, "createdAt")
    VALUES 
      ('seed_role_designer', 'DESIGNER', 'Designer', NOW()),
      ('seed_role_head_designer', 'HEAD_DESIGNER', 'Head Designer', NOW())
    ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, name = EXCLUDED.name;
  `);

  // 2. Ensure role permissions exist
  await client.query(`
    INSERT INTO "role_permission" (id, "roleId", permission)
    VALUES 
      ('seed_perm_des_work', 'seed_role_designer', 'design.work'),
      ('seed_perm_head_review', 'seed_role_head_designer', 'design.review'),
      ('seed_perm_head_change', 'seed_role_head_designer', 'change.approve'),
      ('seed_perm_head_work', 'seed_role_head_designer', 'design.work')
    ON CONFLICT ("roleId", permission) DO NOTHING;
  `);

  // 3. Query primary departments
  const { rows: departments } = await client.query(`
    SELECT id, name FROM "Department" 
    WHERE name IN ('Digital', 'Banner', 'Outdoor', 'Laser', 'External')
    LIMIT 10;
  `);
  console.log(`Found ${departments.length} primary departments.`);

  // 4. Upsert designers
  for (const des of DESIGNERS) {
    // User
    await client.query(
      `
      INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "isActive", "failedLoginAttempts", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, false, $4, $5, true, 0, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        username = EXCLUDED.username,
        "displayUsername" = EXCLUDED."displayUsername",
        "isActive" = true,
        "failedLoginAttempts" = 0,
        "lockedUntil" = NULL,
        "updatedAt" = NOW();
    `,
      [des.id, des.name, des.email, des.username, des.displayUsername],
    );

    // Account (Credentials)
    const accountId = `seed_account_${des.username}`;
    await client.query(
      `
      INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW();
    `,
      [accountId, des.id, des.id, hashedPassword],
    );

    // UserRole
    await client.query(
      `
      INSERT INTO "user_role" (id, "userId", "roleId")
      VALUES ($1, $2, $3)
      ON CONFLICT ("userId", "roleId") DO NOTHING;
    `,
      [`seed_ur_${des.username}`, des.id, des.roleId],
    );

    // Extra permissions
    if (des.extraPermissions) {
      for (const perm of des.extraPermissions) {
        await client.query(
          `
          INSERT INTO "user_permission" (id, "userId", permission, "grantedById", "createdAt")
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT ("userId", permission) DO NOTHING;
        `,
          [`seed_up_${des.username}_${perm.replace('.', '_')}`, des.id, perm, des.id],
        );
      }
    }

    // UserDepartment
    for (const dept of departments) {
      await client.query(
        `
        INSERT INTO "user_department" (id, "userId", "departmentId")
        VALUES ($1, $2, $3)
        ON CONFLICT ("userId", "departmentId") DO NOTHING;
      `,
        [`seed_ud_${des.username}_${dept.id}`, des.id, dept.id],
      );
    }

    console.log(`✓ Designer seeded: ${des.name} (@${des.username})`);
  }

  console.log("\nAll designers injected successfully! Testing eligibility query...");

  // Verify findActiveDesignWorkHolders query via raw SQL
  const { rows: eligible } = await client.query(`
    SELECT DISTINCT u.id, u.name, u.username
    FROM "user" u
    LEFT JOIN "user_role" ur ON ur."userId" = u.id
    LEFT JOIN "role_permission" rp ON rp."roleId" = ur."roleId" AND rp.permission = 'design.work'
    LEFT JOIN "user_permission" up ON up."userId" = u.id AND up.permission = 'design.work'
    WHERE u."isActive" = true AND (rp.permission IS NOT NULL OR up.permission IS NOT NULL)
    ORDER BY u.name ASC;
  `);

  console.log(`\nEligible Designers for Assignment (${eligible.length} found):`);
  eligible.forEach((d) => console.log(` - ${d.name} (@${d.username}) [ID: ${d.id}]`));
}

main()
  .catch((err) => {
    console.error("Execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
