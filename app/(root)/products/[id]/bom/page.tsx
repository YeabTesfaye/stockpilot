'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Package, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

interface BomItem {
  id: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  quantity: number;
  unit: string;
}

interface BomVersion {
  id: string;
  version: number;
  effectiveAt: string;
  createdAt: string;
}

interface BomApiResponse {
  productId: string;
  currentVersion: number | null;
  versions: BomVersion[];
}

interface NewBomRow {
  materialId: string;
  quantity: string;
  unit: string;
}

const DEFAULT_UNITS = ['pcs', 'kg', 'm', 'm²', 'm³', 'L', 'sets'];

export default function BomEditorPage() {
  const params = useParams<{ id: string }>();
  const [bomData, setBomData] = React.useState<BomApiResponse | null>(null);
  const [items, setItems] = React.useState<BomItem[]>([]);
  const [materials, setMaterials] = React.useState<Array<{ id: string; name: string; sku: string; unit: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // New row form state
  const [newRows, setNewRows] = React.useState<NewBomRow[]>([]);

  const fetchBom = React.useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const [bomRes, prodRes, matsRes] = await Promise.all([
        fetch(`/api/products/${params.id}/bom/versions`),
        fetch(`/api/products/${params.id}`),
        fetch('/api/materials'),
      ]);
      if (!bomRes.ok) throw new Error('Failed to load BOM');
      const bomJson: BomApiResponse = await bomRes.json();
      setBomData(bomJson);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setItems(prodData.bomItems ?? []);
      }

      if (matsRes.ok) {
        const mats: typeof materials = await matsRes.json();
        setMaterials(mats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    if (!params.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchBom's setState calls are deferred (post-await); it's also reused by handleSave/handleRevert, so it can't be inlined here.
    fetchBom();
  }, [params.id, fetchBom]);

  function addNewRow() {
    setNewRows((prev) => [
      ...prev,
      { materialId: '', quantity: '1', unit: 'pcs' },
    ]);
  }

  function removeNewRow(index: number) {
    setNewRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateNewRow(index: number, field: keyof NewBomRow, value: string) {
    setNewRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleSave() {
    if (!params.id) return;
    setSaving(true);
    setError(null);

    // Combine existing items + new rows
    const allItems = [
      ...items.map((i) => ({ materialId: i.materialId, quantityPerUnit: i.quantity, unit: i.unit })),
      ...newRows
        .filter((r) => r.materialId && parseFloat(r.quantity) > 0)
        .map((r) => ({
          materialId: r.materialId,
          quantityPerUnit: parseFloat(r.quantity) || 1,
          unit: r.unit || 'pcs',
        })),
    ];

    if (allItems.length === 0) {
      setSaving(false);
      setError('Add at least one material to the BOM.');
      return;
    }

    try {
      const res = await fetch(`/api/products/${params.id}/bom/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', items: allItems }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to save BOM');
      }
      setError(null);
      // Refresh
      await fetchBom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert(version: number) {
    if (!params.id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${params.id}/bom/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert', revertTo: version }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to revert BOM');
      }
      await fetchBom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(materialId: string) {
    if (!params.id) return;
    try {
      const res = await fetch(`/api/products/${params.id}/bom?materialId=${materialId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.materialId !== materialId));
      }
    } catch {
      setError('Failed to remove item');
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

  if (error && !bomData) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  const productId = bomData?.productId ?? params.id;
  const currentVersion = bomData?.currentVersion ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title={`BOM — ${bomData ? `v${bomData.versions[0]?.version ?? '?'}` : 'Editing'}`}
        description={
          currentVersion !== null
            ? `Product BOM editor. Current version: v${currentVersion}. Changes create a new version.`
            : 'Loading BOM...'
        }
        actions={
          currentVersion !== null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to product
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Version history */}
      {bomData && bomData.versions.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Version history</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {bomData.versions.map((v) => (
              <div
                key={v.id}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  v.version === currentVersion
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                v{v.version}
                {v.version === currentVersion ? ' (current)' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing BOM items */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Current BOM items</h2>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">{items.length} materials</span>
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No materials yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <code className="text-sm font-mono">{item.materialSku}</code>
                  <span className="text-xs text-muted-foreground ml-2"> — {item.materialName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {item.quantity} {item.unit}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveItem(item.materialId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new rows */}
      <div className="rounded-lg border bg-muted/20">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Add materials</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={addNewRow}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add row
          </Button>
        </div>

        {newRows.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{"No added materials. Click \"Add row\" to start."}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {newRows.map((row, index) => (
              <div key={index} className="flex items-center gap-3">
                {/* Material select */}
                <div className="flex-1">
                  <select
                    value={row.materialId}
                    onChange={(e) => updateNewRow(index, 'materialId', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Select material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.sku} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="w-24">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={row.quantity}
                    onChange={(e) => updateNewRow(index, 'quantity', e.target.value)}
                    className="h-9 w-full p-2 text-sm"
                    placeholder="Qty"
                  />
                </div>

                {/* Unit */}
                <div className="w-20">
                  <select
                    value={row.unit}
                    onChange={(e) => updateNewRow(index, 'unit', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {DEFAULT_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => removeNewRow(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove row</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || newRows.length === 0}
          className="flex-1"
        >
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Package className="mr-2 h-4 w-4" />
              Save BOM
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
