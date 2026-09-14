import { db } from '../db';

export type Machine = {
  id: string;
  name: string;
  code: string | null;
  capacityPerDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductionOrderRow = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  machineId: string;
  machineName: string;
  machineCode: string | null;
  quantity: number;
  scheduledDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export async function listMachines(): Promise<Machine[]> {
  const rows = await db.orm.public.Machine
    .select('id', 'name', 'code', 'capacityPerDay', 'isActive', 'createdAt', 'updatedAt')
    .all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    code: r.code,
    capacityPerDay: r.capacityPerDay,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getMachine(id: string): Promise<Machine | null> {
  const row = await db.orm.public.Machine
    .select('id', 'name', 'code', 'capacityPerDay', 'isActive', 'createdAt', 'updatedAt')
    .where((m) => m.id.eq(id))
    .first();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    capacityPerDay: row.capacityPerDay,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createMachine(tenantId: string, input: {
  name: string;
  code?: string;
  capacityPerDay?: number;
}): Promise<Machine> {
  const row = await db.orm.public.Machine.create({
    tenantId,
    name: input.name,
    code: input.code ?? null,
    capacityPerDay: input.capacityPerDay ?? 1,
    isActive: true,
  });
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    capacityPerDay: row.capacityPerDay,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function updateMachine(id: string, input: {
  name?: string;
  code?: string | null;
  capacityPerDay?: number;
  isActive?: boolean;
}): Promise<Machine> {
  const existing = await db.orm.public.Machine
    .where((m) => m.id.eq(id))
    .first();
  if (!existing) throw new Error('Machine not found');

  await db.orm.public.Machine
    .where((m) => m.id.eq(id))
    .update({
      name: input.name ?? existing.name,
      code: input.code !== undefined ? input.code : existing.code,
      capacityPerDay: input.capacityPerDay ?? existing.capacityPerDay,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
    });

  const updated = await db.orm.public.Machine
    .select('id', 'name', 'code', 'capacityPerDay', 'isActive', 'createdAt', 'updatedAt')
    .where((m) => m.id.eq(id))
    .first();
  return updated ? {
    id: updated.id,
    name: updated.name,
    code: updated.code,
    capacityPerDay: updated.capacityPerDay,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  } : {
    id: id,
    name: existing.name,
    code: existing.code,
    capacityPerDay: existing.capacityPerDay,
    isActive: existing.isActive,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  };
}

export async function deleteMachine(id: string): Promise<void> {
  const existing = await db.orm.public.Machine
    .where((m) => m.id.eq(id))
    .first();
  if (!existing) throw new Error('Machine not found');
  await db.orm.public.Machine.where((m) => m.id.eq(id)).delete();
}

export async function listProductionOrders(): Promise<ProductionOrderRow[]> {
  const rows = await db.orm.public.ProductionOrder
    .select('id', 'productId', 'machineId', 'quantity', 'scheduledDate', 'startedAt', 'completedAt', 'status', 'createdAt', 'updatedAt')
    .orderBy((o) => o.scheduledDate.asc())
    .all();

  const result: ProductionOrderRow[] = [];
  for (const row of rows) {
    const product = await db.orm.public.Product
      .select('name', 'sku')
      .where((p) => p.id.eq(row.productId))
      .first();
    const machine = await db.orm.public.Machine
      .select('name', 'code')
      .where((m) => m.id.eq(row.machineId))
      .first();
    result.push({
      id: row.id,
      productId: row.productId,
      productName: product?.name ?? 'Unknown',
      productSku: product?.sku ?? '',
      machineId: row.machineId,
      machineName: machine?.name ?? 'Unknown',
      machineCode: machine?.code ?? null,
      quantity: row.quantity,
      scheduledDate: row.scheduledDate,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  return result;
}

export async function getProductionOrder(id: string): Promise<ProductionOrderRow | null> {
  const rows = await listProductionOrders();
  return rows.find(r => r.id === id) ?? null;
}

export async function createProductionOrderDb(tenantId: string, productId: string, machineId: string, quantity: number): Promise<ProductionOrderRow> {
  const order = await db.orm.public.ProductionOrder.create({
    tenantId,
    productId,
    machineId,
    quantity,
    status: 'SCHEDULED',
  });
  return getProductionOrder(order.id) as Promise<ProductionOrderRow>;
}

export async function updateProductionOrderStatus(id: string, status: string): Promise<ProductionOrderRow> {
  const existing = await db.orm.public.ProductionOrder
    .where((o) => o.id.eq(id))
    .first();
  if (!existing) throw new Error('Production order not found');

  const updateData: Record<string, unknown> = { status };
  if (status === 'STARTED') updateData['startedAt'] = new Date().toISOString();
  if (status === 'COMPLETED') updateData['completedAt'] = new Date().toISOString();

  await db.orm.public.ProductionOrder
    .where((o) => o.id.eq(id))
    .update(updateData);

  return getProductionOrder(id) as Promise<ProductionOrderRow>;
}

export async function deleteProductionOrder(id: string): Promise<void> {
  const existing = await db.orm.public.ProductionOrder
    .where((o) => o.id.eq(id))
    .first();
  if (!existing) throw new Error('Production order not found');
  await db.orm.public.ProductionOrder.where((o) => o.id.eq(id)).delete();
}
