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
  historicalDays: number; // how many days of history we had
  averageDailyDemand: number;
  projection: ForecastPoint[];
  totalProjectedDemand: number;
  generatedAt: string;
};

export async function forecastDemand(materialId: string): Promise<ForecastResult> {
  // Load stock movements for the last 14 days (we use 7 for the average,
  // but keep 14 to have a buffer).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const movements = await db.orm.public.StockMovement
    .select('type', 'quantity', 'createdAt')
    .where((m) => m.materialId.eq(materialId))
    .all();

  // Filter to the last 14 days and aggregate by day.
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

  // Compute 7-day moving average.
  const sortedDays = Object.keys(dayBuckets).sort();
  const recentBuckets = sortedDays.slice(-7);
  const recentTotal = recentBuckets.reduce((sum, d) => sum + (dayBuckets[d] ?? 0), 0);
  const averageDailyDemand = recentTotal / 7;

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
    historicalDays: recentBuckets.length,
    averageDailyDemand: Math.round(averageDailyDemand * 100) / 100,
    projection,
    totalProjectedDemand: Math.round(cumulative * 100) / 100,
    generatedAt: new Date().toISOString(),
  };
}
