import { db } from '../db';

export type StockMovementRow = {
  id: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  warehouseId: string | null;
  warehouseName: string | null;
  type: string;
  quantity: number;
  reference: string | null;
  referenceId: string | null;
  createdAt: string;
};

/** List stock movements for a single material, newest first. */
export async function listMaterialMovements(materialId: string): Promise<StockMovementRow[]> {
  const rows = await db.orm.public.StockMovement
    .select('id', 'materialId', 'warehouseId', 'type', 'quantity', 'reference', 'referenceId', 'createdAt')
    .where((m) => m.materialId.eq(materialId))
    .orderBy((m) => m.createdAt.desc())
    .all();

  // Attach material name/sku and warehouse name.
  const material = await db.orm.public.Material
    .select('name', 'sku')
    .where((m) => m.id.eq(materialId))
    .first();

  const warehouses = await db.orm.public.Warehouse
    .select('id', 'name')
    .all();
  const whByName = new Map(warehouses.map((w) => [w.id, w.name]));

  return rows.map((r) => ({
    id: r.id,
    materialId: r.materialId,
    materialName: material?.name ?? 'Unknown',
    materialSku: material?.sku ?? '',
    warehouseId: r.warehouseId,
    warehouseName: r.warehouseId ? whByName.get(r.warehouseId) ?? null : null,
    type: r.type,
    quantity: r.quantity,
    reference: r.reference,
    referenceId: r.referenceId,
    createdAt: r.createdAt,
  }));
}
