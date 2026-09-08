import { db } from '../db';

export type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listWarehouses(): Promise<Warehouse[]> {
  const rows = await db.orm.public.Warehouse
    .select('id', 'name', 'code', 'address', 'createdAt', 'updatedAt')
    .all();
  return rows.map(mapWarehouse);
}

export async function getWarehouse(id: string): Promise<Warehouse | null> {
  const row = await db.orm.public.Warehouse
    .select('id', 'name', 'code', 'address', 'createdAt', 'updatedAt')
    .where((w) => w.id.eq(id))
    .first();
  return row ? mapWarehouse(row) : null;
}

export async function createWarehouse(tenantId: string, input: {
  name: string;
  code?: string;
  address?: string;
}): Promise<Warehouse> {
  const row = await db.orm.public.Warehouse.create({
    tenantId,
    name: input.name,
    code: input.code ?? null,
    address: input.address ?? null,
  });
  return mapWarehouse(row);
}

export async function updateWarehouse(
  id: string,
  input: { name?: string; code?: string | null; address?: string | null },
): Promise<Warehouse> {
  const existing = await db.orm.public.Warehouse
    .where((w) => w.id.eq(id))
    .first();
  if (!existing) throw new Error('Warehouse not found');

  await db.orm.public.Warehouse
    .where((w) => w.id.eq(id))
    .update({
      name: input.name ?? existing.name,
      code: input.code !== undefined ? input.code : existing.code,
      address: input.address !== undefined ? input.address : existing.address,
    });

  const updated = await db.orm.public.Warehouse
    .select('id', 'name', 'code', 'address', 'createdAt', 'updatedAt')
    .where((w) => w.id.eq(id))
    .first();
  return updated ? mapWarehouse(updated) : mapWarehouse(existing);
}

export async function deleteWarehouse(id: string): Promise<void> {
  const existing = await db.orm.public.Warehouse
    .where((w) => w.id.eq(id))
    .first();
  if (!existing) throw new Error('Warehouse not found');
  await db.orm.public.Warehouse.where((w) => w.id.eq(id)).delete();
}

function mapWarehouse(row: {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}): Warehouse {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
