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
    await client!.query('SELECT 1'); // drain prior command queue

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

    // --- report ---
    const [tRow, uRow, mRow] = await Promise.all([
      client.query(`SELECT count(*) AS c FROM public.tenants`),
      client.query(`SELECT count(*) AS c FROM public.users`),
      client.query(`SELECT count(*) AS c FROM public.memberships`),
    ]);
    console.log(
      `Seed complete: ${tRow.rows[0].c} tenants, ${uRow.rows[0].c} users, ${mRow.rows[0].c} memberships. ` +
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
