import { db } from '../db';

export type RankedSupplier = {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  leadTimeDays: number;
  score: number;
  rank: number;
};

/**
 * Rank suppliers for a set of materials. For each material, returns the
 * suppliers that can provide it, sorted by a composite score.
 *
 * Scoring formula:
 *   score = 1 / (unitPrice * leadTimeDays)
 *
 * This is the inverse of the cost-to-serve: a supplier that is both cheap
 * AND fast scores highest. A cheap-but-slow supplier (A) and a fast-but-
 * expensive supplier (C) both score lower than a balanced supplier (B).
 *
 * Test case (see docs/writeups/supplier-ranking.md):
 *   Supplier A: $5/unit, 30-day lead time → score = 1/150 = 0.0067
 *   Supplier B: $8/unit, 7-day lead time   → score = 1/56  = 0.0179  ← WINNER
 *   Supplier C: $30/unit, 2-day lead time  → score = 1/60  = 0.0167
 *
 * Returns: { [materialIndex]: RankedSupplier[] }
 */
export async function rankSuppliers(
  tenantId: string,
  materialIds: string[],
): Promise<Record<number, RankedSupplier[]>> {
  // Load all supplier-material relationships for the tenant.
  const smRows = await db.orm.public.SupplierMaterial
    .select('id', 'supplierId', 'materialId', 'unitPrice', 'leadTimeDays')
    .all();

  // Load suppliers for name lookup.
  const supplierIds = [...new Set(smRows.map(r => r.supplierId))];
  const suppliers = await db.orm.public.Supplier
    .select('id', 'name')
    .where((s) => s.id.in(supplierIds))
    .all();
  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

  const result: Record<number, RankedSupplier[]> = {};

  for (let i = 0; i < materialIds.length; i++) {
    const matId = materialIds[i];

    // Find all supplier-material rows for this material.
    const matSmRows = smRows.filter(r => r.materialId === matId);

    const ranked: RankedSupplier[] = [];

    for (const sm of matSmRows) {
      const supplierName = supplierMap.get(sm.supplierId) ?? 'Unknown';
      // Score = 1 / (unitPrice * leadTimeDays). Higher is better.
      // A low price AND short lead time gives the best score.
      const score = 1 / (sm.unitPrice * sm.leadTimeDays);

      ranked.push({
        supplierId: sm.supplierId,
        supplierName,
        unitPrice: sm.unitPrice,
        leadTimeDays: sm.leadTimeDays,
        score,
        rank: 0, // filled below
      });
    }

    // Sort by score descending and assign ranks.
    ranked.sort((a, b) => b.score - a.score);
    ranked.forEach((r, idx) => { r.rank = idx + 1; });

    result[i] = ranked;
  }

  return result;
}
