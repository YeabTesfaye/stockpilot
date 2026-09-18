'use client';

import * as React from 'react';
import { TrendingUp, AlertTriangle, Package, Factory, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ForecastPoint {
  date: string;
  projectedDemand: number;
  cumulativeDemand: number;
}

interface ForecastResult {
  materialId: string;
  materialName: string;
  materialSku: string;
  unit: string;
  averageDailyDemand: number;
  projection: ForecastPoint[];
  totalProjectedDemand: number;
  source: 'movements' | 'bom_demand' | 'none';
}

interface CriticalMaterial {
  id: string;
  name: string;
  sku: string;
  unit: string;
  minStock: number;
  currentStock: number;
  reservedQty: number;
  available: number;
  shortage: number;
}

interface ScheduleOrder {
  id: string;
  productName: string;
  productSku: string;
  quantity: number;
  machineName: string;
  machineCode: string | null;
  scheduledDate: string | null;
  status: string;
}

interface ScheduleGridRow {
  machineId: string;
  machineName: string;
  machineCode: string | null;
  orders: ScheduleOrder[];
}

type OverviewData =
  | { phase: 'loading' }
  | {
      phase: 'loaded';
      forecasts: ForecastResult[];
      critical: CriticalMaterial[];
      schedule: ScheduleGridRow[];
      generatedAt: string;
    }
  | { phase: 'error'; message: string };

export default function ReportsOverviewPage() {
  const [data, setData] = React.useState<OverviewData>({ phase: 'loading' });

  React.useEffect(() => {
    Promise.all([fetchForecasts(), fetchCritical(), fetchSchedule()])
      .then(([forecasts, critical, schedule]) =>
        setData({
          phase: 'loaded',
          forecasts,
          critical,
          schedule,
          generatedAt: new Date().toISOString(),
        }),
      )
      .catch((err) =>
        setData({ phase: 'error', message: err instanceof Error ? err.message : 'Failed to load reports' }),
      );
  }, []);

  async function fetchForecasts(): Promise<ForecastResult[]> {
    const res = await fetch('/api/planning/forecast', { cache: 'no-store' });
    if (!res.ok) throw new Error(`forecast fetch failed: ${res.status}`);
    const json = await res.json();
    return json.forecasts ?? [];
  }

  async function fetchCritical(): Promise<CriticalMaterial[]> {
    const res = await fetch('/api/planning/reorder-points', { cache: 'no-store' });
    if (!res.ok) throw new Error(`reorder-points fetch failed: ${res.status}`);
    const json = await res.json();
    return json.criticalMaterials ?? [];
  }

  async function fetchSchedule(): Promise<ScheduleGridRow[]> {
    const res = await fetch('/api/planning/production-schedule', { cache: 'no-store' });
    if (!res.ok) throw new Error(`production-schedule fetch failed: ${res.status}`);
    const json = await res.json();
    return json.grid ?? [];
  }

  if (data.phase === 'loading') {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Reports overview"
          description="Demand forecast, reorder status, and production schedule in one view."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (data.phase === 'error') {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader
          title="Reports overview"
          description="Demand forecast, reorder status, and production schedule in one view."
        />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {data.message}
        </div>
      </div>
    );
  }

  const completedOrders = data.schedule.reduce(
    (acc, row) => acc + row.orders.filter((o) => o.status === 'COMPLETED').length,
    0,
  );
  const scheduledOrders = data.schedule.reduce(
    (acc, row) => acc + row.orders.filter((o) => o.status === 'SCHEDULED').length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Reports overview"
        description="Demand forecast, reorder status, and production schedule in one view."
        actions={
          <div className="text-sm text-muted-foreground">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </div>
        }
      />

      {/* Signal tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Materials below reorder</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {data.critical.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.critical.length === 0
                ? 'All materials above their reorder points.'
                : `${data.critical.length} material${data.critical.length === 1 ? '' : 's'} need replenishment.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Forecast coverage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {data.forecasts.filter((f) => f.source !== 'none').length}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}/ {data.forecasts.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {data.forecasts.length - data.forecasts.filter((f) => f.source !== 'none').length} material
              {data.forecasts.length - data.forecasts.filter((f) => f.source !== 'none').length === 1
                ? ' has'
                : 's have'} no demand history.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Scheduled orders</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {scheduledOrders}
            </div>
            <p className="text-xs text-muted-foreground">
              {completedOrders} completed this period.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Machines active</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {data.schedule.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.schedule.reduce((acc, row) => acc + row.orders.length, 0)} order
              {data.schedule.reduce((acc, row) => acc + row.orders.length, 0) === 1 ? '' : 's'} scheduled.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical materials */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Critical materials</CardTitle>
            {data.critical.length > 0 && (
              <StatusBadge variant="danger">
                {data.critical.length} below reorder
              </StatusBadge>
            )}
          </div>
          <CardDescription>
            Materials whose available stock has fallen to or below the reorder
            point, sorted by urgency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.critical.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              No materials below their reorder point.
            </div>
          ) : (
            <div className="divide-y">
              {data.critical.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <code className="text-sm font-mono">{m.sku}</code>
                    <span className="text-xs text-muted-foreground ml-2">
                      — {m.name}
                    </span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {m.available} {m.unit} available · reorder point {m.minStock}
                      {m.shortage > 0 ? ` · short by ${m.shortage}` : ''}
                    </div>
                  </div>
                  <StatusBadge variant="danger">{m.shortage > 0 ? 'short' : 'at point'}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast summary */}
      <Card>
        <CardHeader>
          <CardTitle>Demand forecast</CardTitle>
          <CardDescription>
            7-day moving average projection per material. Full per-material
            chart is available on the forecast page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.forecasts.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="No materials to forecast"
              description="Add materials and sales orders to see demand projections."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.forecasts.map((f) => (
                <div
                  key={f.materialId}
                  className="rounded-lg border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <code className="text-sm font-mono">{f.materialSku}</code>
                      <span className="text-xs text-muted-foreground ml-2">
                        — {f.materialName}
                      </span>
                    </div>
                    <StatusBadge
                      variant={
                        f.source === 'none'
                          ? 'neutral'
                          : f.totalProjectedDemand > 0
                            ? 'healthy'
                            : 'warning'
                      }
                    >
                      {f.source === 'none'
                        ? 'no data'
                        : `${f.source === 'bom_demand' ? 'bom' : 'movements'}`}
                    </StatusBadge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {f.averageDailyDemand > 0
                      ? `${f.averageDailyDemand.toFixed(2)} {f.unit}/day · ${f.totalProjectedDemand.toFixed(0)} {f.unit} next 7 days`
                      : 'No projected demand.'}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {f.projection.slice(0, 7).map((p, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded bg-primary/15"
                        style={{ height: `${Math.min(60, Math.max(4, p.projectedDemand * 8))}px` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule summary */}
      <Card>
        <CardHeader>
          <CardTitle>Production schedule</CardTitle>
          <CardDescription>
            Machine-by-machine schedule. Full heat-grid view is on the schedule
            page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.schedule.length === 0 ? (
            <EmptyState
              icon={<Factory className="h-8 w-8" />}
              title="No active machines"
              description="Add machines to see the production schedule grid."
            />
          ) : (
            <div className="divide-y">
              {data.schedule.map((row) => (
                <div key={row.machineId} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">
                      {row.machineName}
                      {row.machineCode ? (
                        <code className="text-xs text-muted-foreground ml-2">
                          {row.machineCode}
                        </code>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {row.orders.length} order{row.orders.length === 1 ? '' : 's'} scheduled
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {row.orders.slice(0, 3).map((o) => (
                      <StatusBadge
                        key={o.id}
                        variant={
                          o.status === 'COMPLETED'
                            ? 'healthy'
                            : o.status === 'STARTED'
                              ? 'warning'
                              : 'neutral'
                        }
                        className="text-xs"
                      >
                        {o.productSku} × {o.quantity}
                      </StatusBadge>
                    ))}
                    {row.orders.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{row.orders.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
