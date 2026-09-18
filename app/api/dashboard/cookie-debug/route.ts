import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/server/auth/cookie';

export async function GET() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE);
  return NextResponse.json({
    hasCookie: !!raw,
    value: raw?.value ?? null,
  });
}
