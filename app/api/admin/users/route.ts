import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';

/** Owner-only: list all users in the current tenant. A Warehouse Staff
 * account calling this endpoint must receive 403 — that is the Day 3
 * break task. */
export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const session = await getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // RBAC gate: only OWNER may manage users.
  if (!can(session.roleBindings, Action.MANAGE_USERS)) {
    return NextResponse.json(
      { error: 'Forbidden: you do not have permission to manage users' },
      { status: 403 },
    );
  }

  // In a real app this would query the DB filtered to the current tenant.
  // For the break test we return the session's role bindings so the caller
  // can confirm the role that was checked.
  return NextResponse.json({
    ok: true,
    roleThatWasChecked: session.roleBindings.map((b) => b.role),
    message: 'Owner-only action succeeded',
  });
}
