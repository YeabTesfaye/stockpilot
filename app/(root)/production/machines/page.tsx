'use client';

import * as React from 'react';
import { Plus, Factory } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, RowActions } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface Machine {
  id: string;
  name: string;
  code: string | null;
  capacityPerDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MachinesPage() {
  const router = useRouter();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', code: '', capacityPerDay: 1 });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchMachines();
  }, []);

  async function fetchMachines() {
    setLoading(true);
    try {
      const res = await fetch('/api/machines');
      if (!res.ok) throw new Error('Failed to load machines');
      const data: Machine[] = await res.json();
      setMachines(data);
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
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create machine');
      }
      setSheetOpen(false);
      setForm({ name: '', code: '', capacityPerDay: 1 });
      await fetchMachines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this machine?')) return;
    await fetch(`/api/machines/${id}`, { method: 'DELETE' });
    await fetchMachines();
  }

  const columns = [
    {
      accessor: 'name',
      header: 'Machine',
      cell: (row: Machine) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.code && <div className="text-xs text-muted-foreground font-mono">{row.code}</div>}
        </div>
      ),
    },
    {
      accessor: 'capacity',
      header: 'Capacity/day',
      cell: (row: Machine) => (
        <span className="text-sm text-muted-foreground">{row.capacityPerDay} units</span>
      ),
    },
    {
      accessor: 'status',
      header: 'Status',
      cell: (row: Machine) => (
        <span className={row.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      accessor: 'createdAt',
      header: 'Created',
      cell: (row: Machine) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Machines"
        description="Production machines that orders are scheduled against. Each machine has a daily capacity and can be activated or deactivated."
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add machine
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
          data={machines}
          keyField="id"
          renderRowActions={(row) => (
            <RowActions
              onEdit={() => router.push(`/production/machines/${row.id}`)}
              onDelete={() => handleDelete(row.id)}
            />
          )}
          emptyMessage="No machines yet. Add your first machine to start scheduling production."
        />
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Add machine"
        description="Register a new production machine."
        footer={
          <>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="m-name">Name</Label>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. CNC Lathe #1"
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="m-code">Code (optional)</Label>
            <Input
              id="m-code"
              value={form.code}
              onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="e.g. CNC-01"
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="m-capacity">Capacity per day</Label>
            <Input
              id="m-capacity"
              type="number"
              min={1}
              value={form.capacityPerDay}
              onChange={(e) => setForm(f => ({ ...f, capacityPerDay: parseInt(e.target.value, 10) || 1 }))}
              disabled={saving}
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
