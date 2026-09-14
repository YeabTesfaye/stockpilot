import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { rankSuppliers } from '@/server/suppliers/rank';

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_PURCHASING)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  const url = new URL(request.url);
  const materialIdsParam = url.searchParams.get('materialIds');
  const materialIds = materialIdsParam
    ? materialIdsParam.split(',').filter(Boolean)
    : [];

  return withTenant(tenantId, async () => {
    try {
      const rankings = await rankSuppliers(tenantId, materialIds);
      return NextResponse.json({ rankings });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
  });
}
