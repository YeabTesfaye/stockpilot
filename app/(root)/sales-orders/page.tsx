'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, RowActions } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectComponent } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

interface SalesOrder {
  id: string;
  customer: string;
  status: string;
  createdAt: string;
  itemCount: number;
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [products, setProducts] = React.useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [form, setForm] = React.useState({ customer: '', productId: '', quantity: '' });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(
          data.map((p: { id: string; name: string; sku: string }) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
          })),
        );
      }
    } catch { /* ignore */ }
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await fetch('/api/sales-orders');
      if (!res.ok) throw new Error('Failed to load sales orders');
      const data: SalesOrder[] = await res.json();
      setOrders(data);
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
      const res = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form.customer,
          items: [{ productId: form.productId, quantity: Number(form.quantity) }],
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create sales order');
      }
      setSheetOpen(false);
      setForm({ customer: '', productId: '', quantity: '' });
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      accessor: 'customer',
      header: 'Customer',
      cell: (row: SalesOrder) => <span className="font-medium">{row.customer}</span>,
    },
    {
      accessor: 'status',
      header: 'Status',
      cell: (row: SalesOrder) => (
        <span className="text-xs text-muted-foreground">{row.status}</span>
      ),
    },
    {
      accessor: 'itemCount',
      header: 'Items',
      cell: (row: SalesOrder) => <span className="text-sm text-muted-foreground">{row.itemCount}</span>,
    },
    {
      accessor: 'createdAt',
      header: 'Created',
      cell: (row: SalesOrder) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Sales orders"
        description="Customer demand records. Click an order to see material requirements exploded from the BOM."
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
            <RowActions
              onEdit={() => router.push(`/sales-orders/${row.id}`)}
              onDelete={() => {
                if (confirm('Delete this sales order?')) {
                  fetch(`/api/sales-orders/${row.id}`, { method: 'DELETE' }).then(() => fetchOrders());
                }
              }}
            />
          )}
          emptyMessage="No sales orders yet. Create your first customer order."
        />
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="New sales order"
        description="Record customer demand. Requirements are automatically exploded from each product's BOM."
        footer={
          <>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.customer || !form.productId || !form.quantity}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="so-customer">Customer</Label>
            <Input
              id="so-customer"
              value={form.customer}
              onChange={(e) => setForm(f => ({ ...f, customer: e.target.value }))}
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <Label htmlFor="so-product">Product</Label>
            <SelectComponent
              options={products.map(p => ({
                value: p.id,
                label: `${p.sku} — ${p.name}`,
              }))}
              value={form.productId}
              onValueChange={(v) => setForm(f => ({ ...f, productId: v, quantity: '' }))}
              placeholder="Select a product"
              displayValue={(v) => {
                const p = products.find(p => p.id === v);
                return p ? p.sku : undefined;
              }}
            />
          </div>
          <div>
            <Label htmlFor="so-qty">Quantity</Label>
            <Input
              id="so-qty"
              type="number"
              min="1"
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
