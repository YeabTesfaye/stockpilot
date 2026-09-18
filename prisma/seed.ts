import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../server/auth/hash';

/**
 * Seed state (deterministic + rerunnable):
 *
 *   Acme Manufacturing      Beta Plastics
 *   - Ada        OWNER      - Alan      OWNER
 *   - Grace      WAREHOUSE_STAFF
 *   - Sam        OWNER      - Sam       VIEWER   <- one user, two tenants
 *
 * Sam is the multi-membership demo account: same login, different role per
 * tenant. All accounts share the dev password `stockpilot-seed`.
 */
const PASSWORD = 'stockpilot-seed';

interface UserRow {
id: string;
  email: string;
  name: string;
}

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL not set');

  const pool = new Pool({ connectionString: url });
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    const passwordHash = await hashPassword(PASSWORD);
    const now = new Date().toISOString();

    // --- cleanup (rerunnable) ---
    const knownEmails = [
      'ada@acme.test',
      'grace@acme.test',
      'sam@example.test',
      'alan@beta.test',
      'katherine@beta.test',
    ];

    // Delete memberships first (no FK cascade assumed).
    const { rows: userRows } = await client.query<UserRow>(
      `SELECT id FROM public.users WHERE email = ANY($1)`,
      [knownEmails],
    );
    if (userRows.length > 0) {
      const userIds = userRows.map((r) => r.id);
      await client.query(
        `DELETE FROM public.memberships WHERE user_id = ANY($1)`,
        [userIds],
      );
      await client.query(
        `DELETE FROM public.sessions WHERE user_id = ANY($1)`,
        [userIds],
      );
      await client.query(
        `DELETE FROM public.users WHERE email = ANY($1)`,
        [knownEmails],
      );
    }
    await client.query(
      `DELETE FROM public.tenants WHERE name = ANY($1)`,
      [['Acme Manufacturing', 'Beta Plastics']],
    );


    // --- create ---
    const acmeId = randomUUID();
    await client.query(
      `INSERT INTO public.tenants (id, name, created_at) VALUES ($1, $2, now())`,
      [acmeId, 'Acme Manufacturing'],
    );

    const betaId = randomUUID();
    await client.query(
      `INSERT INTO public.tenants (id, name, created_at) VALUES ($1, $2, now())`,
      [betaId, 'Beta Plastics'],
    );

    const mkUser = (name: string, email: string) => {
      const id = randomUUID();
      return client!.query(
        `INSERT INTO public.users (id, name, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
        [id, name, email, passwordHash, now],
      );
    };

    const adaR = await mkUser('Ada Lovelace', 'ada@acme.test');
    const graceR = await mkUser('Grace Hopper', 'grace@acme.test');
    const samR = await mkUser('Sam Okonkwo', 'sam@example.test');
    const alanR = await mkUser('Alan Turing', 'alan@beta.test');
    const katherineR = await mkUser('Katherine Johnson', 'katherine@beta.test');
    const membership = (
      tenantId: string,
      userId: string,
      role: string,
    ) => {
      const id = randomUUID();
      return client!.query(
        `INSERT INTO public.memberships (id, tenant_id, user_id, role, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, tenantId, userId, role, now],
      );
    };

    await membership(acmeId, adaR.rows[0].id, 'OWNER');
    await membership(acmeId, graceR.rows[0].id, 'WAREHOUSE_STAFF');
    await membership(acmeId, samR.rows[0].id, 'OWNER');
    await membership(betaId, alanR.rows[0].id, 'OWNER');
    await membership(betaId, katherineR.rows[0].id, 'VIEWER');
    await membership(betaId, samR.rows[0].id, 'VIEWER');

    // --- catalog seed: office chair example (CHAIR-001) ---
    // Materials (all under Acme Manufacturing)
    // Give every material real on-hand stock so the overview, max-buildable,
    // forecast, and rules engine have something to show on a fresh seed.
    const mkMaterial = (
      id: string,
      name: string,
      sku: string,
      unit: string,
      minStock: number,
      currentStock: number,
    ) =>
      client!.query(
        `INSERT INTO public.materials (id, tenant_id, name, sku, unit, min_stock, current_stock, reserved_qty, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, now(), now())`,
        [id, acmeId, name, sku, unit, minStock, currentStock],
      );

    const seatId = randomUUID();
    await mkMaterial(seatId, 'Seat', 'SEAT-001', 'pcs', 2000, 2500);
    const backrestId = randomUUID();
    await mkMaterial(backrestId, 'Backrest', 'BACK-001', 'pcs', 420, 420);
    const wheelsId = randomUUID();
    await mkMaterial(wheelsId, 'Wheels', 'WHL-001', 'pcs', 5000, 2000);
    const cylinderId = randomUUID();
    await mkMaterial(cylinderId, 'Gas Cylinder', 'CYL-001', 'pcs', 4500, 5000);
    const screwsId = randomUUID();
    await mkMaterial(screwsId, 'Screws (M6)', 'SCR-M6', 'pcs', 20000, 50000);
    const armrestId = randomUUID();
    await mkMaterial(armrestId, 'Armrest Pair', 'ARM-001', 'pcs', 500, 600);

    // Product
    const productId = randomUUID();
    await client!.query(
      `INSERT INTO public.products (id, tenant_id, name, sku, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [productId, acmeId, 'Executive Chair', 'CHAIR-001', 'Ergonomic office chair with adjustable height and armrests'],
    );

    // BOM version 1
    const bomId = randomUUID();
    await client!.query(
      `INSERT INTO public.boms (id, product_id, version, effective_at)
       VALUES ($1, $2, 1, now())`,
      [bomId, productId],
    );
    await client!.query(
      `UPDATE public.products SET current_bom_id = $1 WHERE id = $2`,
      [bomId, productId],
    );

    // BOM items (linked to bom, not product)
    const mkBomItem = (id: string, bomId: string, materialId: string, quantityPerUnit: number, unit: string) =>
      client!.query(
        `INSERT INTO public.bom_items (id, bom_id, material_id, quantity_per_unit, unit, created_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [id, bomId, materialId, quantityPerUnit, unit],
      );

    await mkBomItem(randomUUID(), bomId, seatId, 1, 'pcs');
    await mkBomItem(randomUUID(), bomId, backrestId, 1, 'pcs');
    await mkBomItem(randomUUID(), bomId, wheelsId, 5, 'pcs');
    await mkBomItem(randomUUID(), bomId, cylinderId, 1, 'pcs');
    await mkBomItem(randomUUID(), bomId, screwsId, 8, 'pcs');
    await mkBomItem(randomUUID(), bomId, armrestId, 1, 'pcs');

    // --- supporting seed so the UI is not empty on a fresh install ---

    // Warehouse for Acme.
    const warehouseId = randomUUID();
    await client!.query(
      `INSERT INTO public.warehouses (id, tenant_id, name, code, address, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [warehouseId, acmeId, 'Main warehouse', 'MW-01', 'Acme distribution centre'],
    );

    // One active machine so the schedule screen shows content.
    const machineId = randomUUID();
    await client!.query(
      `INSERT INTO public.machines (id, tenant_id, name, code, capacity_per_day, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, now(), now())`,
      [machineId, acmeId, 'CNC Lathe', 'CL-01', 200],
    );

    // A production order for CHAIR-001 that is SCHEDULED today so the
    // schedule grid and the overview "orders at risk" tile have real data.
    const scheduleDate = new Date();
    scheduleDate.setHours(0, 0, 0, 0);
    const orderId = randomUUID();
    await client!.query(
      `INSERT INTO public.production_orders (id, tenant_id, product_id, machine_id, quantity, scheduled_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
      [orderId, acmeId, productId, machineId, 100, scheduleDate.toISOString(), 'SCHEDULED'],
    );

    // A couple of in-app notifications for Ada so the bell and the
    // notifications page are not empty on first login.
    const adaUserId = adaR.rows[0].id;
    await client!.query(
      `INSERT INTO public.notifications (id, tenant_id, user_id, type, title, message, read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, now())`,
      [
        randomUUID(),
        acmeId,
        adaUserId,
        'LOW_STOCK',
        'Low stock alert',
        'Backrest (BACK-001) is at its reorder point with 420 pcs available.',
      ],
    );
    await client!.query(
      `INSERT INTO public.notifications (id, tenant_id, user_id, type, title, message, read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, now())`,
      [
        randomUUID(),
        acmeId,
        adaUserId,
        'REORDER_POINT',
        'Reorder point approaching',
        'Wheels (WHL-001) is approaching its reorder point: 2000 pcs available vs 5000 min.',
      ],
    );

    // --- report ---
    const tRow = await client!.query(`SELECT count(*) AS c FROM public.tenants`);
    const uRow = await client!.query(`SELECT count(*) AS c FROM public.users`);
    const mRow = await client!.query(`SELECT count(*) AS c FROM public.memberships`);
    const matRow = await client!.query(`SELECT count(*) AS c FROM public.materials`);
    const prodRow = await client!.query(`SELECT count(*) AS c FROM public.products`);
    const bomRow = await client!.query(`SELECT count(*) AS c FROM public.bom_items`);
    console.log(
      `Seed complete: ${tRow.rows[0].c} tenants, ${uRow.rows[0].c} users, ${mRow.rows[0].c} memberships, ` +
        `${matRow.rows[0].c} materials, ${prodRow.rows[0].c} products, ${bomRow.rows[0].c} bom_items. ` +
        `Dev password for all accounts: ${PASSWORD}`,
    );
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  });
