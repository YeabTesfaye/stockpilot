import { db } from '../db';
import type { AuditEntry, ResourceType } from './log';

export type AuditFilter = {
  resourceType?: ResourceType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export async function listAuditLogs(tenantId: string, filter: AuditFilter = {}): Promise<AuditEntry[]> {
  const {
    resourceType,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filter;

  const builder = db.orm.public.AuditLog
    .select('id', 'tenantId', 'actorUserId', 'actorName', 'action', 'resourceType', 'resourceId', 'description', 'snapshot', 'createdAt')
    .where((a) => a.tenantId.eq(tenantId));

  if (resourceType) {
    builder.where((a) => a.resourceType.eq(resourceType));
  }
  if (startDate) {
    builder.where((a) => a.createdAt.gte(startDate));
  }
  if (endDate) {
    builder.where((a) => a.createdAt.lte(endDate));
  }

  const rows = await builder
    .orderBy((a) => a.createdAt.desc())
    .limit(limit)
    .offset(offset)
    .all();

  return rows.map(mapAuditRow);
}

export async function countAuditLogs(tenantId: string, filter: AuditFilter = {}): Promise<number> {
  const { resourceType, startDate, endDate } = filter;

  const builder = db.orm.public.AuditLog
    .select('id')
    .where((a) => a.tenantId.eq(tenantId));

  if (resourceType) {
    builder.where((a) => a.resourceType.eq(resourceType));
  }
  if (startDate) {
    builder.where((a) => a.createdAt.gte(startDate));
  }
  if (endDate) {
    builder.where((a) => a.createdAt.lte(endDate));
  }

  const rows = await builder.all();
  return rows.length;
}

function mapAuditRow(row: {
  id: string;
  tenantId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  description: string | null;
  snapshot: string | null;
  createdAt: string;
}): AuditEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    action: row.action as AuditEntry['action'],
    resourceType: row.resourceType as AuditEntry['resourceType'],
    resourceId: row.resourceId,
    description: row.description,
    snapshot: row.snapshot,
    createdAt: row.createdAt,
  };
}
