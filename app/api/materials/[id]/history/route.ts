import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import * as movements from '@/server/model/stock-movements';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Reading movement history requires being able to view inventory.
  if (!can(session.roleBindings, Action.VIEW_INVENTORY)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: materialId } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    try {
      const rows = await movements.listMaterialMovements(materialId);
      // Also fetch the material name/sku for the header.
      const material = await rows.length > 0
        ? { name: rows[0].materialName, sku: rows[0].materialSku }
        : { name: 'Unknown', sku: '' };
      return NextResponse.json({ movements: rows, materialName: material.name, materialSku: material.sku });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 404 });
    }
  });
}
