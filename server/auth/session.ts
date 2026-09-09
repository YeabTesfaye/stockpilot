import { createHash, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { db } from '../db';
import type { RoleBinding } from '../rabc/can';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

// Pool for raw SQL queries that bypass the Prisma query planner.
// Needed for: (1) calling get_user_role_bindings() (SECURITY DEFINER,
// bypasses RLS), (2) UPDATEs on the sessions table via raw SQL.
// Shares the same connection params as the Prisma db so connection
// pooling is balanced.
let pgPool: Pool | null = null;
export function getPgPool(): Pool {
  if (!pgPool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL not set');
    pgPool = new Pool({ connectionString: url });
  }
  return pgPool;
}

/** Sessions are DB-backed (not a bare JWT) so revocation is instant. The DB
 * stores only the SHA-256 hash of the token. Role bindings are also stored on
 * the session row so getSessionUser can read them without querying the
 * RLS-protected memberships table. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  // Create the session row via the ORM (sessions table is not RLS-protected).
  await db.orm.public.Session.create({
    tokenHash,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  // Read role bindings from memberships via the SECURITY DEFINER function
  // get_user_role_bindings(), which runs with superuser privileges and bypasses
  // RLS. We use a direct pg client for this.
  const pool = getPgPool();
  const pgClient = await pool.connect();
  try {
    const { rows } = await pgClient.query(
      'SELECT get_user_role_bindings($1) AS rb',
      [userId],
    );
    const rawBindings = rows[0]?.rb;
    const roleBindings: RoleBinding[] = Array.isArray(rawBindings)
      ? (rawBindings as RoleBinding[])
      : [];
    // Store role bindings on the session row (sessions table is not RLS-protected).
    await pgClient.query(
      'UPDATE sessions SET role_bindings = $1 WHERE token_hash = $2',
      [JSON.stringify(roleBindings), tokenHash],
    );
  } finally {
    pgClient.release();
  }
  return token;
}

/** Wire-safe shape returned by getSessionUser (no hashes, no session id). */
export type SessionUser = {
  user: { id: string; name: string; email: string };
  memberships: Array<{
    id: string;
    role: string;
    tenant: { id: string; name: string };
  }>;
  roleBindings: readonly RoleBinding[];
};

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  const session = await db.orm.public.Session.where((s) =>
    s.tokenHash.eq(sha256(token)),
  ).first();
  if (!session) return null;

  const now = Date.now();
  if (session.revokedAt !== null || new Date(session.expiresAt).getTime() <= now) {
    return null;
  }

  const user = await db.orm.public.User.first({ id: session.userId });
  if (!user) return null;

  // Read role bindings from the session row (sessions table is not RLS-protected).
  const pool = getPgPool();
  const pgClient = await pool.connect();
  let roleBindings: RoleBinding[] = [];
  try {
    const { rows } = await pgClient.query(
      'SELECT role_bindings FROM sessions WHERE id = $1',
      [session.id],
    );
    const stored = rows[0]?.role_bindings;
    roleBindings = Array.isArray(stored) ? (stored as RoleBinding[]) : [];
  } finally {
    pgClient.release();
  }

  // Build full membership list from role bindings + tenant names.
  // roleBindings come from the pg client (JSONB -> JS object), so tenantId
  // is already a plain string at runtime. Cast at the TypeScript boundary.
  const tenantIds = [...new Set(roleBindings.map((b) => b.tenantId as string))];
  const tenants =
    tenantIds.length > 0
      ? await db.orm.public.Tenant.where((t) => t.id.in(tenantIds)).all()
      : [];
  const tenantById = new Map<string, typeof tenants[number]>(
    tenants.map((t) => [t.id as string, t]),
  );

  const memberships: Array<{
    id: string;
    role: string;
    tenant: { id: string; name: string };
  }> = [];
  for (const b of roleBindings) {
    const tenantId = String(b.tenantId ?? '');
    const tenantRow = tenantById.get(tenantId) ?? null;
    memberships.push({
      id: tenantId,
      role: b.role,
      tenant: {
        id: tenantId,
        name: tenantRow?.name ?? 'Unknown tenant',
      },
    });
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    memberships,
    roleBindings,
  };
}

export async function revokeSession(token: string): Promise<void> {
  await db.orm.public.Session.where((s) => s.tokenHash.eq(sha256(token))).update(
    { revokedAt: new Date().toISOString() },
  );
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const sessions = await db.orm.public.Session.where((s) =>
    s.userId.eq(userId),
  ).select('id', 'revokedAt').all();
  const revokedAt = new Date().toISOString();
  for (const s of sessions) {
    if (s.revokedAt === null) {
      await db.orm.public.Session.where((s) => s.id.eq(String(s.id))).update({ revokedAt });
    }
  }
}
