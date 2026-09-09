import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import * as products from '@/server/model/products';
import { computeMaxBuildable } from '@/server/model/max-buildable';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const session = await getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!can(session.roleBindings, Action.VIEW_PRODUCTS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    const product = await products.getProduct(id);
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await computeMaxBuildable(id, product.name);
    return NextResponse.json(result);
  });
}
