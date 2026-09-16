'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function EditMaterialPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [material, setMaterial] = React.useState<Material | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: '',
    sku: '',
    description: '',
    unit: 'pcs',
    currentStock: 0,
    reservedQty: 0,
    minStock: 0,
  });

  React.useEffect(() => {
    fetchMaterial();
  }, []);

  async function fetchMaterial() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${params.id}`);
      if (res.status === 404) {
        setMaterial(null);
      } else if (res.ok) {
        const data: Material = await res.json();
        setMaterial(data);
        setForm({
          name: data.name,
          sku: data.sku,
          description: data.description ?? '',
          unit: data.unit,
          currentStock: data.currentStock,
          reservedQty: data.reservedQty,
          minStock: data.minStock,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    finally { setLoading(false); }
  }

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
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save material');
      }
      await fetchMaterial();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <PageHeader title="Material not found" />
        <Button onClick={() => router.push('/inventory/materials')}>
          Back to materials
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -ml-2"
          onClick={() => router.push(`/inventory/materials/${params.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit material</h1>
      </div>

      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              disabled={saving}
            />
          </div>

          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={form.sku}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sku: e.target.value.toUpperCase(),
                }))
              }
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              SKU must be unique within your tenant.
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  description: e.target.value,
                }))
              }
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
              }
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="minStock">Min stock (reorder point)</Label>
              <Input
                id="minStock"
                type="number"
                min={0}
                value={form.minStock}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    minStock: parseInt(e.target.value, 10) || 0,
                  }))
                }
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currentStock">On hand</Label>
              <Input
                id="currentStock"
                type="number"
                min={0}
                value={form.currentStock}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    currentStock: parseInt(e.target.value, 10) || 0,
                  }))
                }
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="reservedQty">Reserved</Label>
              <Input
                id="reservedQty"
                type="number"
                min={0}
                value={form.reservedQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    reservedQty: parseInt(e.target.value, 10) || 0,
                  }))
                }
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/inventory/materials/${params.id}`)
              }
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
