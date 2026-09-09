import { db } from '../db';

export type MaterialStock = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  onHand: number;        // current_stock — physical units in the warehouse
  reserved: number;      // reserved_qty — units committed to orders / allocations
  availableToPromise: number; // onHand - reserved — what can still be allocated
  minStock: number;
};

/** Return the current stock snapshot for every material in the tenant. */
export async function listMaterialStock(tenantId: string): Promise<MaterialStock[]> {
  const rows = await db.orm.public.Material
    .select('id', 'name', 'sku', 'unit', 'currentStock', 'reservedQty', 'minStock')
    .where((m) => m.tenantId.eq(tenantId))
    .all();

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    unit: r.unit,
    onHand: r.currentStock,
    reserved: r.reservedQty,
    availableToPromise: r.currentStock - r.reservedQty,
    minStock: r.minStock,
  }));
}

/** Return the stock snapshot for one material. */
export async function getMaterialStock(id: string): Promise<MaterialStock | null> {
  const row = await db.orm.public.Material
    .select('id', 'name', 'sku', 'unit', 'currentStock', 'reservedQty', 'minStock')
    .where((m) => m.id.eq(id))
    .first();
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    onHand: row.currentStock,
    reserved: row.reservedQty,
    availableToPromise: row.currentStock - row.reservedQty,
    minStock: row.minStock,
  };
}
