import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { reserveStock } from '@/server/inventory/reserve';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.RESERVE_STOCK)) {
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

  const { quantity } = body;
  if (quantity === undefined || typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      const result = await reserveStock(
        materialId,
        quantity,
        tenantId,
        session.user.id,
        session.user.name,
        `Manual reservation from UI`,
      );
      return NextResponse.json({
        message: `Reserved ${quantity} units. Previously reserved: ${result.previousReserved}, now: ${result.newReserved}.`,
        result,
      }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
