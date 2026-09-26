// Admin Users page — 001-identity-access-audit (T025).
// Server Component: no "use client". All mutations use inline Server Actions.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).

import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { getActor, authorize, ALL_PERMISSIONS } from "~/server/auth";
import type { Permission } from "~/server/auth";
import {
  createUser,
  deactivateUser,
  reactivateUser,
  resetPassword,
  forceLogout,
  updateUserRoleAssignments,
  updateUserDepartments,
  grantUserPermission,
  revokeUserPermission,
} from "~/server/admin/users";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

// ── Input class reused from login page recipe ──────────────────────────────
const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

const selectCls =
  "rounded-xl border border-input bg-background/80 px-3 py-2 text-sm text-foreground " +
  "focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 transition-all shadow-2xs";

// FormDataEntryValue is `string | File`; File has no custom toString(), so
// String(v) trips @typescript-eslint/no-base-to-string. These form fields
// are never files — narrow explicitly instead of coercing.
function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
function formStrList(values: FormDataEntryValue[]): string[] {
  return values.filter((v): v is string => typeof v === "string");
}

// ── Server Actions ─────────────────────────────────────────────────────────

async function createUserAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const username = formStr(formData.get("username")).trim();
  const initialPassword = formStr(formData.get("initialPassword"));
  const roleIds = formStrList(formData.getAll("roleIds"));
  const departmentIds = formStrList(formData.getAll("departmentIds"));
  await createUser(actor, { username, initialPassword, roleIds, departmentIds });
  revalidatePath("/admin/users");
}

async function deactivateUserAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  await deactivateUser(actor, userId);
  revalidatePath("/admin/users");
}

async function reactivateUserAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  await reactivateUser(actor, userId);
  revalidatePath("/admin/users");
}

async function forceLogoutAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  await forceLogout(actor, userId);
  revalidatePath("/admin/users");
}

async function resetPasswordAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  const newPassword = formStr(formData.get("newPassword"));
  if (!newPassword) return;
  await resetPassword(actor, userId, newPassword);
  revalidatePath("/admin/users");
}

async function assignRolesAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  const roleIds = formStrList(formData.getAll("roleIds"));
  await updateUserRoleAssignments(actor, userId, roleIds);
  revalidatePath("/admin/users");
}

async function assignDepartmentsAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  const departmentIds = formStrList(formData.getAll("departmentIds"));
  await updateUserDepartments(actor, userId, departmentIds);
  revalidatePath("/admin/users");
}

async function grantPermissionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  const permission = formStr(formData.get("permission")) as Permission;
  const reason = formStr(formData.get("reason")).trim() || undefined;
  await grantUserPermission(actor, userId, permission, reason);
  revalidatePath("/admin/users");
}

async function revokePermissionAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.users");
  const userId = formStr(formData.get("userId"));
  const permission = formStr(formData.get("permission")) as Permission;
  await revokeUserPermission(actor, userId, permission);
  revalidatePath("/admin/users");
}

// ── Page Component ─────────────────────────────────────────────────────────

export default async function AdminUsersPage() {
  const actor = await getActor();
  authorize(actor, "admin.users");

  const [users, roles, departments] = await Promise.all([
    db.user.findMany({
      include: {
        roles: { include: { role: true } },
        departments: { include: { department: true } },
        extraPermissions: true,
      },
      orderBy: { username: "asc" },
    }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{S.adminUsersPageTitle}</h1>

      {/* ── Create User Form ───────────────────────────────────────────── */}
      <section className="apple-card p-6 sm:p-8">
        <h2 className="mb-4 text-base font-bold text-foreground">{S.createUserHeading}</h2>
        <form action={createUserAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.usernameLabel}
              </label>
              <input
                name="username"
                type="text"
                required
                className={inputCls}
                placeholder={S.usernameLabel}
              />
            </div>
            {/* Initial password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.initialPasswordLabel}
              </label>
              <input
                name="initialPassword"
                type="password"
                required
                className={inputCls}
                placeholder={S.initialPasswordLabel}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Roles multi-select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.rolesLabel}
              </label>
              <select
                name="roleIds"
                multiple
                size={4}
                className={selectCls + " min-h-24"}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Departments multi-select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.departmentsLabel}
              </label>
              <select
                name="departmentIds"
                multiple
                size={4}
                className={selectCls + " min-h-24"}
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex">
            <Button type="submit" variant="default">
              {S.createUserButton}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Users Table ────────────────────────────────────────────────── */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderUsername}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderRoles}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderDepartments}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderStatus}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const userRoleIds = user.roles.map((ur) => ur.roleId);
              const userDeptIds = user.departments.map((ud) => ud.departmentId);

              return (
                <tr key={user.id} className="bg-card hover:bg-muted/30">
                  {/* Username */}
                  <td className="px-4 py-3 font-medium">
                    {user.displayUsername ?? user.username}
                  </td>

                  {/* Roles */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.roles.map((ur) => ur.role.name).join("، ") || "—"}
                  </td>

                  {/* Departments */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.departments.map((ud) => ud.department.name).join("، ") || "—"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.isActive
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }
                    >
                      {user.isActive ? S.statusActive : S.statusInactive}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-3">
                      {/* Deactivate / Reactivate */}
                      <form
                        action={user.isActive ? deactivateUserAction : reactivateUserAction}
                        className="flex"
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <Button
                          type="submit"
                          variant={user.isActive ? "destructive" : "secondary"}
                          size="sm"
                        >
                          {user.isActive ? S.deactivateUserButton : S.reactivateUserButton}
                        </Button>
                      </form>

                      {/* Force logout */}
                      <form action={forceLogoutAction} className="flex">
                        <input type="hidden" name="userId" value={user.id} />
                        <Button type="submit" variant="outline" size="sm">
                          {S.forceLogoutButton}
                        </Button>
                      </form>

                      {/* Reset password */}
                      <form action={resetPasswordAction} className="flex items-end gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">
                            {S.newPasswordLabel}
                          </label>
                          <input
                            name="newPassword"
                            type="password"
                            required
                            className="w-36 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                            placeholder={S.newPasswordLabel}
                          />
                        </div>
                        <Button type="submit" variant="outline" size="sm">
                          {S.resetPasswordButton}
                        </Button>
                      </form>

                      {/* Assign roles */}
                      <form action={assignRolesAction} className="flex items-end gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">
                            {S.rolesLabel}
                          </label>
                          <select
                            name="roleIds"
                            multiple
                            size={3}
                            className="w-40 rounded-md border border-input bg-background px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                          >
                            {roles.map((role) => (
                              <option
                                key={role.id}
                                value={role.id}
                                selected={userRoleIds.includes(role.id)}
                              >
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button type="submit" variant="outline" size="sm">
                          {S.assignRolesButton}
                        </Button>
                      </form>

                      {/* Assign departments */}
                      <form action={assignDepartmentsAction} className="flex items-end gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">
                            {S.departmentsLabel}
                          </label>
                          <select
                            name="departmentIds"
                            multiple
                            size={3}
                            className="w-40 rounded-md border border-input bg-background px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                          >
                            {departments.map((dept) => (
                              <option
                                key={dept.id}
                                value={dept.id}
                                selected={userDeptIds.includes(dept.id)}
                              >
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button type="submit" variant="outline" size="sm">
                          {S.assignDepartmentsButton}
                        </Button>
                      </form>

                      {/* Grant extra permission */}
                      <form action={grantPermissionAction} className="flex flex-col gap-1.5">
                        <input type="hidden" name="userId" value={user.id} />
                        <label className="text-xs text-muted-foreground">
                          {S.extraPermissionsLabel}
                        </label>
                        <div className="flex items-end gap-2">
                          <select
                            name="permission"
                            required
                            className="w-44 rounded-md border border-input bg-background px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                          >
                            {ALL_PERMISSIONS.map((perm) => (
                              <option key={perm} value={perm}>
                                {perm}
                              </option>
                            ))}
                          </select>
                          <input
                            name="reason"
                            type="text"
                            className="w-28 rounded-md border border-input bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                            placeholder={S.reasonLabel}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {S.grantPermissionButton}
                          </Button>
                        </div>
                      </form>

                      {/* Existing extra permissions with revoke buttons */}
                      {user.extraPermissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.extraPermissions.map((ep) => (
                            <form
                              key={ep.permission}
                              action={revokePermissionAction}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="permission" value={ep.permission} />
                              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {ep.permission}
                              </span>
                              <Button
                                type="submit"
                                variant="destructive"
                                size="xs"
                              >
                                {S.revokePermissionButton}
                              </Button>
                            </form>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{S.noExtraPermissions}</p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
