import { db } from '../db';

export type Material = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  minStock: number;
  currentStock: number;
  reservedQty: number;
  createdAt: string;
  updatedAt: string;
};

export async function listMaterials(): Promise<Material[]> {
  const rows = await db.orm.public.Material
    .select('id', 'name', 'sku', 'description', 'unit', 'minStock', 'currentStock', 'reservedQty', 'createdAt', 'updatedAt')
    .all();
  return rows.map(mapMaterial);
}

export async function getMaterial(id: string): Promise<Material | null> {
  const row = await db.orm.public.Material
    .select('id', 'name', 'sku', 'description', 'unit', 'minStock', 'currentStock', 'reservedQty', 'createdAt', 'updatedAt')
    .where((m) => m.id.eq(id))
    .first();
  return row ? mapMaterial(row) : null;
}

export async function createMaterial(tenantId: string, input: {
  name: string;
  sku: string;
  description?: string;
  unit: string;
  minStock?: number;
  currentStock?: number;
  reservedQty?: number;
}): Promise<Material> {
  const existing = await db.orm.public.Material
    .where((m) => m.sku.eq(input.sku))
    .first();
  if (existing) {
    throw new Error(`SKU ${input.sku} already exists in this tenant`);
  }
  const row = await db.orm.public.Material.create({
    tenantId,
    name: input.name,
    sku: input.sku,
    description: input.description ?? null,
    unit: input.unit,
    minStock: input.minStock ?? 0,
    currentStock: input.currentStock ?? 0,
    reservedQty: input.reservedQty ?? 0,
  });
  return mapMaterial(row);
}

export async function updateMaterial(
  id: string,
  input: {
    name?: string;
    sku?: string;
    description?: string | null;
    unit?: string;
    minStock?: number;
    currentStock?: number;
    reservedQty?: number;
  },
): Promise<Material> {
  const existing = await db.orm.public.Material
    .where((m) => m.id.eq(id))
    .first();
  if (!existing) throw new Error('Material not found');

  if (input.sku && input.sku !== existing.sku) {
    const conflict = await db.orm.public.Material
      .where((m) => m.sku.eq(input.sku!))
      .first();
    if (conflict) throw new Error(`SKU ${input.sku} already exists in this tenant`);
  }

  await db.orm.public.Material
    .where((m) => m.id.eq(id))
    .update({
      name: input.name ?? existing.name,
      sku: input.sku ?? existing.sku,
      description: input.description !== undefined ? (input.description ?? existing.description) : existing.description,
      unit: input.unit ?? existing.unit,
      minStock: input.minStock ?? existing.minStock,
      currentStock: input.currentStock ?? existing.currentStock,
      reservedQty: input.reservedQty ?? existing.reservedQty,
    });

  const updated = await db.orm.public.Material
    .select('id', 'name', 'sku', 'description', 'unit', 'minStock', 'currentStock', 'reservedQty', 'createdAt', 'updatedAt')
    .where((m) => m.id.eq(id))
    .first();
  return updated ? mapMaterial(updated) : mapMaterial(existing);
}

export async function deleteMaterial(id: string): Promise<void> {
  const existing = await db.orm.public.Material
    .where((m) => m.id.eq(id))
    .first();
  if (!existing) throw new Error('Material not found');
  await db.orm.public.Material.where((m) => m.id.eq(id)).delete();
}

function mapMaterial(row: {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  minStock: number;
  currentStock: number;
  reservedQty: number;
  createdAt: string;
  updatedAt: string;
}): Material {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    unit: row.unit,
    minStock: row.minStock,
    currentStock: row.currentStock,
    reservedQty: row.reservedQty,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
