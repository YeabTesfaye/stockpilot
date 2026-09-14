'use client';

import * as React from 'react';
import { Plus, Truck, Building } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, RowActions } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  leadTimeDays: number;
  createdAt: string;
  updatedAt: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', code: '', contactName: '', email: '', phone: '', leadTimeDays: 7 });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      if (!res.ok) throw new Error('Failed to load suppliers');
      const data: Supplier[] = await res.json();
      setSuppliers(data);
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
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create supplier');
      }
      setSheetOpen(false);
      setForm({ name: '', code: '', contactName: '', email: '', phone: '', leadTimeDays: 7 });
      await fetchSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this supplier?')) return;
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    await fetchSuppliers();
  }

  const columns = [
    {
      accessor: 'name',
      header: 'Supplier',
      cell: (row: Supplier) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.code && <div className="text-xs text-muted-foreground font-mono">{row.code}</div>}
        </div>
      ),
    },
    {
      accessor: 'contact',
      header: 'Contact',
      cell: (row: Supplier) => (
        <div>
          {row.contactName && <div className="text-sm">{row.contactName}</div>}
          {row.email && <div className="text-xs text-muted-foreground">{row.email}</div>}
        </div>
      ),
    },
    {
      accessor: 'leadTime',
      header: 'Lead time',
      cell: (row: Supplier) => (
        <span className="text-sm text-muted-foreground">{row.leadTimeDays} days</span>
      ),
    },
    {
      accessor: 'createdAt',
      header: 'Created',
      cell: (row: Supplier) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage suppliers and their material pricing. Used by the purchase recommendation engine to find the best source for each material."
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add supplier
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
          data={suppliers}
          keyField="id"
          renderRowActions={(row) => (
            <RowActions
              onEdit={() => router.push(`/purchasing/suppliers/${row.id}`)}
              onDelete={() => handleDelete(row.id)}
            />
          )}
          emptyMessage="No suppliers yet. Add your first supplier to enable purchase recommendations."
        />
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Add supplier"
        description="Add a new supplier that can provide materials."
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
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Plastics Inc."
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="s-code">Code (optional)</Label>
            <Input
              id="s-code"
              value={form.code}
              onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="e.g. ACME-PL"
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="s-contact">Contact name</Label>
              <Input
                id="s-contact"
                value={form.contactName}
                onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="e.g. Jane Smith"
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="e.g. jane@acme.test"
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="s-phone">Phone</Label>
              <Input
                id="s-phone"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. +1-555-0100"
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="s-lead">Lead time (days)</Label>
              <Input
                id="s-lead"
                type="number"
                min={1}
                value={form.leadTimeDays}
                onChange={(e) => setForm(f => ({ ...f, leadTimeDays: parseInt(e.target.value, 10) || 7 }))}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
