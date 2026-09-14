import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { listSupplierMaterials, linkSupplierMaterial, unlinkSupplierMaterial } from '@/server/model/suppliers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_PURCHASING)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    const links = await listSupplierMaterials(id);
    return NextResponse.json(links);
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

  if (!can(session.roleBindings, Action.VIEW_PURCHASING)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: supplierId } = await params;
  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { materialId, unitPrice, leadTimeDays } = body;
  if (!materialId || typeof materialId !== 'string') {
    return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
  }
  if (typeof unitPrice !== 'number' || unitPrice <= 0) {
    return NextResponse.json({ error: 'unitPrice must be a positive number' }, { status: 400 });
  }

  return withTenant(tenantId, async () => {
    try {
      const link = await linkSupplierMaterial(
        supplierId,
        materialId,
        unitPrice,
        typeof leadTimeDays === 'number' ? leadTimeDays : 7,
      );
      return NextResponse.json(link, { status: 201 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 400 });
    }
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_PURCHASING)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(_request.url);
  const materialId = url.searchParams.get('materialId');
  const { id: supplierId } = await params;

  if (!materialId) return NextResponse.json({ error: 'materialId query param required' }, { status: 400 });

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    try {
      await unlinkSupplierMaterial(supplierId, materialId);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 400 });
    }
  });
}
