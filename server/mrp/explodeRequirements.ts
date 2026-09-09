import { db } from '../db';
import * as bomModel from '../model/bom';

export type RequirementRow = {
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: number;
  materialId: string;
  materialName: string;
  materialSku: string;
  quantityPerUnit: number;
  totalRequired: number;
  available: number;
  shortage: number;
  unit: string;
};

/**
 * Explode a sales order's items into material-level requirements via the BOM.
 *
 * For each sales order item:
 *   1. Find the product's current BOM.
 *   2. For each BOM line, compute totalRequired = quantityOrdered * quantityPerUnit.
 *   3. Look up the material's current_stock to get available.
 *   4. shortage = max(0, totalRequired - available).
 *
 * Returns one row per (salesOrderItem × BOM line) so the frontend can show
 * exactly which materials are short for which product line.
 *
 * Throws if the sales order or any product/BOM is missing.
 */
export async function explodeRequirements(
  salesOrderId: string,
): Promise<RequirementRow[]> {
  // Load the sales order items.
  const items = await db.orm.public.SalesOrderItem
    .select('id', 'productId', 'quantity')
    .where((i) => i.salesOrderId.eq(salesOrderId))
    .all();

  if (items.length === 0) return [];

  // Load each product + BOM + material info.
  const rows: RequirementRow[] = [];

  for (const item of items) {
    const product = await db.orm.public.Product
      .select('id', 'name', 'sku')
      .where((p) => p.id.eq(item.productId))
      .first();

    if (!product) continue;

    const currentBom = await bomModel.getCurrentBom(product.id);
    if (!currentBom || currentBom.items.length === 0) continue;

    for (const bomLine of currentBom.items) {
      const material = await db.orm.public.Material
        .select('id', 'name', 'sku', 'currentStock', 'unit')
        .where((m) => m.id.eq(bomLine.materialId))
        .first();

      if (!material) continue;

      const totalRequired = Math.round(item.quantity * bomLine.quantity);
      const available = material.currentStock;
      const shortage = Math.max(0, totalRequired - available);

      rows.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantityOrdered: item.quantity,
        materialId: material.id,
        materialName: material.name,
        materialSku: material.sku,
        quantityPerUnit: bomLine.quantity,
        totalRequired,
        available,
        shortage,
        unit: material.unit,
      });
    }
  }

  return rows;
}
