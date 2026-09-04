import { db } from '../server/db';
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

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    // Rerunnable: wipe existing rows (tenant delete cascades memberships;
    // user delete cascades memberships + sessions).
    const tenants = await tx.orm.public.Tenant.select('id').all();
    if (tenants.length > 0) {
      await tx.orm.public.Tenant.where((t) => t.id.in(tenants.map((x) => x.id))).delete();
    }
    const users = await tx.orm.public.User.select('id').all();
    if (users.length > 0) {
      await tx.orm.public.User.where((u) => u.id.in(users.map((x) => x.id))).delete();
    }

    const acme = await tx.orm.public.Tenant.create({ name: 'Acme Manufacturing' });
    const beta = await tx.orm.public.Tenant.create({ name: 'Beta Plastics' });

    const makeUser = (name: string, email: string) =>
      tx.orm.public.User.create({ name, email, passwordHash, createdAt: now, updatedAt: now });

    const ada = await makeUser('Ada Lovelace', 'ada@acme.test');
    const grace = await makeUser('Grace Hopper', 'grace@acme.test');
    const sam = await makeUser('Sam Okonkwo', 'sam@example.test');
    const alan = await makeUser('Alan Turing', 'alan@beta.test');
    const katherine = await makeUser('Katherine Johnson', 'katherine@beta.test');

    const membership = (tenantId: string, userId: string, role: 'OWNER' | 'PRODUCTION_MANAGER' | 'PURCHASING' | 'WAREHOUSE_STAFF' | 'VIEWER') =>
      tx.orm.public.Membership.create({ tenantId, userId, role, createdAt: now });

    await membership(acme.id, ada.id, 'OWNER');
    await membership(acme.id, grace.id, 'WAREHOUSE_STAFF');
    await membership(acme.id, sam.id, 'OWNER');
    await membership(beta.id, alan.id, 'OWNER');
    await membership(beta.id, katherine.id, 'VIEWER');
    await membership(beta.id, sam.id, 'VIEWER');
  });

  const tenants = await db.orm.public.Tenant.all();
  const users = await db.orm.public.User.all();
  const memberships = await db.orm.public.Membership.all();
  console.log(
    `Seed complete: ${tenants.length} tenants, ${users.length} users, ${memberships.length} memberships. ` +
      `Dev password for all accounts: ${PASSWORD}`,
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  });
