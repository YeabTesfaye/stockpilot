import { db } from '../db';

/**
 * A material is below its reorder point when available stock (currentStock
 * minus reservedQty) falls at or below the minStock threshold.
 *
 * Returns materials that need replenishment, sorted by urgency (lowest
 * available first).
 */
export async function getMaterialsBelowReorderPoint(tenantId: string) {
  const rows = await db.orm.public.Material
    .select('id', 'name', 'sku', 'unit', 'minStock', 'currentStock', 'reservedQty')
    .all();

  const below: Array<{
    id: string;
    name: string;
    sku: string;
    unit: string;
    minStock: number;
    currentStock: number;
    reservedQty: number;
    available: number;
    shortage: number;
  }> = [];

  for (const row of rows) {
    const available = row.currentStock - row.reservedQty;
    if (available <= row.minStock) {
      below.push({
        ...row,
        available,
        shortage: Math.max(0, row.minStock - available + 1), // +1 to get back above point
      });
    }
  }

  below.sort((a, b) => a.available - b.available);
  return below;
}

/**
 * Refresh the reorder point status for all materials. Used by the
 * background job processor (jobs/processors/reorderPointRefresh.ts).
 *
 * Returns a summary: total materials, count below reorder point,
 * and the most critical materials.
 */
export async function refreshReorderPointStatus(tenantId: string) {
  const below = await getMaterialsBelowReorderPoint(tenantId);
  const total = await db.orm.public.Material
    .select('id')
    .count();

  return {
    totalMaterials: Number(total),
    belowReorderCount: below.length,
    criticalMaterials: below.slice(0, 5),
    refreshedAt: new Date().toISOString(),
  };
}
