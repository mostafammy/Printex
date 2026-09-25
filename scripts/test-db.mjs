import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const compose = ["compose", "-f", "docker-compose.test.yml"];
const runtimeUrl = "postgresql://printex_app:printex_app_ci_pw@localhost:54329/printex_test";
const ownerUrl = "postgresql://postgres:postgres@localhost:54329/printex_test";

function run(command, commandArgs, env = process.env) {
  execFileSync(command, commandArgs, { stdio: "inherit", env });
}

function psql(sql) {
  run("docker", [...compose, "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "printex_test", "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

run("docker", [...compose, "up", "-d", "--wait"]);

psql("DO $$ BEGIN CREATE ROLE printex_app LOGIN PASSWORD 'printex_app_ci_pw'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");

const env = { ...process.env, DATABASE_URL: runtimeUrl, DATABASE_URL_TEST: runtimeUrl, DIRECT_URL: ownerUrl };
run("pnpm", ["exec", "prisma", "db", "push", "--skip-generate"], { ...env, DATABASE_URL: ownerUrl, DATABASE_URL_TEST: runtimeUrl, DIRECT_URL: ownerUrl });
psql("GRANT CONNECT ON DATABASE printex_test TO printex_app; GRANT USAGE ON SCHEMA public TO printex_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO printex_app; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO printex_app;");
run("pnpm", ["exec", "prisma", "db", "seed"], env);
psql("REVOKE UPDATE, DELETE ON audit_event FROM printex_app;");
// 052-finance append-only money rows (SC-002): the app role can INSERT the
// immutable rows (payments, voids, expenses, approvals, costs) but never
// UPDATE or DELETE them — tests assert the database refuses direct SQL too.
psql("REVOKE UPDATE, DELETE ON \"Payment\", \"FinanceVoid\", \"Expense\", \"ExpenseApproval\", \"DirectCost\" FROM printex_app;");

if (args.has("reset")) {
  console.log("Test database reset and seeded.");
} else {
  console.log("Test database ready.");
}
console.log(`DATABASE_URL=${runtimeUrl}`);
console.log(`DATABASE_URL_TEST=${runtimeUrl}`);
console.log(`DIRECT_URL=${ownerUrl}`);
