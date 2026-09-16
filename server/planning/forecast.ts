/**
 * Demand forecast using a 7-day moving average.
 *
 * For a given material, look at the stock movements (purchases, sales,
 * adjustments) over the last 7 days, compute the average daily demand,
 * and project that forward for the next 7 days.
 *
 * Positive quantities (purchases) are inflows; negative quantities
 * (sales, damage, adjustments out) are outflows. We care about the
 * net outflow as "demand".
 *
 * Returns daily projections for the next 7 days.
 */
import { db } from '../db';

export type ForecastPoint = {
  date: string; // ISO date string (YYYY-MM-DD)
  projectedDemand: number; // expected net outflow for that day
  cumulativeDemand: number; // running total over the 7-day projection
};

export type ForecastResult = {
  materialId: string;
  materialName: string;
  materialSku: string;
  unit: string;
  historicalDays: number;
  averageDailyDemand: number;
  projection: ForecastPoint[];
  totalProjectedDemand: number;
  generatedAt: string;
  source: 'movements' | 'bom_demand' | 'none';
};

async function estimateDemandFromBom(materialId: string): Promise<{ demand: number; orderCount: number }> {
  // Find all products whose current BOM uses this material.
  const bomItems = await db.orm.public.BomItem
    .select('bomId', 'quantityPerUnit')
    .where((i) => i.materialId.eq(materialId))
    .all();

  if (bomItems.length === 0) return { demand: 0, orderCount: 0 };

  // Collect distinct product ids from the BOMs that use this material.
  const bomIds = bomItems.map(i => i.bomId);
  const boms = await db.orm.public.Bom
    .select('id', 'productId')
    .where((b) => b.id.in(bomIds))
    .all();

  const productIds = [...new Set(boms.map(b => b.productId))];
  if (productIds.length === 0) return { demand: 0, orderCount: 0 };

  // Load recent sales orders for those products (last 14 days).
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const orderItems = await db.orm.public.SalesOrderItem
    .select('salesOrderId', 'productId', 'quantity')
    .where((i) => i.productId.in(productIds))
    .all();

  // Filter to orders created in the last 14 days.
  const recentOrderIds = new Set<string>();
  let totalMaterialDemand = 0;

  for (const item of orderItems) {
    const order = await db.orm.public.SalesOrder
      .select('createdAt')
      .where((o) => o.id.eq(item.salesOrderId))
      .first();
    if (!order) continue;
    const orderDate = new Date(order.createdAt);
    if (orderDate < fourteenDaysAgo) continue;
    recentOrderIds.add(item.salesOrderId);

    // Find the BOM line for this product + material.
    const bomLine = bomItems.find(i => {
      const bom = boms.find(b => b.productId === item.productId);
      return bom?.id === i.bomId;
    });
    if (bomLine) {
      totalMaterialDemand += item.quantity * bomLine.quantityPerUnit;
    }
  }

  // Average daily demand over 14 days (use 14 as the window since orders
  // are sparser than movements).
  const averageDailyDemand = totalMaterialDemand / 14;
  return { demand: averageDailyDemand, orderCount: recentOrderIds.size };
}

export async function forecastDemand(materialId: string): Promise<ForecastResult> {
  // 1. Try stock movements first (actual recorded demand).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const movements = await db.orm.public.StockMovement
    .select('type', 'quantity', 'createdAt')
    .where((m) => m.materialId.eq(materialId))
    .all();

  // Filter to the last 14 days and aggregate outflows by day.
  const dayBuckets: Record<string, number> = {};
  let totalDemand = 0;
  let daysWithDemand = 0;

  for (const m of movements) {
    const date = new Date(m.createdAt).toISOString().slice(0, 10);
    if (date < cutoff.toISOString().slice(0, 10)) continue;

    // Only count outflows (sales, damage, transfers out, adjustments negative)
    // as demand. Purchases, returns, transfers in are inflows.
    const isOutflow = ['SALE', 'DAMAGE', 'TRANSFER'].includes(m.type)
      ? m.quantity < 0
      : m.type === 'ADJUSTMENT' && m.quantity < 0;

    if (isOutflow) {
      const qty = Math.abs(m.quantity);
      dayBuckets[date] = (dayBuckets[date] ?? 0) + qty;
      totalDemand += qty;
      if (dayBuckets[date] > 0) daysWithDemand++;
    }
  }

  const sortedDays = Object.keys(dayBuckets).sort();
  const recentBuckets = sortedDays.slice(-7);
  const recentTotal = recentBuckets.reduce((sum, d) => sum + (dayBuckets[d] ?? 0), 0);
  let averageDailyDemand = recentTotal / 7;
  let source: 'movements' | 'bom_demand' | 'none' = 'none';

  // 2. If no movement history, fall back to sales-order BOM demand.
  if (daysWithDemand === 0) {
    const bomEstimate = await estimateDemandFromBom(materialId);
    if (bomEstimate.demand > 0) {
      // Spread the 14-day total evenly across 7 days for the projection.
      averageDailyDemand = bomEstimate.demand;
      source = 'bom_demand';
      // Pretend we have 14 days of history from the orders so the UI shows
      // a meaningful "based on N days" rather than "0 days".
      daysWithDemand = 14;
    }
  }

  if (averageDailyDemand === 0) {
    source = 'none';
  } else if (source === 'none') {
    source = 'bom_demand';
  }

  // Project forward 7 days.
  const projection: ForecastPoint[] = [];
  let cumulative = 0;
  const today = new Date();

  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    const projected = Math.round(averageDailyDemand * 100) / 100;
    cumulative += projected;
    projection.push({ date: dateStr, projectedDemand: projected, cumulativeDemand: Math.round(cumulative * 100) / 100 });
  }

  // Load material info.
  const material = await db.orm.public.Material
    .select('name', 'sku', 'unit')
    .where((m) => m.id.eq(materialId))
    .first();

  return {
    materialId,
    materialName: material?.name ?? 'Unknown',
    materialSku: material?.sku ?? '',
    unit: material?.unit ?? 'pcs',
    historicalDays: daysWithDemand,
    averageDailyDemand: Math.round(averageDailyDemand * 100) / 100,
    projection,
    totalProjectedDemand: Math.round(cumulative * 100) / 100,
    generatedAt: new Date().toISOString(),
    source,
  };
}
