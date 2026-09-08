'use client';

import * as React from 'react';
import { Plus, Package } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, RowActions } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRouter } from 'next/navigation';

interface Material {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export default function MaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = React.useState<Material[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', sku: '', description: '', unit: 'pcs', minStock: 0 });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchMaterials();
  }, []);

  async function fetchMaterials() {
    setLoading(true);
    try {
      const res = await fetch('/api/materials');
      if (!res.ok) throw new Error('Failed to load materials');
      const data: Material[] = await res.json();
      setMaterials(data);
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
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create material');
      }
      setSheetOpen(false);
      setForm({ name: '', sku: '', description: '', unit: 'pcs', minStock: 0 });
      await fetchMaterials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this material?')) return;
    await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    await fetchMaterials();
  }

  const stockHealth = (mat: Material) => {
    if (mat.minStock <= 0) return 'neutral';
    return mat.minStock > 0 ? 'healthy' : 'low';
  };

  const columns: Array<{
    accessor: string;
    header: string;
    cell: (row: Material) => React.ReactNode;
  }> = [
    {
      accessor: 'sku',
      header: 'SKU',
      cell: (row) => <code className="text-sm font-mono">{row.sku}</code>,
    },
    {
      accessor: 'name',
      header: 'Name',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.description && <div className="text-xs text-muted-foreground mt-0.5">{row.description}</div>}
        </div>
      ),
    },
    {
      accessor: 'unit',
      header: 'Unit',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.unit}</span>,
    },
    {
      accessor: 'minStock',
      header: 'Stock health',
      cell: (row) => (
        <StatusBadge variant={stockHealth(row)}>
          {row.minStock <= 0 ? 'No min set' : row.minStock === 0 ? 'Zero min' : `${row.minStock} min`}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Materials"
        description="Raw materials and components tracked by SKU per tenant."
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add material
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
          data={materials}
          keyField="id"
          renderRowActions={(row) => (
            <RowActions
              onEdit={() => router.push(`/dashboard/inventory/materials/${row.id}`)}
              onDelete={() => handleDelete(row.id)}
            />
          )}
          emptyMessage="No materials yet. Add your first one to get started."
        />
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Add material"
        description="Create a new material or component with a unique SKU."
        footer={
          <>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.sku}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Steel Sheet 2mm"
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
              placeholder="e.g. STLH-2MM-001"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground mt-1">SKU must be unique within your tenant.</p>
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the material"
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. pcs, kg, m"
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="minStock">Min stock</Label>
              <Input
                id="minStock"
                type="number"
                min={0}
                value={form.minStock}
                onChange={(e) => setForm((f) => ({ ...f, minStock: parseInt(e.target.value, 10) || 0 }))}
                placeholder="0"
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
