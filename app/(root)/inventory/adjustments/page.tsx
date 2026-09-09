'use client';

import * as React from 'react';
import { Scale, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectComponent } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';

const REASONS = [
  { value: 'correction', label: 'Correction (fix a counting error)' },
  { value: 'damage_found', label: 'Damage found on inspection' },
  { value: 'theft_loss', label: 'Loss / shrinkage' },
  { value: 'write_off', label: 'Write-off (obsolete / expired)' },
  { value: 'other', label: 'Other' },
];

export default function AdjustmentsPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  const [materials, setMaterials] = React.useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [form, setForm] = React.useState({ materialId: '', quantity: '', reason: 'correction', note: '' });

  React.useEffect(() => {
    fetch('/api/materials')
      .then(r => r.json())
      .then(ms => setMaterials(ms))
      .catch(() => setMaterials([]));
  }, []);

  async function handleAdjust() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ADJUSTMENT',
          materialId: form.materialId,
          quantity: Number(form.quantity),
          reference: form.note || undefined,
          description: `${REASONS.find(r => r.value === form.reason)?.label ?? form.reason}: ${form.note || 'No note'}`,
          idempotencyKey: `adjust-${form.materialId}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Adjustment failed');
      }
      setResult(`Adjusted stock by ${Number(form.quantity) > 0 ? '+' : ''}${form.quantity} units.`);
      setForm({ materialId: '', quantity: '', reason: 'correction', note: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const materialOptions = materials.map(m => ({
    value: m.id,
    label: `${m.sku} — ${m.name}`,
  }));

  const reasonOptions = REASONS.map(r => ({
    value: r.value,
    label: r.label,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Stock adjustments"
        description="Record manual corrections to on-hand stock. Each adjustment creates an immutable ledger entry with a reason."
      />

      {error && (
        <Alert variant="danger">
          <AlertTriangle className="mr-2 h-4 w-4" />
          {error}
        </Alert>
      )}

      {result && (
        <Alert variant="success">
          <CheckCircle className="mr-2 h-4 w-4" />
          {result}
        </Alert>
      )}

      <div className="rounded-lg border border-zinc-200 p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-4 max-w-sm">
          <div>
            <Label htmlFor="adj-material">Material</Label>
            <SelectComponent
              options={materialOptions}
              value={form.materialId}
              onValueChange={(v) => setForm(f => ({ ...f, materialId: v, quantity: '' }))}
              placeholder="Select a material"
            />
          </div>

          <div>
            <Label htmlFor="adj-reason">Reason</Label>
            <SelectComponent
              options={reasonOptions}
              value={form.reason}
              onValueChange={(v) => setForm(f => ({ ...f, reason: v }))}
            />
          </div>

          <div>
            <Label htmlFor="adj-qty">Quantity (signed)</Label>
            <Input
              id="adj-qty"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="Positive = stock in, negative = stock out"
            />
          </div>

          <div>
            <Label htmlFor="adj-note">Note (optional)</Label>
            <Input
              id="adj-note"
              value={form.note}
              onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Found 3 damaged units during inspection"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleAdjust}
              disabled={loading || !form.materialId || !form.quantity}
            >
              {loading ? 'Recording...' : 'Record adjustment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
