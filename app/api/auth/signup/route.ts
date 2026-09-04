import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { hashPassword } from '@/server/auth/hash';
import { createSession, getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth/cookie';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const companyName =
    typeof body.companyName === 'string' && body.companyName.trim()
      ? body.companyName.trim()
      : `${name || 'New'}'s Company`;

  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: 'Name is required (max 120 chars)' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: 'Password must be 8-128 characters' }, { status: 400 });
  }

  const existing = await db.orm.public.User.where((u) => u.email.eq(email)).first();
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // First signup provisions a brand-new company with the user as OWNER.
  const created = await db.transaction(async (tx) => {
    const tenant = await tx.orm.public.Tenant.create({ name: companyName });
    const user = await tx.orm.public.User.create({
      name,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const membership = await tx.orm.public.Membership.create({
      tenantId: tenant.id,
      userId: user.id,
      role: 'OWNER',
    });
    return { user, membership };
  });

  const token = await createSession(created.user.id);
  const session = await getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: 'Session could not be established' }, { status: 500 });
  }

  const res = NextResponse.json(session, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
