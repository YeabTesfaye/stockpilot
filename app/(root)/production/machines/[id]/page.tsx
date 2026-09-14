'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface Machine {
  id: string;
  name: string;
  code: string | null;
  capacityPerDay: number;
  isActive: boolean;
}

export default function MachineDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [machine, setMachine] = React.useState<Machine | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: '', code: '', capacityPerDay: 1, isActive: true });

  React.useEffect(() => {
    fetchMachine();
  }, [params.id]);

  async function fetchMachine() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/machines/${params.id}`);
      if (res.status === 404) {
        setMachine(null);
      } else if (!res.ok) {
        throw new Error('Failed to load machine');
      } else {
        const data: Machine = await res.json();
        setMachine(data);
        setForm({ name: data.name, code: data.code ?? '', capacityPerDay: data.capacityPerDay, isActive: data.isActive });
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
      const res = await fetch(`/api/machines/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to save machine');
      }
      await fetchMachine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Machine not found" description="This machine does not exist or you do not have access." />
        <Button onClick={() => router.push('/production/machines')}>Back to machines</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Edit machine"
        description={machine.name}
        actions={
          <Button variant="outline" onClick={() => router.push('/production/machines')}>
            Back
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
            <Label htmlFor="mach-name">Name</Label>
            <Input
              id="mach-name"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="mach-code">Code</Label>
            <Input
              id="mach-code"
              value={form.code}
              onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mach-capacity">Capacity per day</Label>
              <Input
                id="mach-capacity"
                type="number"
                min={1}
                value={form.capacityPerDay}
                onChange={(e) => setForm(f => ({ ...f, capacityPerDay: parseInt(e.target.value, 10) || 1 }))}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="mach-active">Active</Label>
              <input
                id="mach-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                disabled={saving}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push('/production/machines')}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
