import type { Role } from './roles';
import { Action, PERMISSIONS } from './permissions';

/** A user's role in a specific tenant. The RBAC layer works on
 * (role, action) pairs — resource-level granularity (e.g. "can edit
 * *this* product") is intentionally left to the data layer and RLS. */
export type RoleBinding = {
  role: Role;
  tenantId: string;
};

/** Returns true when `bindings` (the user's roles across tenants)
 * include a role that may perform `action`.
 *
 * `resource` is accepted for future resource-level checks but is
 * currently unused — all authorization today is role + action.
 *
 * Usage:
 *   can(userBindings, Action.CREATE_PRODUCT, 'some-resource')
 *   can(userBindings, Action.MANAGE_USERS)
 */
export function can(
  bindings: readonly RoleBinding[],
  action: Action,
  _resource?: string,
): boolean {
  if (action === Action.ANY) {
    return bindings.length > 0;
  }
  const allowedRoles = PERMISSIONS[action];
  if (!allowedRoles) return false;
  return bindings.some((b) => allowedRoles.includes(b.role));
}

/** Convenience: check a single role against an action. */
export function canRole(role: Role, action: Action): boolean {
  return PERMISSIONS[action]?.includes(role) ?? false;
}

/** Returns the highest-privilege role from a set of bindings. */
export function highestRole(bindings: readonly RoleBinding[]): Role | null {
  if (bindings.length === 0) return null;
  let best: Role | null = null;
  let bestLevel = 0;
  for (const b of bindings) {
    const level = b.role === 'OWNER' ? 5
      : b.role === 'PRODUCTION_MANAGER' ? 4
      : b.role === 'PURCHASING' ? 3
      : b.role === 'WAREHOUSE_STAFF' ? 2
      : b.role === 'VIEWER' ? 1 : 0;
    if (level > bestLevel) {
      bestLevel = level;
      best = b.role;
    }
  }
  return best;
}
