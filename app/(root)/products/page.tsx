'use client';

import * as React from 'react';
import { Plus, Package } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, RowActions } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRouter } from 'next/navigation';

interface BomItem {
  id: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  quantity: number;
  unit: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  bomItems: BomItem[];
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [bomSheetOpen, setBomSheetOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [form, setForm] = React.useState({ name: '', sku: '', description: '' });
  const [bomForm, setBomForm] = React.useState({ materialId: '', quantity: 1, unit: 'pcs' });
  const [saving, setSaving] = React.useState(false);
  const [bomSaving, setBomSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [materials, setMaterials] = React.useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [bomLoading, setBomLoading] = React.useState(false);

  React.useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to load products');
      const data: Product[] = await res.json();
      setProducts(data);
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
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create product');
      }
      const created: Product = await res.json();
      setSheetOpen(false);
      setForm({ name: '', sku: '', description: '' });
      await fetchProducts();
      // Open BOM sheet for the new product
      setSelectedProduct(created);
      setBomSheetOpen(true);
      await fetchMaterialsForProduct(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function fetchMaterialsForProduct(productId: string) {
    setBomLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error('Failed to load product');
      const data: Product = await res.json();
      setSelectedProduct(data);
      // Load all materials for the BOM picker
      const matsRes = await fetch('/api/materials');
      if (matsRes.ok) {
        const mats: Array<{ id: string; name: string; sku: string }> = await matsRes.json();
        setMaterials(mats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBomLoading(false);
    }
  }

  async function handleAddBomItem() {
    if (!selectedProduct) return;
    setBomSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}/bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bomForm),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to add BOM item');
      }
      setBomForm({ materialId: '', quantity: 1, unit: 'pcs' });
      await fetchMaterialsForProduct(selectedProduct.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBomSaving(false);
    }
  }

  async function handleRemoveBomItem(materialId: string) {
    if (!selectedProduct) return;
    if (!confirm('Remove this material from the BOM?')) return;
    await fetch(`/api/products/${selectedProduct.id}/bom?materialId=${materialId}`, { method: 'DELETE' });
    await fetchMaterialsForProduct(selectedProduct.id);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? This will also remove its BOM.')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    await fetchProducts();
  }

  const bomComplete = (product: Product) => {
    if (product.bomItems.length === 0) return 'out';
    return product.bomItems.length >= 2 ? 'healthy' : 'low';
  };

  const columns: Array<{
    accessor: string;
    header: string;
    cell: (row: Product) => React.ReactNode;
  }> = [
    {
      accessor: 'sku',
      header: 'SKU',
      cell: (row) => <code className="text-sm font-mono">{row.sku}</code>,
    },
    {
      accessor: 'name',
      header: 'Name',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.description && <div className="text-xs text-muted-foreground mt-0.5">{row.description}</div>}
        </div>
      ),
    },
    {
      accessor: 'bomItems',
      header: 'BOM',
      cell: (row) => {
        const items = row.bomItems;
        if (items.length === 0) {
          return <span className="text-sm text-muted-foreground">No materials</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                <Package className="h-3 w-3 text-muted-foreground" />
                {item.materialSku}
                <span className="text-muted-foreground">×{item.quantity}</span>
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessor: 'bomItems',
      header: 'Status',
      cell: (row) => (
        <StatusBadge variant={bomComplete(row)}>
          {row.bomItems.length === 0 ? 'No BOM' : row.bomItems.length === 1 ? '1 material' : `${row.bomItems.length} materials`}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Products"
        description="Finished goods and their bills of materials."
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add product
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
          data={products}
          keyField="id"
          renderRowActions={(row) => (
            <RowActions
              onEdit={() => router.push(`/dashboard/products/${row.id}`)}
              onDelete={() => handleDelete(row.id)}
            />
          )}
          emptyMessage="No products yet. Add your first product and define its bill of materials."
        />
      )}

      {/* Create product sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Add product"
        description="Create a new product with a unique SKU. You'll define its BOM next."
        footer={
          <>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.sku}>
              {saving ? 'Creating...' : 'Create & add BOM'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Executive Chair"
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="p-sku">SKU</Label>
            <Input
              id="p-sku"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
              placeholder="e.g. CHAIR-001"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground mt-1">SKU must be unique within your tenant.</p>
          </div>
          <div>
            <Label htmlFor="p-description">Description (optional)</Label>
            <Input
              id="p-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the product"
              disabled={saving}
            />
          </div>
        </div>
      </Sheet>

      {/* BOM editor sheet */}
      <Sheet
        open={bomSheetOpen}
        onOpenChange={(open) => { setBomSheetOpen(open); if (!open) setSelectedProduct(null); }}
        title={selectedProduct ? `BOM — ${selectedProduct.sku}` : 'Bill of materials'}
        description="Add materials that go into this product. Each line lists a material and the quantity needed per unit."
        footer={
          <>
            <Button variant="outline" onClick={() => { setBomSheetOpen(false); setSelectedProduct(null); }}>
              Done
            </Button>
          </>
        }
      >
        {selectedProduct ? (
          <div className="flex flex-col gap-4">
            {/* Existing BOM items */}
            {bomLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-4 flex-1 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : selectedProduct.bomItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No materials in this BOM yet. Add one below.</p>
            ) : (
              <div className="space-y-2">
                {selectedProduct.bomItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{item.materialSku}</div>
                      <div className="text-xs text-muted-foreground">{item.materialName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{item.quantity} {item.unit}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleRemoveBomItem(item.materialId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-2 block">Add material</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="bom-material" className="text-xs">Material</Label>
                  <select
                    id="bom-material"
                    value={bomForm.materialId}
                    onChange={(e) => setBomForm((f) => ({ ...f, materialId: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={bomSaving}
                  >
                    <option value="">Select a material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.sku} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="bom-qty" className="text-xs">Qty</Label>
                  <Input
                    id="bom-qty"
                    type="number"
                    min={0.01}
                    step={0.1}
                    value={bomForm.quantity}
                    onChange={(e) => setBomForm((f) => ({ ...f, quantity: parseFloat(e.target.value) || 1 }))}
                    disabled={bomSaving}
                  />
                </div>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={handleAddBomItem}
                disabled={bomSaving || !bomForm.materialId}
              >
                {bomSaving ? 'Adding...' : 'Add material'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading product...</p>
        )}
      </Sheet>
    </div>
  );
}
