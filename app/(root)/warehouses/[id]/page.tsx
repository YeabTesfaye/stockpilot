'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WarehouseEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [warehouse, setWarehouse] = React.useState<Warehouse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({ name: '', code: '', address: '' });

  React.useEffect(() => {
    fetchWarehouse();
  }, [id]);

  async function fetchWarehouse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouses/${id}`);
      if (res.status === 404) {
        setWarehouse(null);
      } else if (!res.ok) {
        throw new Error('Failed to load warehouse');
      } else {
        const data: Warehouse = await res.json();
        setWarehouse(data);
        setForm({ name: data.name, code: data.code ?? '', address: data.address ?? '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to save warehouse');
      }
      await fetchWarehouse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Warehouse not found" description="This warehouse does not exist or you do not have access." />
        <Button onClick={() => router.push('/warehouses')}>Back to warehouses</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Edit warehouse"
        description={`Editing ${warehouse.name}`}
        actions={
          <Button variant="outline" onClick={() => router.push('/warehouses')}>
            Cancel
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="w-name">Name</Label>
            <Input
              id="w-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Warehouse"
            />
          </div>
          <div>
            <Label htmlFor="w-code">Code (optional)</Label>
            <Input
              id="w-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. WH-01"
            />
          </div>
          <div>
            <Label htmlFor="w-address">Address (optional)</Label>
            <Input
              id="w-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Physical address"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
