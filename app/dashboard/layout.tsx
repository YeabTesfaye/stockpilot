// Auth-aware layout: resolves the session from the HttpOnly cookie on the
// server, redirects to /login when there is none, and renders a sidebar with
// role-conditional nav items. Day 3 RBAC — can() gates every nav item.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { canRole } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { Role } from '@/server/rabc/roles';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import {
  Boxes,
  Package,
  Truck,
  ShoppingCart,
  CalendarClock,
  ChevronRight,
  ShieldCheck,
  Building,
} from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await getSessionUser(token) : null;
  if (!session) redirect('/login');

  const { user, memberships, roleBindings } = session;

  // Collect the set of roles the user holds (across all tenants).
  const roles = new Set(roleBindings.map((b) => b.role));

  // Precompute visible nav items from the permission matrix.
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Boxes, action: Action.VIEW_DASHBOARD },
    { href: '/dashboard/inventory', label: 'Inventory', icon: Package, action: Action.VIEW_INVENTORY },
    { href: '/dashboard/inventory/materials', label: 'Materials', icon: Package, action: Action.VIEW_MATERIALS },
    { href: '/dashboard/products', label: 'Products', icon: Package, action: Action.VIEW_PRODUCTS },
    { href: '/dashboard/warehouses', label: 'Warehouses', icon: Building, action: Action.VIEW_WAREHOUSES },
    { href: '/dashboard/production', label: 'Production', icon: Truck, action: Action.VIEW_PRODUCTION },
    { href: '/dashboard/purchasing', label: 'Purchasing', icon: ShoppingCart, action: Action.VIEW_PURCHASING },
    { href: '/dashboard/planning', label: 'Planning', icon: CalendarClock, action: Action.VIEW_PLANNING },
  ].filter((item) => {
      // Show the nav item if the user holds ANY role that can perform the action.
      return roleBindings.some((b) => canRole(b.role, item.action));
    });

  const showAdminSection = roleBindings.some((b) => canRole(b.role, Action.MANAGE_USERS));

  return (
    <div className="flex min-h-full flex-1">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-56 border-r bg-card hidden md:flex flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
            <Boxes className="h-4 w-4 text-white" />
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
              <ChevronRight className="ml-auto size-3 text-muted-foreground" />
            </Link>
          ))}
        </nav>

        {showAdminSection && (
          <div className="border-t p-3">
            <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            <nav className="space-y-1">
              {[
                { href: '/dashboard/admin/users', label: 'Users', action: Action.MANAGE_USERS },
                { href: '/dashboard/admin/audit', label: 'Audit log', action: Action.VIEW_AUDIT_LOG },
              ]
                .filter((item) => canRole(Role.OWNER, item.action))
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ShieldCheck className="size-4" />
                    {item.label}
                    <ChevronRight className="ml-auto size-3 text-muted-foreground" />
                  </Link>
                ))}
            </nav>
          </div>
        )}

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
