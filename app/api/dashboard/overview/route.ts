import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { db } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_DASHBOARD)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    // Materials: count below reorder point and out of stock
    const allMaterials = await db.orm.public.Material
      .select('id', 'name', 'sku', 'minStock', 'currentStock', 'reservedQty')
      .all();

    let outOfStockCount = 0;
    let belowReorderCount = 0;
    let totalMaterials = allMaterials.length;

    for (const m of allMaterials) {
      const available = m.currentStock - m.reservedQty;
      if (available <= 0) outOfStockCount++;
      else if (m.minStock > 0 && available <= m.minStock) belowReorderCount++;
    }

    // Production orders at risk (SCHEDULED or STARTED past their scheduled date)
    const today = new Date();
    const orders = await db.orm.public.ProductionOrder
      .select('id', 'productId', 'machineId', 'quantity', 'status', 'scheduledDate')
      .all();

    let atRiskCount = 0;
    let lateCount = 0;
    for (const o of orders) {
      if (o.status === 'SCHEDULED' || o.status === 'STARTED') {
        atRiskCount++;
        if (o.scheduledDate) {
          const sd = new Date(o.scheduledDate);
          if (sd < today) lateCount++;
        }
      }
    }

    // Production capacity: sum of active machine capacity per day
    const machines = await db.orm.public.Machine
      .select('capacityPerDay', 'isActive')
      .all();

    let totalCapacity = 0;
    for (const m of machines) {
      if (m.isActive) totalCapacity += m.capacityPerDay;
    }

    // Total scheduled quantity vs capacity
    let scheduledQty = 0;
    for (const o of orders) {
      if (o.status === 'SCHEDULED' || o.status === 'STARTED') {
        scheduledQty += o.quantity;
      }
    }

    // Sales orders
    const salesOrders = await db.orm.public.SalesOrder
      .select('id', 'status', 'createdAt')
      .all();

    const openSalesOrders = salesOrders.filter(o => o.status === 'DRAFT' || o.status === 'CONFIRMED').length;
    const totalSalesOrders = salesOrders.length;

    // Suppliers
    const suppliers = await db.orm.public.Supplier
      .select('id')
      .all();

    // Notifications for this user
    const userId = session.user.id;
    const notifications = await db.orm.public.Notification
      .select('id', 'read')
      .where((n) => n.userId.eq(userId))
      .all();

    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({
      materials: {
        total: totalMaterials,
        outOfStock: outOfStockCount,
        belowReorder: belowReorderCount,
      },
      production: {
        totalOrders: orders.length,
        atRisk: atRiskCount,
        late: lateCount,
        capacityPerDay: totalCapacity,
        scheduledQty,
      },
      sales: {
        totalOrders: totalSalesOrders,
        openOrders: openSalesOrders,
      },
      purchasing: {
        suppliers: suppliers.length,
      },
      notifications: {
        unread: unreadCount,
        total: notifications.length,
      },
    });
  });
}
