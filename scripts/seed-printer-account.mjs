import { PrismaClient } from "../generated/prisma/index.js";
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();

const SHARED_DEV_PASSWORD = "Printex123!";

async function main() {
  console.log("Seeding Printer/Production account and printer departments...");

  // 1. Upsert the 4 Printer Departments
  const departmentNames = ["Offset", "Digital", "Laser", "Other"];
  const departments = [];
  for (const name of departmentNames) {
    const dept = await db.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    departments.push(dept);
    console.log(`  Department: ${dept.name} (${dept.id})`);
  }

  // Also include any other existing departments
  const allDepts = await db.department.findMany();

  // 2. Ensure Role exists
  const role = await db.role.upsert({
    where: { id: "seed_role_production_operator" },
    update: {
      key: "PRODUCTION_OPERATOR",
      name: "Production Operator",
    },
    create: {
      id: "seed_role_production_operator",
      key: "PRODUCTION_OPERATOR",
      name: "Production Operator",
    },
  });

  const permissions = [
    "production.operate",
    "files.download_production",
    "workitem.update",
  ];

  for (const perm of permissions) {
    await db.rolePermission.upsert({
      where: {
        roleId_permission: {
          roleId: role.id,
          permission: perm,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permission: perm,
      },
    });
  }

  const hashedPassword = await hashPassword(SHARED_DEV_PASSWORD);

  // 3. Upsert printer user
  const printerUsers = [
    {
      id: "seed_user_printer",
      username: "printer",
      displayUsername: "Printer",
      name: "مسؤول الطباعة (Printer)",
      email: "printer@local.invalid",
    },
    {
      id: "seed_user_production",
      username: "production",
      displayUsername: "Production",
      name: "فني الإنتاج (Production)",
      email: "production@local.invalid",
    },
  ];

  for (const u of printerUsers) {
    const user = await db.user.upsert({
      where: { id: u.id },
      update: {
        username: u.username,
        displayUsername: u.displayUsername,
        name: u.name,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: false,
        username: u.username,
        displayUsername: u.displayUsername,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    const accountId = `seed_account_${u.username}`;
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
        userId_roleId: { userId: user.id, roleId: role.id },
      },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    // Assign all departments
    for (const d of allDepts) {
      await db.userDepartment.upsert({
        where: {
          userId_departmentId: { userId: user.id, departmentId: d.id },
        },
        update: {},
        create: {
          userId: user.id,
          departmentId: d.id,
        },
      });
    }

    console.log(`  User: ${u.username} ready with password "${SHARED_DEV_PASSWORD}" and all departments assigned.`);
  }

  console.log("Printer accounts seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
