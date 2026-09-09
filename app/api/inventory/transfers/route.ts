import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { transferStock } from '@/server/inventory/transfer';

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.TRANSFER_STOCK)) {
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

  const { materialId, fromWarehouseId, toWarehouseId, quantity, reference } = body;
  if (!materialId || typeof materialId !== 'string') {
    return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
  }
  if (!fromWarehouseId || typeof fromWarehouseId !== 'string') {
    return NextResponse.json({ error: 'fromWarehouseId is required' }, { status: 400 });
  }
  if (!toWarehouseId || typeof toWarehouseId !== 'string') {
    return NextResponse.json({ error: 'toWarehouseId is required' }, { status: 400 });
  }
  if (quantity === undefined || typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      const result = await transferStock(
        materialId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        tenantId,
        session.user.id,
        session.user.name,
        typeof reference === 'string' ? reference : undefined,
      );
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
