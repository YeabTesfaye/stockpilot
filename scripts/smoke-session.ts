import { hashPassword, verifyPassword } from '../server/auth/hash';
import {
  createSession,
  getSessionUser,
  revokeAllSessions,
  revokeSession,
} from '../server/auth/session';
import { withTenant } from '../server/tenancy/withTenant';
import { getCurrentTenant } from '../server/tenancy/getCurrentTenant';
import { db } from '../server/db';

let passed = 0;
function check(label: string, cond: boolean) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  passed++;
  console.log(`ok - ${label}`);
}

async function main() {
  const tenant = await db.orm.public.Tenant.select('id', 'name').first();
  if (!tenant) throw new Error('No tenant — run prisma/seed.ts first');
  const tenantId = tenant.id;

  // --- hash round-trip -------------------------------------------------
  const hash = await hashPassword('correct horse battery staple');
  check('hash looks like argon2id', hash.startsWith('$argon2id$'));
  check('verify correct password', await verifyPassword(hash, 'correct horse battery staple'));
  check('reject wrong password', !(await verifyPassword(hash, 'wrong password')));
  check('reject garbage hash (no throw)', !(await verifyPassword('not-a-hash', 'x')));

  // --- tenant context propagates through async --------------------------
  await withTenant(tenantId, async () => {
    check('current tenant inside withTenant', getCurrentTenant() === tenantId);
    await withTenant('nested-tenant-id', async () => {
      check('innermost tenant wins', getCurrentTenant() === 'nested-tenant-id');
    });
    check('outer tenant restored after nested', getCurrentTenant() === tenantId);
    const leaked = await Promise.all([
      (async () => getCurrentTenant())(),
      new Promise<string | null>((resolve) => setTimeout(() => resolve(getCurrentTenant()), 5)),
    ]);
    check('tenant survives detached async', leaked.every((x) => x === tenantId));
  });
  check('no tenant outside withTenant', getCurrentTenant() === null);

  // --- session lifecycle ------------------------------------------------
  const user = await db.orm.public.User.select('id', 'email').first();
  if (!user) throw new Error('No user — run prisma/seed.ts first');

  const token = await createSession(user.id);
  check('session token is opaque and long', typeof token === 'string' && token.length >= 40);

  const session = await getSessionUser(token);
  check('session resolves to the right user', session?.user.id === user.id);
  check('memberships resolved', Array.isArray(session?.memberships));

  check('bogus token rejected', (await getSessionUser('bogus-token')) === null);

  await revokeSession(token);
  check('revoked token rejected', (await getSessionUser(token)) === null);

  const token2 = await createSession(user.id);
  await revokeAllSessions(user.id);
  check('revoke-all kills every session', (await getSessionUser(token2)) === null);

  console.log(`\nSMOKE TEST PASSED — ${passed} checks`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
