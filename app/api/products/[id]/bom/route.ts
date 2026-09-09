import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import * as products from '@/server/model/products';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.CREATE_BOM)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: productId } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { materialId, quantity, unit } = body;
  if (!materialId || typeof materialId !== 'string') {
    return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
  }
  if (!unit || typeof unit !== 'string') {
    return NextResponse.json({ error: 'unit is required' }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      const result = await products.addBomItem(productId, { materialId, quantity, unit });
      return NextResponse.json({ version: result.version }, { status: 201 });
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

  if (!can(session.roleBindings, Action.UPDATE_BOM)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: productId } = await params;
  const { searchParams } = new URL(_request.url);
  const materialId = searchParams.get('materialId');
  if (!materialId) {
    return NextResponse.json({ error: 'materialId query param is required' }, { status: 400 });
  }

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    try {
      await products.removeBomItem(productId, materialId);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 404 });
    }
  });
}
