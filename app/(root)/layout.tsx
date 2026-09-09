import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { History, Package, Building } from 'lucide-react';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await getSessionUser(token) : null;
  if (!session) redirect('/login');

  const { user, memberships } = session;

  const navItems = [
    { href: '/audit-log', label: 'Audit log', icon: History },
    { href: '/inventory/materials', label: 'Materials', icon: Package },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/warehouses', label: 'Warehouses', icon: Building },
  ];

  return (
    <div className="flex min-h-full flex-1">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-56 border-r bg-card hidden md:flex flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
            <Package className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">StockPilot</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <UserMenu />
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {memberships.map((m) => `${m.tenant.name} · ${m.role}`).join(', ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden truncate text-sm sm:inline">
              {user.name}
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </div>
    </div>
  );
}
