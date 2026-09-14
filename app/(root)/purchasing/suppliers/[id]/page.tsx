'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  leadTimeDays: number;
}

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [supplier, setSupplier] = React.useState<Supplier | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: '', code: '', contactName: '', email: '', phone: '', leadTimeDays: 7 });

  React.useEffect(() => {
    fetchSupplier();
  }, [params.id]);

  async function fetchSupplier() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${params.id}`);
      if (res.status === 404) {
        setSupplier(null);
      } else if (!res.ok) {
        throw new Error('Failed to load supplier');
      } else {
        const data: Supplier = await res.json();
        setSupplier(data);
        setForm({
          name: data.name,
          code: data.code ?? '',
          contactName: data.contactName ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          leadTimeDays: data.leadTimeDays,
        });
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
      const res = await fetch(`/api/suppliers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to save supplier');
      }
      await fetchSupplier();
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

  if (!supplier) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Supplier not found" description="This supplier does not exist or you do not have access." />
        <Button onClick={() => router.push('/purchasing/suppliers')}>Back to suppliers</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Edit supplier"
        description={supplier.name}
        actions={
          <Button variant="outline" onClick={() => router.push('/purchasing/suppliers')}>
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
            <Label htmlFor="sup-name">Name</Label>
            <Input
              id="sup-name"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="sup-code">Code</Label>
            <Input
              id="sup-code"
              value={form.code}
              onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sup-contact">Contact name</Label>
              <Input
                id="sup-contact"
                value={form.contactName}
                onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="sup-email">Email</Label>
              <Input
                id="sup-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sup-phone">Phone</Label>
              <Input
                id="sup-phone"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="sup-lead">Lead time (days)</Label>
              <Input
                id="sup-lead"
                type="number"
                min={1}
                value={form.leadTimeDays}
                onChange={(e) => setForm(f => ({ ...f, leadTimeDays: parseInt(e.target.value, 10) || 7 }))}
                disabled={saving}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push('/purchasing/suppliers')}>
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
