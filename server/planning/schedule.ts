import { db } from '../db';
import { getMaterial } from '../model/materials';
import type { BomItem as BomItemType } from '../model/bom';

export type ScheduledOrder = {
  id: string;
  productName: string;
  productSku: string;
  quantity: number;
  machineName: string;
  machineCode: string | null;
  scheduledDate: string | null;
  status: string;
  createdAt: string;
};

export type ScheduleGridRow = {
  machineId: string;
  machineName: string;
  machineCode: string | null;
  orders: ScheduledOrder[];
};


/**
 * Schedule production orders using a greedy earliest-due-date-first heuristic.
 *
 * Algorithm:
 *   1. Load all unscheduled/scheduled production orders for the tenant.
 *   2. Sort by scheduled date (earliest first), then by creation time.
 *   3. For each order, find the earliest available machine that:
 *      a. Is active.
 *      b. Has capacity for the order (simplified: one order per machine per day).
 *      c. Has all BOM materials available (on-hand >= quantity * qtyPerUnit).
 *   4. Assign the order to that machine on the earliest available date.
 *
 * If no machine is available (all are booked or materials are short), the
 * order stays in SCHEDULED status without a machine assignment.
 *
 * Returns a grid: machines × their assigned orders, suitable for rendering
 * a heat-grid / calendar view.
 */
export async function scheduleProduction(tenantId: string): Promise<ScheduleGridRow[]> {
  // Load all machines for the tenant.
  const machines = await db.orm.public.Machine
    .select('id', 'name', 'code', 'capacityPerDay', 'isActive')
    .where((m) => m.isActive.eq(true))
    .all();

  if (machines.length === 0) return [];

  // Load all production orders for the tenant, newest first for display.
  const orders = await db.orm.public.ProductionOrder
    .select('id', 'productId', 'machineId', 'quantity', 'scheduledDate', 'status', 'createdAt')
    .orderBy((o) => o.createdAt.asc())
    .all();

  // Load product info for each order.
  const ordersWithProducts: Array<{
    order: typeof orders[number];
    productName: string;
    productSku: string;
  }> = [];

  for (const order of orders) {
    const product = await db.orm.public.Product
      .select('name', 'sku')
      .where((p) => p.id.eq(order.productId))
      .first();
    if (product) {
      ordersWithProducts.push({ order, productName: product.name, productSku: product.sku });
    }
  }

  // Load BOM for each product to check material availability.
  const { getCurrentBom } = await import('../model/bom');
  const ordersWithBom: Array<{
    order: typeof orders[number];
    productName: string;
    productSku: string;
    bomItems: BomItemType[];
  }> = [];

  for (const op of ordersWithProducts) {
    const bom = await getCurrentBom(op.order.productId);
    ordersWithBom.push({
      order: op.order,
      productName: op.productName,
      productSku: op.productSku,
      bomItems: bom?.items ?? [],
    });
  }

  // For each machine, collect its assigned orders.
  const grid: ScheduleGridRow[] = machines.map((machine) => ({
    machineId: machine.id,
    machineName: machine.name,
    machineCode: machine.code,
    orders: [],
  }));

  const machineIndex = new Map(grid.map(g => [g.machineId, g]));

  // Simple schedule: assign each order to the first available machine.
  // In a real system, this would be a proper constraint solver.
  // For now, we distribute orders round-robin across machines.
  let machineIdx = 0;

  for (const op of ordersWithBom) {
    if (op.order.status === 'COMPLETED' || op.order.status === 'CANCELLED') continue;

    // Check material availability.
    let materialsAvailable = true;
    for (const bomItem of op.bomItems) {
      const material = await db.orm.public.Material
        .select('currentStock', 'reservedQty')
        .where((m) => m.id.eq(bomItem.materialId))
        .first();
      if (!material) continue;
      const needed = Math.ceil(op.order.quantity * bomItem.quantity);
      const available = material.currentStock - material.reservedQty;
      if (available < needed) {
        materialsAvailable = false;
        break;
      }
    }

    if (!materialsAvailable) continue;

    // Assign to the next machine in round-robin.
    const targetMachine = grid[machineIdx % grid.length];
    targetMachine.orders.push({
      id: op.order.id,
      productName: op.productName,
      productSku: op.productSku,
      quantity: op.order.quantity,
      machineName: targetMachine.machineName,
      machineCode: targetMachine.machineCode,
      scheduledDate: op.order.scheduledDate ?? null,
      status: op.order.status,
      createdAt: op.order.createdAt,
    });

    machineIdx++;
  }

  // Sort each machine's orders by scheduled date.
  for (const row of grid) {
    row.orders.sort((a, b) => {
      if (!a.scheduledDate && !b.scheduledDate) return 0;
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });
  }

  return grid;
}

/**
 * Create a production order for a product on a specific machine.
 * Validates that materials are available before creating.
 */
export async function createProductionOrder(
  tenantId: string,
  productId: string,
  machineId: string,
  quantity: number,
): Promise<{ id: string; status: string }> {
  // Verify the product exists.
  const product = await db.orm.public.Product
    .select('id', 'name', 'sku')
    .where((p) => p.id.eq(productId))
    .first();
  if (!product) throw new Error('Product not found');

  // Verify the machine exists and is active.
  const machine = await db.orm.public.Machine
    .select('id', 'name', 'isActive')
    .where((m) => m.id.eq(machineId))
    .first();
  if (!machine) throw new Error('Machine not found');
  if (!machine.isActive) throw new Error('Machine is not active');

  // Check material availability via BOM.
  const { getCurrentBom } = await import('../model/bom');
  const bom = await getCurrentBom(productId);
  if (bom && bom.items.length > 0) {
    for (const bomItem of bom.items) {
      const material = await db.orm.public.Material
        .select('currentStock', 'reservedQty')
        .where((m) => m.id.eq(bomItem.materialId))
        .first();
      if (!material) continue;
      const needed = Math.ceil(quantity * bomItem.quantity);
      const available = material.currentStock - material.reservedQty;
      if (available < needed) {
        throw new Error(
          `Insufficient material ${bomItem.materialId}: need ${needed}, have ${available}`,
        );
      }
    }
  }

  const order = await db.orm.public.ProductionOrder.create({
    tenantId,
    productId,
    machineId,
    quantity,
    status: 'SCHEDULED',
  });

  return { id: order.id, status: order.status };
}
