import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession } from '@/server/auth/session';
import { SESSION_COOKIE, sessionCookieClearOptions } from '@/server/auth/cookie';

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  // Revoke in the DB first: even if the cookie clear below failed, the token
  // is already dead server-side.
  if (token) {
    await revokeSession(token);
  }

  const res = new NextResponse(null, { status: 204 });
  // sessionCookieClearOptions sets maxAge: 0 plus the same Secure/HttpOnly/
  // SameSite attributes so the browser actually clears the cookie in prod.
  res.cookies.set(SESSION_COOKIE, '', sessionCookieClearOptions());
  return res;
}
