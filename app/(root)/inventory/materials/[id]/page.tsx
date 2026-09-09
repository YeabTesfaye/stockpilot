'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, History, ShieldAlert, Truck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Alert } from '@/components/ui/alert';

interface Material {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  minStock: number;
  currentStock: number;
  reservedQty: number;
  createdAt: string;
  updatedAt: string;
}

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [material, setMaterial] = React.useState<Material | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: '', sku: '', description: '', unit: 'pcs', minStock: 0, currentStock: 0, reservedQty: 0 });

  React.useEffect(() => {
    if (!params.id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/materials/${params.id}`);
        if (res.status === 404) {
          setMaterial(null);
        } else if (!res.ok) {
          throw new Error('Failed to load material');
        } else {
          const data: Material = await res.json();
          setMaterial(data);
          setForm({
            name: data.name,
            sku: data.sku,
            description: data.description ?? '',
            unit: data.unit,
            minStock: data.minStock,
            currentStock: data.currentStock,
            reservedQty: data.reservedQty,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();
    return () => controller.abort();
  }, [params.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to save material');
      }
      const updated: Material = await res.json();
      setMaterial(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader title="Material not found" description="This material does not exist or you do not have access." />
        <Button onClick={() => router.push('/inventory/materials')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to materials
        </Button>
      </div>
    );
  }

  const atp = material.currentStock - material.reservedQty;
  const stockHealth = material.currentStock <= 0 ? 'out' : material.currentStock <= material.minStock && material.minStock > 0 ? 'low' : 'healthy';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => router.push('/inventory/materials')}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{material.name}</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            <code className="font-mono">{material.sku}</code> — {material.unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/inventory/materials/${params.id}/history`)}>
            <History className="mr-1 h-3.5 w-3.5" />
            Movement history
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/inventory/materials/${params.id}/reserve`)}>
            <ShieldAlert className="mr-1 h-3.5 w-3.5" />
            Reserve stock
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      <div className="flex items-center gap-3">
        <StatusBadge variant={stockHealth}>
          {stockHealth === 'out' ? 'Out of stock' : stockHealth === 'low' ? 'Low stock' : 'In stock'}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">Min: {material.minStock} {material.unit}</span>
      </div>

      <div className="rounded-lg border border-zinc-200 p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Stock levels</h2>
        <div className="flex flex-col gap-3 max-w-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">On hand</span>
            <span className="text-sm font-medium tabular-nums">{material.currentStock.toLocaleString()} {material.unit}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Reserved</span>
            <span className="text-sm font-medium tabular-nums text-amber-500">{material.reservedQty.toLocaleString()} {material.unit}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Available to promise</span>
            <span className={`text-sm font-medium tabular-nums ${atp <= 0 ? 'text-red-500' : ''}`}>
              {atp.toLocaleString()} {material.unit}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 max-w-sm">
          <div>
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="m-sku">SKU</Label>
            <Input id="m-sku" value={form.sku} onChange={(e) => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="m-desc">Description (optional)</Label>
            <Input id="m-desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} disabled={saving} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="m-unit">Unit</Label>
              <Input id="m-unit" value={form.unit} onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))} disabled={saving} />
            </div>
            <div>
              <Label htmlFor="m-min">Min stock</Label>
              <Input id="m-min" type="number" min={0} value={form.minStock} onChange={(e) => setForm(f => ({ ...f, minStock: parseInt(e.target.value, 10) || 0 }))} disabled={saving} />
            </div>
            <div>
              <Label htmlFor="m-stock">On hand</Label>
              <Input id="m-stock" type="number" min={0} value={form.currentStock} onChange={(e) => setForm(f => ({ ...f, currentStock: parseInt(e.target.value, 10) || 0 }))} disabled={saving} />
            </div>
            <div>
              <Label htmlFor="m-reserved">Reserved</Label>
              <Input id="m-reserved" type="number" min={0} value={form.reservedQty} onChange={(e) => setForm(f => ({ ...f, reservedQty: parseInt(e.target.value, 10) || 0 }))} disabled={saving} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push('/inventory/materials')}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name || !form.sku}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
