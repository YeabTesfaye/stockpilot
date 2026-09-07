// Role enum mirrored from the Prisma schema so application code can
// reference roles without importing the Prisma contract.
export const Role = {
  OWNER: 'OWNER',
  PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
  PURCHASING: 'PURCHASING',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = [
  Role.OWNER,
  Role.PRODUCTION_MANAGER,
  Role.PURCHASING,
  Role.WAREHOUSE_STAFF,
  Role.VIEWER,
];

/** Roles ordered from most to least privileged. Used for "is this role
 * at least as powerful as that one" checks. */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 5,
  [Role.PRODUCTION_MANAGER]: 4,
  [Role.PURCHASING]: 3,
  [Role.WAREHOUSE_STAFF]: 2,
  [Role.VIEWER]: 1,
};

/** Returns true when `role` is at least as privileged as `minRole`. */
export function roleGte(role: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}
