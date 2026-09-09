import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import * as materials from '@/server/model/materials';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_MATERIALS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    const item = await materials.getMaterial(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.UPDATE_MATERIAL)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      const item = await materials.updateMaterial(id, {
        name: typeof body.name === 'string' ? body.name : undefined,
        sku: typeof body.sku === 'string' ? body.sku : undefined,
        description: typeof body.description === 'string' ? body.description : body.description === null ? null : undefined,
        unit: typeof body.unit === 'string' ? body.unit : undefined,
        minStock: typeof body.minStock === 'number' ? body.minStock : undefined,
        currentStock: typeof body.currentStock === 'number' ? body.currentStock : undefined,
        reservedQty: typeof body.reservedQty === 'number' ? body.reservedQty : undefined,
      });
      return NextResponse.json(item);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 404 });
    }
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.DELETE_MATERIAL)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    try {
      await materials.deleteMaterial(id);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 404 });
    }
  });
}
