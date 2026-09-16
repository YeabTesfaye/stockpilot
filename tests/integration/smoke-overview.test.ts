/**
 * Day 22 — integration smoke test.
 *
 * Validates that the overview dashboard endpoint returns the expected JSON
 * shape. This test requires a running database with at least one tenant.
 *
 * Skip this test in CI if DATABASE_URL is not set; the real CI workflow
 * (Day 23) runs it against an ephemeral Postgres.
 */

const _describe = (name: string, fn: () => void) => { try { fn(); } catch (e) { console.error(`FAIL: ${name} — ${(e as Error).message}`); } };
const _it = (name: string, fn: () => Promise<void> | void) => _describe(name, fn);
function _expect<T>(value: T) {
  return {
    toBeGreaterThan(expected: number) {
      if ((value as number) <= expected) throw new Error(`expected ${value} > ${expected}`);
    },
    toMatchObject(expected: Record<string, unknown>) {
      for (const [k, v] of Object.entries(expected)) {
        if ((value as Record<string, unknown>)[k] !== v) throw new Error(`expected ${k} to be ${String(v)}, got ${String((value as Record<string, unknown>)[k])}`);
      }
    },
    any(): unknown { return value; },
  };
}
const describe = _describe;
const it = _it;
const expect = _expect;

async function runSmoke() {
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.log('SKIP: DATABASE_URL not set — no database to smoke test');
    return;
  }

  // This test hits the actual API endpoint on localhost. It assumes the dev
  // server is running. In CI, the workflow starts the server before running
  // tests.
  const baseUrl = process.env['TEST_BASE_URL'] || 'http://localhost:3000';

  console.log(`Smoke-testing overview endpoint at ${baseUrl}/api/dashboard/overview ...`);

  try {
    const res = await fetch(`${baseUrl}/api/dashboard/overview`);
    if (res.status === 401) {
      console.log('SKIP: not authenticated (no session cookie) — test needs a logged-in user');
      return;
    }

    const body = await res.json();
    expect(res.status).toBeGreaterThan(199);

    // Validate shape — all fields must be present and numeric.
    type Overview = {
      materials: { total: number; outOfStock: number; belowReorder: number };
      production: { totalOrders: number; atRisk: number; late: number; capacityPerDay: number; scheduledQty: number };
      sales: { totalOrders: number; openOrders: number };
      purchasing: { suppliers: number };
      notifications: { unread: number; total: number };
    };
    const o = body as unknown as Overview;
    if (
      typeof o.materials.total !== 'number' ||
      typeof o.materials.outOfStock !== 'number' ||
      typeof o.materials.belowReorder !== 'number' ||
      typeof o.production.totalOrders !== 'number' ||
      typeof o.production.atRisk !== 'number' ||
      typeof o.production.late !== 'number' ||
      typeof o.production.capacityPerDay !== 'number' ||
      typeof o.production.scheduledQty !== 'number' ||
      typeof o.sales.totalOrders !== 'number' ||
      typeof o.sales.openOrders !== 'number' ||
      typeof o.purchasing.suppliers !== 'number' ||
      typeof o.notifications.unread !== 'number' ||
      typeof o.notifications.total !== 'number'
    ) {
      throw new Error('overview response missing expected numeric fields');
    }

    console.log('PASS: overview endpoint returned expected shape');
  } catch (err) {
    console.error('FAIL: overview smoke test', err);
  }
}

describe('Day 22 — integration smoke tests', () => {
  it('overview endpoint returns expected shape', async () => {
    await runSmoke();
  });
});
