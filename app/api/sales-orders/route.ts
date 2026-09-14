import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { db } from '@/server/db';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_SALES_ORDERS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    const rows = await db.orm.public.SalesOrder
      .select('id', 'customer', 'status', 'createdAt', 'updatedAt')
      .orderBy((o) => o.createdAt.desc())
      .all();

    // Attach item count to each order.
    const result = await Promise.all(rows.map(async (row) => {
      const itemCount = await db.orm.public.SalesOrderItem
        .select('id')
        .where((i) => i.salesOrderId.eq(row.id))
        .all();
      return {
        ...row,
        itemCount: itemCount.length,
      };
    }));

    return NextResponse.json(result);
  });
}

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.CREATE_SALES_ORDER)) {
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

  const { customer, items } = body;
  if (!customer || typeof customer !== 'string') {
    return NextResponse.json({ error: 'customer is required' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
  }

  for (const item of items) {
    if (typeof item.productId !== 'string' || typeof item.quantity !== 'number' || item.quantity <= 0) {
      return NextResponse.json({ error: 'Each item needs productId (string) and quantity (positive number)' }, { status: 400 });
    }
  }

  return withTenant(tenantId, async () => {
    try {
      const order = await db.orm.public.SalesOrder.create({
        tenantId,
        customer,
        status: 'DRAFT',
      });

      for (const item of items) {
        await db.orm.public.SalesOrderItem.create({
          salesOrderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
        });
      }

      return NextResponse.json({ id: order.id, customer, status: 'DRAFT', itemCount: items.length }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
