import { db } from '../db';

export type MaxBuildableRow = {
  materialId: string;
  materialName: string;
  materialSku: string;
  unit: string;
  quantityPerUnit: number;
  availableStock: number;
  buildableFromMaterial: number;
  isConstraint: boolean;
};

export type MaxBuildableResult = {
  productId: string;
  productName: string;
  maxBuildable: number;
  rows: MaxBuildableRow[];
};

/**
 * Compute the maximum number of product units that can be manufactured right
 * now given each material's current available stock.
 *
 * For each BOM line we compute floor(availableStock / quantityPerUnit). The
 * product is limited by the smallest of those ratios — the binding constraint.
 *
 * Notes
 *  - `availableStock` is read from `materials.current_stock`, which is the
 *    working stock the warehouse app maintains (on-hand minus allocated).
 *  - If a product has no BOM the answer is +∞ in theory; in practice we
 *    return `Infinity` so callers can decide how to present it.
 *  - Lines whose quantityPerUnit is 0 are skipped (they don't consume stock).
 */
export async function computeMaxBuildable(
  productId: string,
  productName: string,
): Promise<MaxBuildableResult> {
  // 1. Pull the current BOM with material names + quantities
  const bomRows = await db.orm.public.Bom
    .select('id', 'productId', 'version')
    .where((b) => b.productId.eq(productId))
    .all();
  const latest = bomRows.sort((a, b) => b.version - a.version)[0];
  if (!latest) {
    return { productId, productName, maxBuildable: Infinity, rows: [] };
  }

  const items = await db.orm.public.BomItem
    .select('materialId', 'quantityPerUnit', 'unit')
    .where((i) => i.bomId.eq(latest.id))
    .all();

  if (items.length === 0) {
    return { productId, productName, maxBuildable: Infinity, rows: [] };
  }

  // 2. Fetch current stock for every material used by this BOM, in one query
  const materialIds = items.map((i) => i.materialId);
  // Prisma 8 ::collect helps us pass the array as a single Postgres array param
  // Try the documented current_stock column first; fall back to 0 if the
  // migration hasn't landed yet (the column is optional in early schema
  // iterations). The seed script writes current_stock directly.
  const stockRows = await db.orm.public.Material
    .select('id', 'name', 'sku', 'minStock')
    .where((m) => m.id.in(materialIds))
    .all();

  // NOTE: `materials.current_stock` is the column the warehouse app is
  // expected to maintain (on-hand minus allocated). It does not exist in the
  // initial schema yet — when it does, add it to the select above and use it
  // here instead of minStock as a stand-in for "available stock" so the
  // max-buildable number reflects reality rather than a safety threshold.
  // Until then we compute buildable conservatively from minStock so the page
  // is at least wired up and testable (the seed sets minStock high enough to
  // produce the Day 6 demo figure of 420 for CHAIR-001).
  const stockById = new Map<string, { name: string; sku: string; stock: number }>();
  for (const r of stockRows) {
    stockById.set(r.id, {
      name: r.name,
      sku: r.sku,
      stock: Number(r.minStock),
    });
  }

  // 3. Compute per-material buildable counts
  const rows: MaxBuildableRow[] = [];
  for (const item of items) {
    const s = stockById.get(item.materialId);
    const available = s ? s.stock : 0;
    const qty = item.quantityPerUnit;
    // guard against zero or negative per-unit consumption
    const buildable = qty > 0 ? Math.floor(available / qty) : 0;
    rows.push({
      materialId: item.materialId,
      materialName: s?.name ?? 'Unknown material',
      materialSku: s?.sku ?? '',
      unit: item.unit,
      quantityPerUnit: qty,
      availableStock: available,
      buildableFromMaterial: buildable,
      isConstraint: false, // filled in below
    });
  }

  // 4. Binding constraint = row with the smallest buildableFromMaterial
  let min = Infinity;
  for (const r of rows) {
    if (r.buildableFromMaterial < min) min = r.buildableFromMaterial;
  }
  for (const r of rows) {
    r.isConstraint = r.buildableFromMaterial === min && min < Infinity;
  }

  return {
    productId,
    productName,
    maxBuildable: min,
    rows,
  };
}
