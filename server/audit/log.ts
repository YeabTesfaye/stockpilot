import { db } from '../db';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE';

export type ResourceType =
  | 'user'
  | 'material'
  | 'product'
  | 'warehouse'
  | 'bom'
  | 'stock_movement'
  | 'session';

export type AuditEntry = {
  id: string;
  tenantId: string;
  actorUserId: string;
  actorName: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  description: string | null;
  snapshot: string | null;
  createdAt: string;
};

/**
 * Write one audit entry. This is the single function all application code
 * calls when it wants to record a change — that keeps the audit shape
 * consistent and makes it easy to add fields later (e.g. ip address, user
 * agent) without touching every call site.
 *
 * `snapshot` is an optional JSON string capturing the resource state before
 * or after the change (caller's choice). It is stored as TEXT in Postgres.
 */
export async function audit(
  tenantId: string,
  actorUserId: string,
  actorName: string,
  action: AuditAction,
  resourceType: ResourceType,
  resourceId: string,
  description?: string,
  snapshot?: string,
): Promise<void> {
  await db.orm.public.AuditLog.create({
    tenantId,
    actorUserId,
    actorName,
    action,
    resourceType,
    resourceId,
    description: description ?? null,
    snapshot: snapshot ?? null,
  });
}

/**
 * Build a ResourceType from a Prisma model name. Used by the generic
 * audit helpers so callers can pass a model name instead of a literal.
 */
export function resourceTypeFromModel(model: string): ResourceType {
  const mapping: Record<string, ResourceType> = {
    User: 'user',
    Material: 'material',
    Product: 'product',
    Warehouse: 'warehouse',
    Bom: 'bom',
    StockMovement: 'stock_movement',
    Session: 'session',
  };
  return mapping[model] ?? 'user';
}
