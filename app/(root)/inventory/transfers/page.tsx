'use client';

import * as React from 'react';
import { Plus, Truck, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectComponent } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Alert } from '@/components/ui/alert';

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
}

interface Material {
  id: string;
  name: string;
  sku: string;
}

export default function TransfersPage() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [materials, setMaterials] = React.useState<Material[]>([]);
  const [form, setForm] = React.useState({ materialId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '' });

  React.useEffect(() => {
    Promise.all([
      fetch('/api/warehouses').then(r => r.json()).catch(() => []),
      fetch('/api/materials').then(r => r.json()).catch(() => []),
    ]).then(([ws, ms]) => {
      setWarehouses(ws);
      setMaterials(ms);
    });
  }, []);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: form.materialId,
          fromWarehouseId: form.fromWarehouseId,
          toWarehouseId: form.toWarehouseId,
          quantity: Number(form.quantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Transfer failed');
      }
      setResult(`Transferred ${form.quantity} units successfully.`);
      setOpen(false);
      setForm({ materialId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const fromWhs = warehouses.filter(w => w.id !== form.toWarehouseId);
  const toWhs = warehouses.filter(w => w.id !== form.fromWarehouseId);

  const materialOptions = materials.map(m => ({
    value: m.id,
    label: `${m.sku} — ${m.name}`,
  }));

  const fromWhOptions = fromWhs.map(w => ({
    value: w.id,
    label: `${w.name}${w.code ? ` (${w.code})` : ''}`,
  }));

  const toWhOptions = toWhs.map(w => ({
    value: w.id,
    label: `${w.name}${w.code ? ` (${w.code})` : ''}`,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Stock transfers"
        description="Move stock between warehouses. Each transfer creates two immutable ledger entries: an outflow from the source and an inflow to the destination."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New transfer
          </Button>
        }
      />

      {error && (
        <Alert variant="danger">
          <AlertTriangle className="mr-2 h-4 w-4" />
          {error}
        </Alert>
      )}

      {result && (
        <Alert variant="success">
          <Truck className="mr-2 h-4 w-4" />
          {result}
        </Alert>
      )}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="New stock transfer"
        description="Move stock from one warehouse to another."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading || !form.materialId || !form.fromWarehouseId || !form.toWarehouseId || !form.quantity}>
              {loading ? 'Transferring...' : 'Transfer'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="t-material">Material</Label>
            <SelectComponent
              options={materialOptions}
              value={form.materialId}
              onValueChange={(v) => setForm(f => ({ ...f, materialId: v, fromWarehouseId: '', toWarehouseId: '', quantity: '' }))}
              placeholder="Select a material"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From warehouse</Label>
              <SelectComponent
                options={fromWhOptions}
                value={form.fromWarehouseId}
                onValueChange={(v) => setForm(f => ({ ...f, fromWarehouseId: v, toWarehouseId: '' }))}
                placeholder="Source warehouse"
              />
            </div>
            <div>
              <Label>To warehouse</Label>
              <SelectComponent
                options={toWhOptions}
                value={form.toWarehouseId}
                onValueChange={(v) => setForm(f => ({ ...f, toWarehouseId: v }))}
                placeholder="Destination warehouse"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="t-qty">Quantity</Label>
            <Input
              id="t-qty"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="Number of units"
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
