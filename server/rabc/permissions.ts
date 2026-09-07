import { Role } from './roles';

/**
 * Action names. These are the coarse-grained operations the UI and API
 * guard on. They are deliberately coarse — fine-grained row-level checks
 * (e.g. "can this user edit *this* product") live closer to the data layer.
 */
export const Action = {
  // Dashboard / navigation
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_INVENTORY: 'view_inventory',
  VIEW_PRODUCTS: 'view_products',
  VIEW_PRODUCTION: 'view_production',
  VIEW_PURCHASING: 'view_purchasing',
  VIEW_PLANNING: 'view_planning',

  // Stock operations
  ADJUST_STOCK: 'adjust_stock',
  RECORD_MOVEMENT: 'record_movement',
  RESERVE_STOCK: 'reserve_stock',
  RELEASE_STOCK: 'release_stock',
  TRANSFER_STOCK: 'transfer_stock',

  // Product management
  CREATE_PRODUCT: 'create_product',
  UPDATE_PRODUCT: 'update_product',
  CREATE_BOM: 'create_bom',
  UPDATE_BOM: 'update_bom',

  // Production
  CREATE_PRODUCTION_ORDER: 'create_production_order',
  START_PRODUCTION: 'start_production',
  COMPLETE_PRODUCTION: 'complete_production',
  CANCEL_PRODUCTION: 'cancel_production',

  // Purchasing
  CREATE_PURCHASE_RECOMMENDATION: 'create_purchase_recommendation',

  // Settings / admin (Owner only)
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_TENANTS: 'manage_tenants',
  VIEW_AUDIT_LOG: 'view_audit_log',

  // Everything — convenience catch-all for "any action"
  ANY: 'any',
} as const;

export type Action = (typeof Action)[keyof typeof Action];

/** Which roles may perform each action. A role can perform an action if
 * its entry appears in the set for that action. */
export const PERMISSIONS: Record<Action, Role[]> = {
  // Dashboard / navigation — everyone can see these sections
  [Action.VIEW_DASHBOARD]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.PURCHASING,
    Role.WAREHOUSE_STAFF,
    Role.VIEWER,
  ],
  [Action.VIEW_INVENTORY]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.PURCHASING,
    Role.WAREHOUSE_STAFF,
    Role.VIEWER,
  ],
  [Action.VIEW_PRODUCTS]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.PURCHASING,
    Role.WAREHOUSE_STAFF,
    Role.VIEWER,
  ],
  [Action.VIEW_PRODUCTION]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.WAREHOUSE_STAFF,
  ],
  [Action.VIEW_PURCHASING]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.PURCHASING,
  ],
  [Action.VIEW_PLANNING]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.PURCHASING,
  ],

  // Stock operations — warehouse staff and above
  [Action.ADJUST_STOCK]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.WAREHOUSE_STAFF,
  ],
  [Action.RECORD_MOVEMENT]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.WAREHOUSE_STAFF,
  ],
  [Action.RESERVE_STOCK]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.WAREHOUSE_STAFF,
  ],
  [Action.RELEASE_STOCK]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.WAREHOUSE_STAFF,
  ],
  [Action.TRANSFER_STOCK]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.WAREHOUSE_STAFF,
  ],

  // Product management — production manager and above
  [Action.CREATE_PRODUCT]: [Role.OWNER, Role.PRODUCTION_MANAGER],
  [Action.UPDATE_PRODUCT]: [Role.OWNER, Role.PRODUCTION_MANAGER],
  [Action.CREATE_BOM]: [Role.OWNER, Role.PRODUCTION_MANAGER],
  [Action.UPDATE_BOM]: [Role.OWNER, Role.PRODUCTION_MANAGER],

  // Production — production manager and above
  [Action.CREATE_PRODUCTION_ORDER]: [Role.OWNER, Role.PRODUCTION_MANAGER],
  [Action.START_PRODUCTION]: [Role.OWNER, Role.PRODUCTION_MANAGER],
  [Action.COMPLETE_PRODUCTION]: [Role.OWNER, Role.PRODUCTION_MANAGER],
  [Action.CANCEL_PRODUCTION]: [Role.OWNER, Role.PRODUCTION_MANAGER],

  // Purchasing — purchasing and above
  [Action.CREATE_PURCHASE_RECOMMENDATION]: [Role.OWNER, Role.PURCHASING],

  // Settings / admin — owner only
  [Action.MANAGE_USERS]: [Role.OWNER],
  [Action.MANAGE_ROLES]: [Role.OWNER],
  [Action.MANAGE_TENANTS]: [Role.OWNER],
  [Action.VIEW_AUDIT_LOG]: [Role.OWNER],

  // Catch-all
  [Action.ANY]: [
    Role.OWNER,
    Role.PRODUCTION_MANAGER,
    Role.PURCHASING,
    Role.WAREHOUSE_STAFF,
    Role.VIEWER,
  ],
};

/** Returns the set of actions a role may perform. Useful for building
 * role-conditional UI (sidebar, menus). */
export function actionsForRole(role: Role): Set<Action> {
  const allowed = new Set<Action>();
  for (const [action, roles] of Object.entries(PERMISSIONS)) {
    if (roles.includes(role)) {
      allowed.add(action as Action);
    }
  }
  return allowed;
}
