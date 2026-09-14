import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import { forecastDemand } from '@/server/planning/forecast';

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSessionUser(token);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!can(session.roleBindings, Action.VIEW_PLANNING)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const materialId = url.searchParams.get('materialId');

  const tenantId = session.memberships[0]?.id;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  return withTenant(tenantId, async () => {
    try {
      if (materialId) {
        const result = await forecastDemand(materialId);
        return NextResponse.json({ forecast: result });
      }

      // No materialId: return forecasts for all materials.
      const { listMaterials } = await import('@/server/model/materials');
      const materialList = await listMaterials();
      const materialIds = materialList.map(m => m.id);
      const forecasts = await Promise.all(materialIds.map(id => forecastDemand(id)));
      return NextResponse.json({ forecasts, generatedAt: new Date().toISOString() });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
  });
}
