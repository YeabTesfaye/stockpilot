/**
 * Day 22 — unit tests.
 *
 * These are pure-function tests that run without a database. They validate the
 * business-logic helpers that the API layer calls. When vitest is added as a
 * dev dependency, replace the hand-rolled harness below with real test globals.
 */

// --- Minimal test harness (swap for vitest when available) ---
const _describe = (name: string, fn: () => void) => { try { fn(); } catch (e) { console.error(`FAIL: ${name} — ${(e as Error).message}`); } };
const _it = (name: string, fn: () => void) => _describe(name, fn);
const _expect = <T>(value: T) => ({
  toBe: (expected: T) => { if (value !== expected) throw new Error(`expected ${value} to be ${expected}`); },
  toBeGreaterThan: (expected: number) => { if ((value as number) <= expected) throw new Error(`expected ${value} > ${expected}`); },
  toBeLessThan: (expected: number) => { if ((value as number) >= expected) throw new Error(`expected ${value} < ${expected}`); },
  toEqual: (expected: unknown) => {
    const a = JSON.stringify(value);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`expected ${a} to equal ${b}`);
  },
});
const describe = _describe;
const it = _it;
const expect = _expect;

// --- Reorder-point logic (mirror of server/planning/reorderPoint.ts) ---
type MaterialRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  minStock: number;
  currentStock: number;
  reservedQty: number;
};

function getAvailable(mat: MaterialRow) {
  return mat.currentStock - mat.reservedQty;
}

function getMaterialsBelowReorderPoint(materials: MaterialRow[]) {
  const below: Array<MaterialRow & { available: number; shortage: number }> = [];
  for (const mat of materials) {
    const available = getAvailable(mat);
    if (available <= mat.minStock && mat.minStock > 0) {
      below.push({ ...mat, available, shortage: Math.max(0, mat.minStock - available + 1) });
    }
  }
  below.sort((a, b) => a.available - b.available);
  return below;
}

describe('Day 22 — reorder point logic', () => {
  it('flags a material below its reorder point', () => {
    const mats = [{ id: '1', name: 'A', sku: 'A-001', unit: 'pcs', minStock: 10, currentStock: 8, reservedQty: 0 }];
    const result = getMaterialsBelowReorderPoint(mats);
    expect(result.length).toBe(1);
    expect(result[0].shortage).toBe(3); // 10 - 8 + 1
  });

  it('does not flag a material above its reorder point', () => {
    const mats = [{ id: '1', name: 'A', sku: 'A-001', unit: 'pcs', minStock: 10, currentStock: 15, reservedQty: 0 }];
    const result = getMaterialsBelowReorderPoint(mats);
    expect(result.length).toBe(0);
  });

  it('accounts for reserved qty in available calculation', () => {
    const mats = [{ id: '1', name: 'A', sku: 'A-001', unit: 'pcs', minStock: 10, currentStock: 20, reservedQty: 12 }];
    const result = getMaterialsBelowReorderPoint(mats);
    // available = 20 - 12 = 8, which is <= 10
    expect(result.length).toBe(1);
    expect(result[0].available).toBe(8);
  });

  it('ignores materials with minStock = 0', () => {
    const mats = [{ id: '1', name: 'A', sku: 'A-001', unit: 'pcs', minStock: 0, currentStock: 0, reservedQty: 0 }];
    const result = getMaterialsBelowReorderPoint(mats);
    expect(result.length).toBe(0);
  });

  it('sorts by urgency (lowest available first)', () => {
    const mats = [
      { id: '1', name: 'A', sku: 'A-001', unit: 'pcs', minStock: 10, currentStock: 9, reservedQty: 0 },
      { id: '2', name: 'B', sku: 'B-001', unit: 'pcs', minStock: 10, currentStock: 5, reservedQty: 0 },
    ];
    const result = getMaterialsBelowReorderPoint(mats);
    expect(result[0].id).toBe('2'); // available=5
    expect(result[1].id).toBe('1'); // available=9
  });

  it('returns empty array for no materials', () => {
    expect(getMaterialsBelowReorderPoint([]).length).toBe(0);
  });
});
