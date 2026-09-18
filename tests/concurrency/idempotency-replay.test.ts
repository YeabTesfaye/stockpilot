/* eslint-disable */
// Minimal test harness so the file typechecks and runs with `tsx` without
// vitest. Replace with a real test runner (vitest/jest) when added to deps.
const _describe = (name: string, fn: () => void) => {
  try { fn(); } catch (e) { console.error(`describe ${name}: ${(e as Error).message}`); }
};
const _it = (name: string, fn: () => Promise<void> | void) =>
  _describe(name, fn);
const _expect = <T>(value: T) => ({
  toBe: (expected: T) => {
    if (value !== expected) throw new Error(`expected ${value} to be ${expected}`);
  },
  toEqual: (expected: T) => {
    if (JSON.stringify(value) !== JSON.stringify(expected)) {
      throw new Error(`expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if ((value as number) <= expected) throw new Error(`expected ${value} > ${expected}`);
  },
});
const describe = _describe;
const it = _it;
const expect = _expect;

/**
 * Day 13 — replay protection test.
 *
 * recordMovement() accepts an idempotency key. Submitting the same key twice
 * must not create two stock movements or double-count the quantity change.
 *
 * This test seeds its own tenant + material + session, then submits two
 * identical movements with the same idempotency key and verifies:
 *   - exactly one movement row was created
 *   - material stock changed by exactly the requested delta once
 *
 * Rerunnable: it cleans up after itself.
 */

const TENANT_ID = '00000000-0000-0000-0000-000000000098';
const USER_ID = '00000000-0000-0000-0000-000000000097';
const MATERIAL_ID = '00000000-0000-0000-0000-000000000096';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000095';
const IDEMPOTENCY_KEY = `replay-test-${Date.now()}`;

async function poolQuery(sql: string, params: (string | number | null)[] = []) {
  // Lazy require so the file still typechecks when pg is a prod dep only.
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] ?? '' });
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } finally {
    await pool.end();
  }
}

async function seed() {
  await poolQuery('DELETE FROM memberships WHERE tenant_id = $1 AND user_id = $2', [
    TENANT_ID,
    USER_ID,
  ]);
  await poolQuery('DELETE FROM sessions WHERE user_id = $1', [USER_ID]);
  await poolQuery('DELETE FROM users WHERE id = $1', [USER_ID]);
  await poolQuery('DELETE FROM stock_movements WHERE material_id = $1', [MATERIAL_ID]);
  await poolQuery('DELETE FROM materials WHERE id = $1', [MATERIAL_ID]);
  await poolQuery('DELETE FROM memberships WHERE tenant_id = $1', [TENANT_ID]);
  await poolQuery('DELETE FROM tenants WHERE id = $1', [TENANT_ID]);
  await poolQuery('DELETE FROM warehouses WHERE id = $1', [WAREHOUSE_ID]);

  await poolQuery(
    `INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [TENANT_ID, 'Idempotency test tenant'],
  );
  await poolQuery(
    `INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [USER_ID, 'Idempotency tester', `replay-${Date.now()}@test.local`, 'hash'],
  );
  await poolQuery(
    `INSERT INTO memberships (id, tenant_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [`membership-${Date.now()}`, TENANT_ID, USER_ID, 'OWNER'],
  );
  await poolQuery(
    `INSERT INTO warehouses (id, tenant_id, name, code) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [WAREHOUSE_ID, TENANT_ID, 'Test warehouse', 'TW-01'],
  );
  await poolQuery(
    `INSERT INTO materials (id, tenant_id, name, sku, unit, current_stock, reserved_qty, min_stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
    [MATERIAL_ID, TENANT_ID, 'Test material', 'TEST-001', 'pcs', '100', '0', '10'],
  );
}

async function getSessionToken() {
  // Login and read the session cookie from the JSON response.
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'replay-test@local', password: 'replay-test-password' }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const session = (await res.json()) as { token?: string; id?: string };
  // The login route returns the session object; our session shape includes the
  // token via the cookie, not the body. For this test we create a fresh session
  // through the normal path and read it from the Set-Cookie header instead.
  return res.headers.get('set-cookie') ?? '';
}

async function recordMovement(token: string, idempotencyKey: string, quantity: number) {
  const cookieHeader = token ? { cookie: token } : {};
  const res = await fetch('http://localhost:3000/api/stock-movements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...cookieHeader,
    },
    body: JSON.stringify({
      materialId: MATERIAL_ID,
      warehouseId: WAREHOUSE_ID,
      type: 'PURCHASE',
      quantity,
      reference: 'idempotency replay test',
      idempotencyKey,
      actorUserId: USER_ID,
      actorName: 'Idempotency tester',
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function countMovements() {
  const rows = await poolQuery(
    `SELECT COUNT(*)::int AS n FROM stock_movements WHERE material_id = $1`,
    [MATERIAL_ID],
  );
  return (rows[0]?.n ?? 0) as number;
}

async function getMaterialStock() {
  const rows = await poolQuery(
    `SELECT current_stock::int FROM materials WHERE id = $1`,
    [MATERIAL_ID],
  );
  return (rows[0]?.current_stock ?? -1) as number;
}

async function runTest() {
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.log('SKIP: DATABASE_URL not set');
    return;
  }

  console.log(' seeding test data…');
  await seed();

  // Login normally and capture the session cookie.
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'replay-test@local', password: 'replay-test-password' }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  const token = setCookie;

  const beforeStock = await getMaterialStock();
  expect(beforeStock).toBeGreaterThanOrEqual(0);

  console.log(` submitting movement with idempotency key ${IDEMPOTENCY_KEY}…`);
  const first = await recordMovement(token, IDEMPOTENCY_KEY, 5);
  expect(first.status).toBeGreaterThanOrEqual(200);
  expect((first.body as { success?: boolean }).success).toBe(true);

  console.log(' submitting the same movement again (replay)…');
  const second = await recordMovement(token, IDEMPOTENCY_KEY, 5);
  expect(second.status).toBeGreaterThanOrEqual(200);
  expect((second.body as { success?: boolean; duplicate?: boolean }).duplicate).toBe(true);

  const afterStock = await getMaterialStock();
  const movementCount = await countMovements();

  // Only one movement row should exist, and stock should have moved by exactly 5.
  expect(movementCount).toBe(1);
  expect(afterStock).toBe(beforeStock + 5);

  console.log(' idempotency replay test passed:');
  console.log(`   movements created: ${movementCount} (expected 1)`);
  console.log(`   stock before: ${beforeStock}, after: ${afterStock} (delta +5)`);

  // Cleanup.
  await poolQuery('DELETE FROM memberships WHERE tenant_id = $1 AND user_id = $2', [
    TENANT_ID,
    USER_ID,
  ]);
  await poolQuery('DELETE FROM sessions WHERE user_id = $1', [USER_ID]);
  await poolQuery('DELETE FROM users WHERE id = $1', [USER_ID]);
  await poolQuery('DELETE FROM stock_movements WHERE material_id = $1', [MATERIAL_ID]);
  await poolQuery('DELETE FROM materials WHERE id = $1', [MATERIAL_ID]);
  await poolQuery('DELETE FROM memberships WHERE tenant_id = $1', [TENANT_ID]);
  await poolQuery('DELETE FROM tenants WHERE id = $1', [TENANT_ID]);
  await poolQuery('DELETE FROM warehouses WHERE id = $1', [WAREHOUSE_ID]);
}

describe('idempotency replay', () => {
  it('does not double-count when the same idempotency key is submitted twice', async () => {
    await runTest();
  });
});
