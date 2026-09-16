/**
 * Day 25 — benchmark: inventory availability query.
 *
 * The max-buildable and schedule pages both need per-material available stock
 * (current_stock − reserved_qty) for a set of material ids. This script times
 * that query shape at different scales so we have a documented baseline.
 *
 * Usage:
 *   DATABASE_URL=... pnpm exec tsx scripts/benchmark-inventory-query.ts
 *
 * Requires a running Postgres with material data (the seed is enough for a
 * small-scale baseline; load the DB with realistic data for a real baseline).
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL']! });
const iterations = parseInt(process.env['BENCH_ITERATIONS'] || '100', 10);
const materialCount = parseInt(process.env['BENCH_MATERIAL_COUNT'] || '50', 10);

async function bench(label: string, fn: () => Promise<unknown>) {
  // Warmup.
  for (let i = 0; i < 10; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`${label.padEnd(40)}  avg ${(avg).toFixed(3)}ms  total ${total.toFixed(0)}ms  (over ${iterations} runs)`);
  return avg;
}

async function main() {
  console.log(`Benchmark: ${iterations} iterations, material count target = ${materialCount}`);
  console.log('Collecting material ids from the database...');

  const materialIds = await pool.query<{ id: string }>(
    `SELECT id FROM materials LIMIT $1`,
    [materialCount],
  );

  const ids = materialIds.rows.map(r => r.id);
  if (ids.length === 0) {
    console.log('No materials found. Seed the database first.');
    process.exit(0);
  }
  console.log(`Found ${ids.length} materials.`);

  // Bind values for the IN clause. Postgres supports up to 32767 params;
  // we generate placeholders for each id.
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const values = ids;

  console.log('\n--- Query benchmarks ---');

  // Query 1: single-row SELECT with param (baseline).
  await bench('Single row by id (1 param)', async () => {
    const target = ids[Math.floor(Math.random() * ids.length)];
    return pool.query('SELECT id, current_stock, reserved_qty FROM materials WHERE id = $1', [target]);
  });

  // Query 2: batch SELECT with N params (the max-buildable / schedule pattern).
  await bench(`Batch SELECT ${ids.length} materials (N params)`, async () => {
    return pool.query(
      `SELECT id, current_stock, reserved_qty FROM materials WHERE id IN (${placeholders})`,
      values,
    );
  });

  // Query 3: same query but compute available in SQL (vs in JS).
  await bench(`Batch with available computed in SQL (${ids.length} materials)`, async () => {
    return pool.query(
      `SELECT id, current_stock, reserved_qty, (current_stock - reserved_qty) AS available FROM materials WHERE id IN (${placeholders})`,
      values,
    );
  });

  // Query 4: join to bom_items to get per-material consumption (schedule pattern).
  console.log('\n--- Join benchmarks (schedule pattern) ---');
  await bench(`JOIN materials → bom_items for ${ids.length} materials`, async () => {
    const bomPlaceholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    return pool.query(
      `SELECT bi.material_id, bi.quantity_per_unit, m.current_stock, m.reserved_qty,
              (m.current_stock - m.reserved_qty) AS available
       FROM bom_items bi
       JOIN materials m ON m.id = bi.material_id
       WHERE bi.material_id IN (${bomPlaceholders})`,
      values,
    );
  });

  // Query 5: material availability with a filter (e.g. below reorder point).
  await bench(`Below reorder point scan (all materials)`, async () => {
    return pool.query(
      `SELECT id, name, sku, min_stock, current_stock, reserved_qty,
              (current_stock - reserved_qty) AS available
       FROM materials
       WHERE (current_stock - reserved_qty) <= min_stock AND min_stock > 0
       ORDER BY available ASC`,
    );
  });

  await pool.end();
  console.log('\nBenchmark complete.');
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
