import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { hashPassword, verifyPassword } from '@/server/auth/hash';
import { createSession, getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth/cookie';

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

  console.error('[LOGIN DEBUG] email:', email, 'password length:', password.length, 'password first 3 chars:', password.substring(0, 3));

  const user = await db.orm.public.User.where((u) => u.email.eq(email)).first();

  console.error('[LOGIN DEBUG] user found:', !!user);
  if (user) {
    console.error('[LOGIN DEBUG] user.passwordHash:', user.passwordHash);
    console.error('[LOGIN DEBUG] user.passwordHash length:', user.passwordHash?.length);
  }

  if (!user) {
    dummyHash ??= hashPassword('timing-equalizer');
    await verifyPassword(await dummyHash, password);
    console.error('[LOGIN DEBUG] returning 401 - user not found');
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const ok = await verifyPassword(user.passwordHash, password);
  console.error('[LOGIN DEBUG] verifyPassword result:', ok);

  if (!ok) {
    console.error('[LOGIN DEBUG] returning 401 - password mismatch');
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await createSession(user.id);
  const session = await getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: 'Session could not be established' }, { status: 500 });
  }

  const res = NextResponse.json(session);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  console.error('[LOGIN DEBUG] SUCCESS - session created for user:', user.id);
  return res;
}
