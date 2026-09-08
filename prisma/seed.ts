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
    const mkMaterial = (id: string, name: string, sku: string, unit: string, minStock: number) =>
      client!.query(
        `INSERT INTO public.materials (id, tenant_id, name, sku, unit, min_stock, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
        [id, acmeId, name, sku, unit, minStock],
      );

    const seatId = randomUUID();
    await mkMaterial(seatId, 'Seat', 'SEAT-001', 'pcs', 20);
    const backrestId = randomUUID();
    await mkMaterial(backrestId, 'Backrest', 'BACK-001', 'pcs', 20);
    const wheelsId = randomUUID();
    await mkMaterial(wheelsId, 'Wheels', 'WHL-001', 'pcs', 50);
    const cylinderId = randomUUID();
    await mkMaterial(cylinderId, 'Gas Cylinder', 'CYL-001', 'pcs', 10);
    const screwsId = randomUUID();
    await mkMaterial(screwsId, 'Screws (M6)', 'SCR-M6', 'pcs', 200);
    const armrestId = randomUUID();
    await mkMaterial(armrestId, 'Armrest Pair', 'ARM-001', 'pcs', 15);

    // Product
    const productId = randomUUID();
    await client!.query(
      `INSERT INTO public.products (id, tenant_id, name, sku, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [productId, acmeId, 'Executive Chair', 'CHAIR-001', 'Ergonomic office chair with adjustable height and armrests'],
    );

    // BOM items
    const mkBom = (productId: string, materialId: string, quantity: number, unit: string) =>
      client!.query(
        `INSERT INTO public.bom_items (id, product_id, material_id, quantity, unit, created_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [randomUUID(), productId, materialId, quantity, unit],
      );

    await mkBom(productId, seatId, 1, 'pcs');
    await mkBom(productId, backrestId, 1, 'pcs');
    await mkBom(productId, wheelsId, 5, 'pcs');
    await mkBom(productId, cylinderId, 1, 'pcs');
    await mkBom(productId, screwsId, 8, 'pcs');
    await mkBom(productId, armrestId, 1, 'pcs');

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
