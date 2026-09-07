// Dashboard home. It re-reads the HttpOnly cookie and resolves the session on
// the server on every request, so the "session verified at" timestamp proves
// the login survives a full page reload — refresh the page and it updates.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function DashboardPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await getSessionUser(token) : null;
  if (!session) redirect('/login');

  const verifiedAt = new Date().toISOString();
  const { user, memberships } = session;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          Day 1 is wired end-to-end: DB-backed sessions, argon2 hashing, and a
          server-side auth gate. Day 2 brings row-level security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signed in as</CardTitle>
          <CardDescription>Re-verified from the session cookie on every page load.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{user.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{user.email}</dd>
            <dt className="text-muted-foreground">Tenant memberships</dt>
            <dd className="font-medium">
              {memberships.map((m) => `${m.tenant.name} (${m.role})`).join(', ')}
            </dd>
            <dt className="text-muted-foreground">Session verified at</dt>
            <dd className="tabular-nums">{verifiedAt}</dd>
          </dl>
          <p className="text-muted-foreground text-xs">
            Reload this page — the timestamp above changes, which means the
            session survived the full page refresh.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
