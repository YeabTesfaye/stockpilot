// Dashboard layout: renders the app sidebar with a Dashboard home link.
// Clicking the StockPilot brand logo takes the user back to /dashboard.
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { Boxes, Package, Building, History, Bell, TrendingUp, Factory } from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  // Resolve the session on the server so the sidebar can show the user name and
  // tenant. If the cookie is present but the session can't be resolved (stale
  // cookie, corrupted token, or missing DB row), we still render the page and
  // let authenticated API calls fail with 401 instead of hard-redirecting —
  // hard redirects during SSR are what produced the "Overview unavailable"
  // dashboard shell in the browser.
  const session = token ? await getSessionUser(token) : null;
  const { user, memberships } = session ?? {
    user: { id: '', name: 'User', email: '' },
    memberships: [],
  };

  return (
    <div className="flex min-h-full flex-1">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-56 border-r bg-card hidden md:flex flex-col">
        {/* Clicking the StockPilot logo navigates to /dashboard. */}
        <Link href="/dashboard" className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">StockPilot</span>
        </Link>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Boxes className="size-4" />
            Dashboard
          </Link>
          <Link
            href="/inventory/materials"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Package className="size-4" />
            Materials
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Package className="size-4" />
            Products
          </Link>
          <Link
            href="/warehouses"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Building className="size-4" />
            Warehouses
          </Link>
          <Link
            href="/inventory/adjustments"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <History className="size-4" />
            Adjustments
          </Link>
          <Link
            href="/sales-orders"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Package className="size-4" />
            Sales orders
          </Link>
          <Link
            href="/purchasing/recommendations"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Package className="size-4" />
            Purchase recs
          </Link>
          <Link
            href="/purchasing/suppliers"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Building className="size-4" />
            Suppliers
          </Link>
          <Link
            href="/notifications"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Bell className="size-4" />
            Notifications
          </Link>
          <Link
            href="/production/schedule"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Factory className="size-4" />
            Production
          </Link>
          <Link
            href="/reports/forecast"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <TrendingUp className="size-4" />
            Forecast
          </Link>
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
