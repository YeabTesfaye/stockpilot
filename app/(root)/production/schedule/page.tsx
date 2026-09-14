'use client';

import * as React from 'react';
import { Calendar, Clock, Factory, Play, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';

type ScheduledOrder = {
  id: string;
  productName: string;
  productSku: string;
  quantity: number;
  machineName: string;
  machineCode: string | null;
  scheduledDate: string | null;
  status: string;
  createdAt: string;
};

type ScheduleGridRow = {
  machineId: string;
  machineName: string;
  machineCode: string | null;
  orders: ScheduledOrder[];
};

const statusVariant = (s: string) => {
  switch (s) {
    case 'SCHEDULED': return 'neutral';
    case 'STARTED': return 'warning';
    case 'COMPLETED': return 'healthy';
    case 'CANCELLED': return 'danger';
    default: return 'neutral';
  }
};

const statusIcon = (s: string) => {
  switch (s) {
    case 'SCHEDULED': return <Calendar className="h-3.5 w-3.5" />;
    case 'STARTED': return <Play className="h-3.5 w-3.5" />;
    case 'COMPLETED': return <CheckCircle className="h-3.5 w-3.5" />;
    case 'CANCELLED': return <XCircle className="h-3.5 w-3.5" />;
    default: return null;
  }
};

export default function ProductionSchedulePage() {
  const [grid, setGrid] = React.useState<ScheduleGridRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchSchedule();
  }, []);

  async function fetchSchedule() {
    setLoading(true);
    try {
      const res = await fetch('/api/production-orders');
      if (!res.ok) throw new Error('Failed to load schedule');
      const orders = await res.json();

      // Group orders by machine.
      const grouped: Record<string, ScheduledOrder[]> = {};
      // We need to fetch machines to get machine names.
      const machinesRes = await fetch('/api/machines');
      const machines: Array<{ id: string; name: string; code: string | null }> = machinesRes.ok
        ? await machinesRes.json()
        : [];

      for (const order of orders) {
        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') continue;
        const machine = machines.find(m => m.id === order.machineId);
        const existing = grouped[order.machineId] ?? [];
        existing.push({
          ...order,
          machineName: machine?.name ?? 'Unknown',
          machineCode: machine?.code ?? null,
        });
        grouped[order.machineId] = existing;
      }

      const gridData: ScheduleGridRow[] = machines.map(m => ({
        machineId: m.id,
        machineName: m.name,
        machineCode: m.code,
        orders: grouped[m.id] ?? [],
      })).filter(row => row.orders.length > 0);

      setGrid(gridData);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Production schedule"
        description="Greedy earliest-due-date-first schedule across available machines. Color-coded by status — green for completed, amber for in-progress, gray for scheduled."
        actions={
          <Button onClick={fetchSchedule}>
            <Factory className="mr-2 h-4 w-4" />
            Refresh schedule
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-lg border border-zinc-200 p-6 dark:border-neutral-800">
              <Skeleton className="h-5 w-40 mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : grid.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <Factory className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No production orders scheduled.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create machines and production orders to see them on this grid.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grid.map((row) => (
            <Card key={row.machineId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Factory className="h-4 w-4 text-muted-foreground" />
                    {row.machineName}
                    {row.machineCode && (
                      <code className="text-xs font-mono text-muted-foreground ml-1">{row.machineCode}</code>
                    )}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {row.orders.length} order{row.orders.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {row.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {row.orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 rounded-md border border-zinc-200 p-3 dark:border-neutral-800"
                      >
                        <StatusBadge variant={statusVariant(order.status)}>
                          {statusIcon(order.status)}
                          {order.status}
                        </StatusBadge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono">{order.productSku}</code>
                            <span className="text-sm truncate">{order.productName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {order.quantity} units
                            {order.scheduledDate && (
                              <span className="ml-2">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {new Date(order.scheduledDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          #{order.id.slice(0, 8)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
