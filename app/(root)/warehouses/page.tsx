'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, RowActions } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', code: '', address: '' });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchWarehouses();
  }, []);

  async function fetchWarehouses() {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouses');
      if (!res.ok) throw new Error('Failed to load warehouses');
      const data: Warehouse[] = await res.json();
      setWarehouses(data);
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
      const res = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create warehouse');
      }
      setSheetOpen(false);
      setForm({ name: '', code: '', address: '' });
      await fetchWarehouses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this warehouse?')) return;
    await fetch(`/api/warehouses/${id}`, { method: 'DELETE' });
    await fetchWarehouses();
  }

  const columns: Array<{
    accessor: string;
    header: string;
    cell: (row: Warehouse) => React.ReactNode;
  }> = [
    {
      accessor: 'name',
      header: 'Name',
      cell: (row) => <div className="font-medium">{row.name}</div>,
    },
    {
      accessor: 'code',
      header: 'Code',
      cell: (row) => row.code ? <code className="text-sm font-mono">{row.code}</code> : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      accessor: 'address',
      header: 'Address',
      cell: (row) => row.address ? <span className="text-sm text-muted-foreground">{row.address}</span> : <span className="text-sm text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Warehouses"
        description="Storage locations where materials and stock are held."
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add warehouse
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
          data={warehouses}
          keyField="id"
          renderRowActions={(row) => (
            <RowActions
              onEdit={() => router.push(`/warehouses/${row.id}`)}
              onDelete={() => handleDelete(row.id)}
            />
          )}
          emptyMessage="No warehouses yet. Add your first storage location."
        />
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Add warehouse"
        description="Create a new warehouse or storage location."
        footer={
          <>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="w-name">Name</Label>
            <Input
              id="w-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Warehouse"
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="w-code">Code (optional)</Label>
            <Input
              id="w-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. WH-01"
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="w-address">Address (optional)</Label>
            <Input
              id="w-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Physical address of the warehouse"
              disabled={saving}
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
