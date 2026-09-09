import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import * as bom from '@/server/model/bom';
import * as products from '@/server/model/products';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_PRODUCTS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: productId } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    const product = await products.getProduct(productId);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const versions = await bom.listBomVersions(productId);
    const current = versions[0] ?? null;

    return NextResponse.json({
      productId,
      currentVersion: current?.version ?? null,
      versions,
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.CREATE_BOM)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: productId } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, items, revertTo } = body;

  return withTenant(tenantId, async () => {
    try {
      if (action === 'revert' && typeof revertTo === 'number') {
        // Revert: create a new version as a copy of an existing version
        const reverted = await bom.revertBomVersion(productId, revertTo);
        return NextResponse.json({
          version: reverted.version,
          message: `Reverted to version ${revertTo}`,
        }, { status: 201 });
      }

      if (action === 'create' && Array.isArray(items)) {
        // Create a fresh BOM version from the provided items
        const created = await bom.createBomVersion(productId, items.map((i: { materialId: string; quantityPerUnit: number; unit: string }) => ({
          materialId: i.materialId,
          quantityPerUnit: i.quantityPerUnit,
          unit: i.unit,
        })));
        return NextResponse.json({
          version: created.version,
          message: 'BOM version created',
        }, { status: 201 });
      }

      return NextResponse.json({ error: 'Invalid action. Use "create" with items or "revert" with revertTo version number.' }, { status: 400 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
