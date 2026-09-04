import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { hashPassword, verifyPassword } from '@/server/auth/hash';
import { createSession, getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth/cookie';

// A real argon2 hash of a random throwaway string, used only to burn the same
// CPU time on the "unknown email" path so response timing doesn't leak which
// emails are registered.
let dummyHash: Promise<string> | null = null;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await db.orm.public.User.where((u) => u.email.eq(email)).first();

  if (!user) {
    dummyHash ??= hashPassword('timing-equalizer');
    await verifyPassword(await dummyHash, password);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await createSession(user.id);
  const session = await getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: 'Session could not be established' }, { status: 500 });
  }

  const res = NextResponse.json(session);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
