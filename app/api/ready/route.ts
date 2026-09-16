import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Cheap liveness check: select 1 through the ORM. If the connection
    // pool is healthy this returns immediately; if not it throws.
    const row = await db.orm.public.Material.select('id').where((m) => m.id.eq('00000000-0000-0000-0000-000000000000')).first();
    if (!row) throw new Error('no-connection');
    return NextResponse.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('readiness check failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ status: 'not ready' }, { status: 503 });
  }
}
