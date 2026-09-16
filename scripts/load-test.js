/**
 * Day 25 — load test.
 *
 * Spins up a fixed number of concurrent clients that repeatedly hit the three
 * "heavy" screens: materials list, production schedule, and the overview
 * dashboard. Reports p50/p95/p99 latency and any errors.
 *
 * Usage:
 *   DATABASE_URL=... TEST_BASE_URL=http://localhost:3000 node scripts/load-test.js
 *
 * Requires a running dev server (pnpm dev) and a seeded database.
 */

const BASE = process.env['TEST_BASE_URL'] || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.env['LOAD_CONCURRENCY'] || '5', 10);
const DURATION_MS = parseInt(process.env['LOAD_DURATION_MS'] || '30000', 10);
const COOKIES = process.env['TEST_SESSION_COOKIE'] || '';

const endpoints = [
  { name: 'materials', path: '/api/materials', weight: 3 },
  { name: 'schedule', path: '/api/production-orders', weight: 2 },
  { name: 'overview', path: '/api/dashboard/overview', weight: 2 },
  { name: 'products', path: '/api/products', weight: 2 },
  { name: 'suppliers', path: '/api/suppliers', weight: 1 },
];

// Build a weighted list.
const weighted = [];
for (const e of endpoints) {
  for (let i = 0; i < e.weight; i++) weighted.push(e.path);
}

const latencies = [];
const errors = [];
let requestsCompleted = 0;

function pickEndpoint() {
  return weighted[Math.floor(Math.random() * weighted.length)];
}

async function worker() {
  const stopAt = Date.now() + DURATION_MS;
  while (Date.now() < stopAt) {
    const path = pickEndpoint();
    const start = performance.now();
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: COOKIES ? { cookie: COOKIES } : {},
        cache: 'no-store',
      });
      const end = performance.now();
      latencies.push(end - start);
      if (!res.ok) {
        errors.push({ path, status: res.status, latency: end - start });
      }
    } catch (err) {
      errors.push({ path, error: err instanceof Error ? err.message : String(err) });
    }
    requestsCompleted++;
    // Small jitter so workers don't sync up.
    await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
  }
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  console.log(`Load test: ${CONCURRENCY} concurrent clients, ${DURATION_MS}ms, ${endpoints.map(e => `${e.name}(${e.weight})`).join(', ')}`);
  console.log(`Target: ${BASE}`);
  if (COOKIES) console.log('Authenticated requests (cookie provided)');
  console.log('Starting workers...');

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  const sorted = latencies.slice().sort((a, b) => a - b);
  const total = latencies.length;
  const sum = latencies.reduce((a, b) => a + b, 0);
  const avg = total > 0 ? sum / total : 0;

  console.log('\n=== Results ===');
  console.log(`Total requests completed: ${requestsCompleted}`);
  console.log(`Successful: ${total}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Error breakdown:');
    const byPath = new Map();
    for (const e of errors) {
      const key = e.status ? `${e.path} (${e.status})` : `${e.path} (${e.error})`;
      byPath.set(key, (byPath.get(key) || 0) + 1);
    }
    for (const [key, count] of byPath) {
      console.log(`  ${key}: ${count}`);
    }
  }
  console.log(`\nLatency (ms):`);
  console.log(`  avg:  ${avg.toFixed(2)}`);
  console.log(`  p50:  ${percentile(sorted, 50).toFixed(2)}`);
  console.log(`  p95:  ${percentile(sorted, 95).toFixed(2)}`);
  console.log(`  p99:  ${percentile(sorted, 99).toFixed(2)}`);
  console.log(`  max:  ${sorted[sorted.length - 1]?.toFixed(2) ?? 'N/A'}`);
  console.log(`\nRPS (approximate): ${(requestsCompleted / (DURATION_MS / 1000)).toFixed(1)}`);
}

main().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
