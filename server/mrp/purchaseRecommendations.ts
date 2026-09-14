import { db } from '../db';

export type PurchaseRecommendation = {
  id: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  recommendedQuantity: number;
  unit: string;
  suggestedSupplierId: string | null;
  suggestedSupplierName: string | null;
  estimatedCost: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  createdAt: string;
};

/**
 * Generate purchase recommendations for all materials that are below
 * their reorder point or have outstanding shortages from sales orders.
 *
 * For each material that needs replenishment:
 *   1. Calculate how many units to buy (cover the gap + lead time demand).
 *   2. Find the best supplier for that material (lowest unit price, factoring
 *      lead time — see server/suppliers/rank.ts).
 *   3. Assign a priority based on how critical the shortage is.
 *
 * This function is designed to be called from a background job processor
 * (jobs/processors/purchaseRecommendation.ts) after a sales order is
 * confirmed or on a periodic refresh.
 */
export async function generatePurchaseRecommendations(tenantId: string): Promise<PurchaseRecommendation[]> {
  // Load all materials for the tenant with their current stock, reserved qty,
  // min stock (reorder point), and unit.
  const materials = await db.orm.public.Material
    .select('id', 'name', 'sku', 'unit', 'minStock', 'currentStock', 'reservedQty')
    .all();

  if (materials.length === 0) return [];

  // Load supplier rankings per material (best supplier first).
  const { rankSuppliers } = await import('../suppliers/rank');
  const materialIds = materials.map(m => m.id);
  const rankings = await rankSuppliers(tenantId, materialIds);

  const recommendations: PurchaseRecommendation[] = [];

  for (const mat of materials) {
    const available = mat.currentStock - mat.reservedQty;
    const reorderPoint = mat.minStock;

    // Determine the shortage: if available < reorder point, we need to buy
    // enough to get back above the reorder point. Also factor in any
    // outstanding demand (reserved_qty already accounted for in available).
    let recommendedQty = 0;
    let priority: 'high' | 'medium' | 'low' = 'low';
    let reason = '';

    if (available <= 0 && mat.currentStock <= 0) {
      // Completely out of stock — highest priority.
      recommendedQty = Math.max(reorderPoint * 2, 50);
      priority = 'high';
      reason = `Out of stock (0 on hand). Recommend ${recommendedQty} units to re-establish inventory.`;
    } else if (available < reorderPoint) {
      // Below reorder point — buy enough to get to 2x reorder point.
      recommendedQty = Math.max(Math.ceil((reorderPoint * 2) - available), reorderPoint);
      priority = available <= 0 ? 'high' : 'medium';
      reason = `Below reorder point (${available} available vs ${reorderPoint} min).`;
    } else {
      // Above reorder point — no recommendation needed.
      continue;
    }

    // Find the best supplier for this material.
    const materialRankings = rankings[materialIds.indexOf(mat.id)];
    const bestSupplier = materialRankings?.[0];

    const estimatedCost = recommendedQty * (bestSupplier?.unitPrice ?? 0);

    recommendations.push({
      id: crypto.randomUUID(),
      materialId: mat.id,
      materialName: mat.name,
      materialSku: mat.sku,
      recommendedQuantity: recommendedQty,
      unit: mat.unit,
      suggestedSupplierId: bestSupplier?.supplierId ?? null,
      suggestedSupplierName: bestSupplier?.supplierName ?? null,
      estimatedCost,
      priority,
      reason,
      createdAt: new Date().toISOString(),
    });
  }

  // Sort by priority: high first, then medium, then low.
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
