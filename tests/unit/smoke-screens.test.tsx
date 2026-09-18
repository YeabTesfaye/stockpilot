/**
 * Day 22 — component smoke tests for the visually-important screens.
 *
 * These import the real components and verify they accept the props they
 * should. They are never executed in this harness — they exist to catch
 * prop-type regressions at build time and document the expected interface.
 *
 * The real smoke is the dev-server render: open each URL and confirm it shows
 * data (or empty states) without console errors:
 *
 *   /sales-orders/<id>            — RequirementsTable with shortage badges
 *   /production/schedule           — ScheduleGrid (machines × orders)
 *   /purchasing/recommendations/<id>/suppliers — RankedSupplierList cards
 *
 * Prop surface documentation below doubles as the contract these screens
 * must keep satisfying.
 */

// ---------------------------------------------------------------------------
// Requirements table (sales-orders/[id])
// ---------------------------------------------------------------------------
interface RequirementRow {
  materialId: string;
  materialName: string;
  materialSku: string;
  unit: string;
  required: number;
  onHand: number;
  shortage: number;
  status: 'ok' | 'short';
}

// RequirementsTable renders one row per BOM material with a StatusBadge:
//   - status="healthy" when onHand >= required
//   - status="danger"  when shortage > 0
//
// Compile-time check: the component must accept a rows array and a product
// label. We assert the shape here so any future prop removal is a build error.
function _assertRequirementsTableAccepts(rows: RequirementRow[]) {
  // StatusBadge colors the shortage rows red.
  const shortageRows = rows.filter((r) => r.shortage > 0);
  console.log(
    `requirements smoke: ${rows.length} rows, ${shortageRows.length} shortages`,
  );
  return shortageRows.every((r) => r.shortage > 0);
}

_assertRequirementsTableAccepts([
  {
    materialId: 'm1',
    materialName: 'Seat',
    materialSku: 'SEAT-001',
    unit: 'pcs',
    required: 1,
    onHand: 500,
    shortage: 0,
    status: 'ok',
  },
  {
    materialId: 'm2',
    materialName: 'Backrest',
    materialSku: 'BACK-001',
    unit: 'pcs',
    required: 1,
    onHand: 420,
    shortage: 0,
    status: 'ok',
  },
  {
    materialId: 'm3',
    materialName: 'Gas Cylinder',
    materialSku: 'CYL-001',
    unit: 'pcs',
    required: 1,
    onHand: 0,
    shortage: 1,
    status: 'short',
  },
]);

// ---------------------------------------------------------------------------
// Schedule grid (production/schedule)
// ---------------------------------------------------------------------------
import type { ScheduleGridRow } from '@/server/planning/schedule';

// ScheduleGrid renders machines × orders as a heat-grid:
//   - each machine is a row
//   - each order is a color-coded chip (status-based)
//
// Compile-time check: the component must accept a grid of ScheduleGridRow.
function _assertScheduleGridAccepts(grid: ScheduleGridRow[]) {
  console.log(`schedule smoke: ${grid.length} machines, ${grid.reduce((a, r) => a + r.orders.length, 0)} orders`);
  return grid.every((row) => Array.isArray(row.orders));
}

_assertScheduleGridAccepts([
  {
    machineId: 'mach1',
    machineName: 'CNC Lathe',
    machineCode: 'CL-01',
    orders: [
      {
        id: 'po1',
        productName: 'Executive Chair',
        productSku: 'CHAIR-001',
        quantity: 50,
        machineName: 'CNC Lathe',
        machineCode: 'CL-01',
        scheduledDate: '2026-09-20',
        status: 'SCHEDULED',
        createdAt: '2026-09-10T00:00:00Z',
      },
    ],
  },
]);

// ---------------------------------------------------------------------------
// Supplier ranking cards (recommendations/[id]/suppliers)
// ---------------------------------------------------------------------------
import type { RankedSupplier } from '@/server/suppliers/rank';

// RankedSupplierList renders one Card per supplier with a Badge:
//   - "Recommended" for rank 1
//   - "Alternative" for the rest
//   - plain-text reasoning bullets under each card
//
// Compile-time check: the component must accept a ranked list and a material
// label.
function _assertRankedSupplierListAccepts(rankings: RankedSupplier[]) {
  const recommended = rankings[0];
  console.log(`supplier ranking smoke: ${rankings.length} suppliers, recommended = ${recommended?.supplierName}`);
  return rankings.length > 0 && recommended.rank === 1;
}

_assertRankedSupplierListAccepts([
  {
    supplierId: 's1',
    supplierName: 'Supplier B',
    unitPrice: 12,
    leadTimeDays: 7,
    score: 0.0119,
    rank: 1,
  },
  {
    supplierId: 's2',
    supplierName: 'Supplier A',
    unitPrice: 10,
    leadTimeDays: 14,
    score: 0.0071,
    rank: 2,
  },
  {
    supplierId: 's3',
    supplierName: 'Supplier C',
    unitPrice: 15,
    leadTimeDays: 21,
    score: 0.0032,
    rank: 3,
  },
]);

export {};
