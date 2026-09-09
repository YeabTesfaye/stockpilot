import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { recordMovement } from '@/server/inventory/recordMovement';
import { getPgPool } from '@/server/auth/session';

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_INVENTORY)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '1');
  const limit = Number(searchParams.get('limit') ?? '50');
  const materialId = searchParams.get('materialId') ?? undefined;

  return withTenant(tenantId, async () => {
    try {
      const pool = getPgPool();
      const conditions: string[] = ['tenant_id = current_setting($1, true)'];
      const params: (string | number)[] = [tenantId];

      if (materialId) {
        conditions.push(`material_id = $${params.length + 1}`);
        params.push(materialId);
      }

      const whereSql = conditions.join(' AND ');
      const offset = (page - 1) * limit;

      const countResult = await pool.query(
        `SELECT COUNT(*) AS total FROM stock_movements WHERE ${whereSql}`,
        params,
      );
      const total = Number(countResult.rows[0].total);

      const rows = await pool.query(
        `SELECT id, material_id AS "materialId", warehouse_id AS "warehouseId",
                type, quantity, reference, reference_id AS "referenceId",
                created_at AS "createdAt"
         FROM stock_movements
         WHERE ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return NextResponse.json({
        movements: rows.rows,
        pagination: { page, limit, total },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.RECORD_MOVEMENT)) {
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

  const { type, quantity, materialId, warehouseId, reference, description, idempotencyKey } = body;

  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }
  if (!materialId || typeof materialId !== 'string') {
    return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
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
        idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
      });
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
