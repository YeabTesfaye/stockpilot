// Auth-aware layout: every page under this group resolves the session from the
// HttpOnly cookie on the server and redirects to /login when there is none.
// Nothing is tenant-scoped yet — Day 3 RBAC and the tenant switcher plug in
// here. The sidebar shell ships with the Day 0/4 screens; Day 1 keeps the top
// bar minimal so login → session-persists-across-refresh is easy to eyeball.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoutButton } from './logout-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await getSessionUser(token) : null;
  if (!session) redirect('/login');

  const { user, memberships } = session;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <span className="text-lg font-semibold tracking-tight">StockPilot</span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {memberships.map((m) => (
              <span
                key={m.id}
                className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium"
                title={`Role in this tenant: ${m.role}`}
              >
                {m.tenant.name} · {m.role}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden truncate text-sm sm:inline">
            {user.name}
          </span>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col p-6">{children}</main>
    </div>
  );
}
