'use client';

import * as React from 'react';
import { Plus, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, RowActions } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectComponent } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRouter } from 'next/navigation';
import type { ProductionOrderRow as ProductionOrder } from '@/server/model/machines';

interface Machine {
  id: string;
  name: string;
  code: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

const statusVariantMap: Record<string, 'healthy' | 'warning' | 'danger' | 'neutral'> = {
  SCHEDULED: 'neutral',
  STARTED: 'warning',
  COMPLETED: 'healthy',
  CANCELLED: 'danger',
};

export default function ProductionOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = React.useState<ProductionOrder[]>([]);
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [form, setForm] = React.useState({ productId: '', machineId: '', quantity: '' });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [ordersRes, machinesRes, productsRes] = await Promise.all([
        fetch('/api/production-orders'),
        fetch('/api/machines'),
        fetch('/api/products'),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (machinesRes.ok) setMachines(await machinesRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          machineId: form.machineId,
          quantity: Number(form.quantity),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create order');
      }
      setSheetOpen(false);
      setForm({ productId: '', machineId: '', quantity: '' });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(orderId: string, status: string) {
    const res = await fetch(`/api/production-orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this production order?')) return;
    await fetch(`/api/production-orders/${id}`, { method: 'DELETE' });
    await fetchData();
  }

  const machineOptions = machines.map(m => ({
    value: m.id,
    label: `${m.name}${m.code ? ` (${m.code})` : ''}`,
  }));

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.sku} — ${p.name}`,
  }));

  const columns = [
    {
      accessor: 'product',
      header: 'Product',
      cell: (row: ProductionOrder) => (
        <div>
          <code className="text-sm font-mono">{row.productSku}</code>
          <div className="text-xs text-muted-foreground">{row.productName}</div>
        </div>
      ),
    },
    {
      accessor: 'machine',
      header: 'Machine',
      cell: (row: ProductionOrder) => (
        <div>
          <div className="text-sm">{row.machineName}</div>
          {row.machineCode && <div className="text-xs text-muted-foreground font-mono">{row.machineCode}</div>}
        </div>
      ),
    },
    {
      accessor: 'quantity',
      header: 'Qty',
      cell: (row: ProductionOrder) => (
        <span className="text-sm tabular-nums">{row.quantity}</span>
      ),
    },
    {
      accessor: 'status',
      header: 'Status',
      cell: (row: ProductionOrder) => (
        <StatusBadge variant={statusVariantMap[row.status] ?? 'neutral'}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      accessor: 'scheduled',
      header: 'Scheduled',
      cell: (row: ProductionOrder) => (
        <span className="text-sm text-muted-foreground">
          {row.scheduledDate
            ? new Date(row.scheduledDate).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      accessor: 'createdAt',
      header: 'Created',
      cell: (row: ProductionOrder) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Production orders"
        description="Scheduled production runs gated on material availability. Orders are assigned to machines using the earliest-due-date-first heuristic."
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New order
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          keyField="id"
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              {row.status === 'SCHEDULED' && (
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Start"
                  onClick={() => handleStatusChange(row.id, 'STARTED')}>
                  <Play className="h-3 w-3" />
                </Button>
              )}
              {row.status === 'STARTED' && (
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Complete"
                  onClick={() => handleStatusChange(row.id, 'COMPLETED')}>
                  <CheckCircle className="h-3 w-3" />
                </Button>
              )}
              {row.status === 'STARTED' && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Cancel"
                  onClick={() => handleStatusChange(row.id, 'CANCELLED')}>
                  <XCircle className="h-3 w-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete"
                onClick={() => handleDelete(row.id)}>
                <Clock className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          emptyMessage="No production orders. Create a machine and an order to get started."
        />
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="New production order"
        description="Schedule a production run for a product on a specific machine."
        footer={
          <>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.productId || !form.machineId || !form.quantity}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="po-product">Product</Label>
            <SelectComponent
              options={productOptions}
              value={form.productId}
              onValueChange={(v) => setForm(f => ({ ...f, productId: v }))}
              placeholder="Select a product"
              displayValue={(v) => {
                const p = products.find((x) => x.id === v);
                return p ? `${p.sku} — ${p.name}` : undefined;
              }
            }
            />
            {form.productId && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: {products.find((p) => p.id === form.productId)?.sku} —{' '}
                {products.find((p) => p.id === form.productId)?.name}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="po-machine">Machine</Label>
            <SelectComponent
              options={machineOptions}
              value={form.machineId}
              onValueChange={(v) => setForm(f => ({ ...f, machineId: v }))}
              placeholder="Select a machine"
            />
          </div>
          <div>
            <Label htmlFor="po-qty">Quantity</Label>
            <Input
              id="po-qty"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="Number of units"
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
