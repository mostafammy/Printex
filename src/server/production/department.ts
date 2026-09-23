// department.ts — shared effective-department helper (research.md §8,
// FR-001). Used identically by every production function that scopes
// authorize() to a Work Item's department.

/**
 * The effective department for a Work Item: `workItem.departmentId ??
 * productType.defaultDepartmentId`. Only `WorkItem.departmentId` is ever
 * written (by `routeToDepartment`); the default is derived at read time,
 * never stored eagerly.
 */
export function effectiveDepartmentId(wi: {
  departmentId: string | null;
  productType: { defaultDepartmentId: string | null } | null;
}): string | null {
  return wi.departmentId ?? wi.productType?.defaultDepartmentId ?? null;
}
