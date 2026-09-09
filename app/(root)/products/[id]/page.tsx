'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package, Edit3, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { useRouter } from "next/navigation";

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
  currentBomVersion: number | null;
  bomItems: BomItem[];
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const fetchProduct = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${params.id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Product not found');
        throw new Error('Failed to load product');
      }
      const data: Product = await res.json();
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    if (!params.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProduct();
  }, [params.id, fetchProduct]);

  async function handleDelete() {
    if (!confirm('Delete this product? This will also remove its BOM.')) return;
    const res = await fetch(`/api/products/${params.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push("/products");
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

  if (error || !product) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error ?? 'Product not found'}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/products')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to products
          </Button>
          <Button variant="outline" onClick={fetchProduct}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const bomStatus = product.bomItems.length === 0
    ? 'out'
    : product.bomItems.length >= 2
      ? 'healthy'
      : 'low';

  const columns = [
    {
      accessor: 'materialSku',
      header: 'Material',
      cell: (item: BomItem) => (
        <div>
          <div className="font-medium">
            <code className="text-sm font-mono">{item.materialSku}</code>
          </div>
          <div className="text-xs text-muted-foreground">{item.materialName}</div>
        </div>
      ),
    },
    {
      accessor: 'quantity',
      header: 'Qty per unit',
      cell: (item: BomItem) => (
        <span className="text-sm text-muted-foreground">
          {item.quantity} {item.unit}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2"
              onClick={() => router.push('/products')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            <code className="font-mono">{product.sku}</code>
            {product.description ? ` — ${product.description}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {product.currentBomVersion !== null && (
            <>
              <span className="text-xs text-muted-foreground">BOM v{product.currentBomVersion}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/products/${params.id}/bom`)}
              >
                <History className="mr-1 h-3.5 w-3.5" />
                Edit BOM
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/products/${params.id}/max-buildable`)}
              >
                <Package className="mr-1 h-3.5 w-3.5" />
                Max buildable
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      {/* BOM status */}
      <div className="flex items-center gap-3">
        <StatusBadge variant={bomStatus}>
          {product.bomItems.length === 0
            ? 'No BOM'
            : product.bomItems.length === 1
              ? '1 material'
              : `${product.bomItems.length} materials`}
        </StatusBadge>
        {product.currentBomVersion !== null && (
          <span className="text-xs text-muted-foreground">
            Latest: v{product.currentBomVersion}
          </span>
        )}
      </div>

      {/* BOM items table */}
      {product.bomItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No materials in this BOM yet.</p>
          <Button variant="outline" className="mt-3" onClick={() => router.push(`/products/${params.id}/bom`)}>
            <Edit3 className="mr-2 h-4 w-4" />
            Define bill of materials
          </Button>
        </div>
      ) : (
        <DataTable
          key={`bom-${product.id}`}
          columns={columns}
          data={product.bomItems}
          keyField="id"
          emptyMessage="No materials"
        />
      )}

      {/* Metadata */}
      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="flex gap-6">
          <span>Created {new Date(product.createdAt).toLocaleDateString()}</span>
          <span>Updated {new Date(product.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}