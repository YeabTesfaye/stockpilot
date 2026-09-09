import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import * as auditQuery from '@/server/audit/query';
import { audit, type AuditAction, type ResourceType } from '@/server/audit/log';

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_AUDIT_LOG)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const resourceType = searchParams.get('resourceType') as ResourceType | null;
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  return withTenant(tenantId, async () => {
    const entries = await auditQuery.listAuditLogs(tenantId, {
      resourceType: resourceType ?? undefined,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      limit: Math.min(Math.max(limit, 1), 500),
      offset: Math.max(offset, 0),
    });
    const total = await auditQuery.countAuditLogs(tenantId, {
      resourceType: resourceType ?? undefined,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });
    return NextResponse.json({ entries, total });
  });
}

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Audit writes are typically triggered internally by other API routes.
  // We accept a small set of callers (admin users) for manual entries.
  if (!can(session.roleBindings, Action.MANAGE_USERS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, resourceType, resourceId, description, snapshot } = body;

  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }
  if (!resourceType || typeof resourceType !== 'string') {
    return NextResponse.json({ error: 'resourceType is required' }, { status: 400 });
  }
  if (!resourceId || typeof resourceId !== 'string') {
    return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
  }

  const validAction = action.toUpperCase() as AuditAction;
  if (!['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE'].includes(validAction)) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      await audit(
        tenantId,
        session.user.id,
        session.user.name,
        validAction,
        resourceType as ResourceType,
        resourceId,
        typeof description === 'string' ? description : undefined,
        typeof snapshot === 'string' ? snapshot : undefined,
      );
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
