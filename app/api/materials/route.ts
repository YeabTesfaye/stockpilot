import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import * as materials from '@/server/model/materials';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_MATERIALS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Use the first tenant membership as the active tenant for listing.
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });  return withTenant(tenantId, async () => {
    const items = await materials.listMaterials();
    return NextResponse.json(items);
  });
}


export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.CREATE_MATERIAL)) {
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

  const { name, sku, description, unit, minStock } = body;
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!sku || typeof sku !== 'string') {
    return NextResponse.json({ error: 'sku is required' }, { status: 400 });
  }
  if (!unit || typeof unit !== 'string') {
    return NextResponse.json({ error: 'unit is required' }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      const item = await materials.createMaterial(tenantId, {
        name,
        sku,
        description: typeof description === 'string' ? description : undefined,
        unit,
        minStock: typeof minStock === 'number' ? minStock : undefined,
      });
      return NextResponse.json(item, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 409 });
    }
  });
}
