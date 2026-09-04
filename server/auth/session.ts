import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/**
 * Sessions are DB-backed (not a bare JWT) so revocation is instant: a row
 * update is effective on the very next request, with no token blacklist or
 * expiry bookkeeping on the client. The DB stores only the SHA-256 hash of
 * the token, so a leaked table never yields usable sessions.
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.orm.public.Session.create({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
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
};

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  const session = await db.orm.public.Session.where((s) =>
    s.tokenHash.eq(sha256(token)),
  ).first();
  if (!session) return null;

  const now = Date.now();
  // TimestamptzString decodes to Postgres-style text — parse before comparing.
  if (session.revokedAt !== null || new Date(session.expiresAt).getTime() <= now) {
    return null;
  }

  const user = await db.orm.public.User.first({ id: session.userId });
  if (!user) return null;

  const memberships = await db.orm.public.Membership.where((m) =>
    m.userId.eq(user.id),
  ).all();
  const tenantIds = [...new Set(memberships.map((m) => m.tenantId))];
  const tenants =
    tenantIds.length > 0
      ? await db.orm.public.Tenant.where((t) => t.id.in(tenantIds)).all()
      : [];
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return {
    user: { id: user.id, name: user.name, email: user.email },
    memberships: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      tenant: {
        id: m.tenantId,
        name: tenantById.get(m.tenantId)?.name ?? 'Unknown tenant',
      },
    })),
  };
}

export async function revokeSession(token: string): Promise<void> {
  await db.orm.public.Session.where((s) => s.tokenHash.eq(sha256(token))).update(
    { revokedAt: new Date().toISOString() },
  );
}

export async function revokeAllSessions(userId: string): Promise<void> {
  // NOTE: this RC's `.update()` targets a single row even when the predicate
  // matches many — multi-row writes must loop per row (see docs/decisions.md).
  const sessions = await db.orm.public.Session.where((s) =>
    s.userId.eq(userId),
  ).select('id', 'revokedAt').all();
  const revokedAt = new Date().toISOString();
  for (const session of sessions) {
    if (session.revokedAt === null) {
      await db.orm.public.Session.where((s) => s.id.eq(session.id)).update({ revokedAt });
    }
  }
}
