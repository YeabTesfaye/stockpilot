import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { recordMovement } from '@/server/inventory/recordMovement';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.RECORD_MOVEMENT)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: materialId } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, quantity, warehouseId, reference, description } = body;

  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }
  if (quantity === undefined || typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return NextResponse.json({ error: 'quantity is required (number)' }, { status: 400 });
  }
  if (quantity === 0) {
    return NextResponse.json({ error: 'quantity must be non-zero' }, { status: 400 });
  }

  const validTypes = ['PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'TRANSFER', 'ADJUSTMENT', 'RESERVATION', 'RESERVATION_RELEASE'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      const result = await recordMovement({
        materialId,
        warehouseId: typeof warehouseId === 'string' ? warehouseId : undefined,
        type: type as 'PURCHASE' | 'SALE' | 'RETURN' | 'DAMAGE' | 'TRANSFER' | 'ADJUSTMENT' | 'RESERVATION' | 'RESERVATION_RELEASE',
        quantity,
        reference: typeof reference === 'string' ? reference : undefined,
        referenceId: undefined,
        actorUserId: session.user.id,
        actorName: session.user.name,
        tenantId,
        description: typeof description === 'string' ? description : undefined,
      });
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
