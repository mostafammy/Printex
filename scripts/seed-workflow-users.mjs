import { PrismaClient } from "../generated/prisma/index.js";
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();

const SHARED_DEV_PASSWORD = "Printex123!";

const WORKFLOW_USERS = [
  {
    id: "seed_admin_user",
    username: "admin",
    displayUsername: "Admin",
    name: "مدير النظام (Admin)",
    email: "admin@local.invalid",
    roleKey: "ADMIN_OWNER",
    roleId: "seed_role_admin_owner",
    allDepartments: true,
  },
  {
    id: "seed_user_reception",
    username: "reception",
    displayUsername: "Reception",
    name: "موظف الاستقبال (Reception)",
    email: "reception@local.invalid",
    roleKey: "RECEPTION",
    roleId: "seed_role_reception",
    allDepartments: false,
  },
  {
    id: "seed_user_designer",
    username: "designer",
    displayUsername: "Designer",
    name: "المصمم (Designer)",
    email: "designer@local.invalid",
    roleKey: "DESIGNER",
    roleId: "seed_role_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_head_designer",
    username: "headdesigner",
    displayUsername: "Head Designer",
    name: "رئيس المصممين (Head Designer)",
    email: "headdesigner@local.invalid",
    roleKey: "HEAD_DESIGNER",
    roleId: "seed_role_head_designer",
    allDepartments: true,
  },
  {
    id: "seed_user_production",
    username: "production",
    displayUsername: "Production",
    name: "فني الإنتاج (Production)",
    email: "production@local.invalid",
    roleKey: "PRODUCTION_OPERATOR",
    roleId: "seed_role_production_operator",
    allDepartments: true,
  },
  {
    id: "seed_user_delivery",
    username: "delivery",
    displayUsername: "Delivery",
    name: "مسؤول التسليم (Delivery)",
    email: "delivery@local.invalid",
    roleKey: "PRINT_RECEPTION_DELIVERY",
    roleId: "seed_role_print_reception_delivery",
    allDepartments: false,
  },
  {
    id: "seed_user_accounting",
    username: "accounting",
    displayUsername: "Accounting",
    name: "المحاسب المالي (Accounting)",
    email: "accounting@local.invalid",
    roleKey: "ACCOUNTING",
    roleId: "seed_role_accounting",
    allDepartments: false,
    extraPermissions: ["pricing.set_variable", "pricing.override"],
  },
];

async function main() {
  console.log("Seeding all workflow users into database...");
  const hashedPassword = await hashPassword(SHARED_DEV_PASSWORD);
  const departments = await db.department.findMany({
    where: {
      name: { in: ["Digital", "Banner", "Outdoor", "Laser", "External"] },
    },
  });

  for (const userDef of WORKFLOW_USERS) {
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

    // Also update seed_admin_account if this is admin
    if (userDef.username === "admin") {
      await db.account.upsert({
        where: { id: "seed_admin_account" },
        update: {
          password: hashedPassword,
          userId: user.id,
        },
        create: {
          id: "seed_admin_account",
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: hashedPassword,
        },
      });
    }

    // Role assignment
    const role = await db.role.findUnique({
      where: { id: userDef.roleId },
    });
    if (role) {
      await db.userRole.upsert({
        where: {
          userId_roleId: { userId: user.id, roleId: role.id },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }

    // Department assignments
    if (userDef.allDepartments && departments.length > 0) {
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

    // Extra permissions (e.g. for accounting pricing overrides)
    if (userDef.extraPermissions && userDef.extraPermissions.length > 0) {
      for (const perm of userDef.extraPermissions) {
        await db.userPermission.upsert({
          where: {
            userId_permission: { userId: user.id, permission: perm },
          },
          update: {},
          create: {
            userId: user.id,
            permission: perm,
            grantedById: "seed_admin_user",
          },
        });
      }
    }

    console.log(`✓ User ready: ${userDef.username} (${userDef.roleKey}) - Password: ${SHARED_DEV_PASSWORD}`);
  }

  console.log("\nAll workflow test users successfully seeded and ready for login!");
}

main()
  .catch((err) => {
    console.error("Error seeding workflow users:", err);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
