// Dashboard home. It re-reads the HttpOnly cookie and resolves the session on
// the server on every request, so the "session verified at" timestamp proves
// the login survives a full page reload — refresh the page and it updates.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/ui/stat-tile';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, AlertTriangle, Package, Factory, TrendingUp } from 'lucide-react';

export default async function DashboardPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await getSessionUser(token) : null;
  if (!session) redirect('/login');

  const { user, memberships } = session;
  const primaryTenant = memberships[0];

  // Fetch overview numbers server-side.
  const cookie = store.get(SESSION_COOKIE)?.value ?? '';
  // Type declared separately so fetchOverview can be defined after the page.
  type OverviewResponse = {
    materials: { total: number; outOfStock: number; belowReorder: number };
    production: { totalOrders: number; atRisk: number; late: number; capacityPerDay: number; scheduledQty: number };
    sales: { totalOrders: number; openOrders: number };
    purchasing: { suppliers: number };
    notifications: { unread: number; total: number };
  };
  let overview: OverviewResponse | null = null;
  let fetchError: string | null = null;

  try {
    const res = await fetch('/api/dashboard/overview', {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) {
      fetchError = `Overview unavailable (${res.status})`;
    } else {
      overview = await res.json();
    }
  } catch {
    fetchError = 'Overview unavailable';
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description={
          primaryTenant
            ? `${primaryTenant.tenant.name} · ${primaryTenant.role.replace('_', ' ')}`
            : 'StockPilot Inventory Intelligence'
        }
        actions={
          <Link href="/inventory/materials" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground">
            Open materials →
          </Link>
        }
      />

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {fetchError}
        </div>
      )}

      {!overview ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : overview.materials.total === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="No materials yet"
          description="Add your first material to start tracking inventory, max buildable, and reorder points."
          action={
            <Button asChild>
              <Link href="/inventory/materials">Add material</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* ── Stat tiles ────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Materials"
              value={overview.materials.total}
              description={`${overview.materials.outOfStock} out of stock, ${overview.materials.belowReorder} below reorder`}
              icon={<Package className="h-5 w-5" />}
            />
            <StatTile
              label="Orders at risk"
              value={overview.production.atRisk}
              description={`${overview.production.late} past scheduled date · ${overview.production.totalOrders} total`}
              icon={<Factory className="h-5 w-5" />}
              trend={overview.production.atRisk > 0 ? { direction: 'warning' as const, value: 'needs attention' } : undefined}
            />
            <StatTile
              label="Production capacity"
              value={`${overview.production.capacityPerDay}u/day`}
              description={`${overview.production.scheduledQty} units scheduled`}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatTile
              label="Expected stockouts"
              value={overview.materials.outOfStock}
              description="Materials with zero available stock"
              icon={<AlertTriangle className="h-5 w-5" />}
              trend={overview.materials.outOfStock > 0 ? { direction: 'down' as const, value: 'action needed' } : undefined}
            />
          </div>

          {/* ── At-risk list ─────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Orders at risk</CardTitle>
                {overview.production.atRisk > 0 && (
                  <StatusBadge variant={overview.production.late > 0 ? 'danger' : 'warning'}>
                    {overview.production.late > 0 ? `${overview.production.late} late` : 'pending'}
                  </StatusBadge>
                )}
              </div>
              <CardDescription>
                Production orders that are scheduled or in progress but past their
                scheduled date, or without material availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overview.production.atRisk === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                    <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  No orders at risk — everything is on schedule.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {overview.production.atRisk} order{overview.production.atRisk !== 1 ? 's' : ''} need{overview.production.atRisk === 1 ? 's' : ''} attention.
                  </p>
                  <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-4 text-center">
                    <p className="text-sm">Open the{' '}
                      <Link href="/production/orders" className="text-primary underline-offset-4 hover:underline">
                        production orders list
                      </Link>
                      {' '}to triage.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Quick actions ────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/inventory/materials" className="group rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Inventory</p>
                  <p className="text-lg font-semibold tracking-tight">Materials</p>
                  <p className="text-xs text-muted-foreground">{overview.materials.total} tracked</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
            <Link href="/products" className="group rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Catalog</p>
                  <p className="text-lg font-semibold tracking-tight">Products</p>
                  <p className="text-xs text-muted-foreground">Open the catalog</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
            <Link href="/purchasing/recommendations" className="group rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Purchasing</p>
                  <p className="text-lg font-semibold tracking-tight">Recommendations</p>
                  <p className="text-xs text-muted-foreground">{overview.purchasing.suppliers} suppliers loaded</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
            <Link href="/production/schedule" className="group rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Production</p>
                  <p className="text-lg font-semibold tracking-tight">Schedule</p>
                  <p className="text-xs text-muted-foreground">{overview.production.capacityPerDay}u/day capacity</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          {/* ── Bottom: late deliveries + notifications ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Late deliveries</CardTitle>
                <CardDescription>Production orders past their scheduled date.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.production.late === 0 ? (
                  <p className="text-sm text-muted-foreground">No late deliveries.</p>
                ) : (
                  <p className="text-sm">
                    <StatusBadge variant="danger" className="mr-2">{overview.production.late}</StatusBadge>
                    {overview.production.late} production order{overview.production.late !== 1 ? 's' : ''} are past their scheduled date.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Rule-triggered alerts for this user.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.notifications.total === 0 ? (
                  <p className="text-sm text-muted-foreground">No notifications.</p>
                ) : (
                  <p className="text-sm">
                    <StatusBadge variant={overview.notifications.unread > 0 ? 'warning' : 'neutral'} className="mr-2">
                      {overview.notifications.unread} unread
                    </StatusBadge>
                    {overview.notifications.total} notification{overview.notifications.total !== 1 ? 's' : ''} total.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
