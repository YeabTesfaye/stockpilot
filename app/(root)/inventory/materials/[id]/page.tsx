'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package, History, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useRouter } from 'next/navigation';

interface MaterialStock {
  id: string;
  name: string;
  sku: string;
  unit: string;
  onHand: number;
  reserved: number;
  availableToPromise: number;
  minStock: number;
}

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [stock, setStock] = React.useState<MaterialStock | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!params.id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/materials/${params.id}`);
        if (!res.ok) throw new Error('Failed to load material');
        const data: MaterialStock = await res.json();
        setStock(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();
    return () => controller.abort();
  }, [params.id]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error ?? 'Material not found'}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/inventory/materials')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to materials
          </Button>
        </div>
      </div>
    );
  }

  const stockHealth = stock.onHand <= stock.minStock && stock.minStock > 0 ? 'low'
    : stock.onHand <= 0 ? 'out'
    : 'healthy';

  const columns: Column<MaterialStock>[] = [
    {
      accessor: 'metric',
      header: 'Metric',
      cell: (row) => <span className="font-medium text-sm">{row.name}</span>,
    },
    {
      accessor: 'sku',
      header: 'SKU',
      cell: (row) => <code className="text-sm font-mono text-muted-foreground">{row.sku}</code>,
    },
    {
      accessor: 'onHand',
      header: 'On hand',
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.onHand.toLocaleString()} <span className="text-muted-foreground">{row.unit}</span>
        </span>
      ),
    },
    {
      accessor: 'reserved',
      header: 'Reserved',
      cell: (row) => (
        <span className="text-sm tabular-nums text-amber-500">
          {row.reserved.toLocaleString()} <span className="text-muted-foreground">{row.unit}</span>
        </span>
      ),
    },
    {
      accessor: 'availableToPromise',
      header: 'Available',
      cell: (row) => (
        <span className={`text-sm tabular-nums font-medium ${row.availableToPromise <= 0 ? 'text-red-500' : ''}`}>
          {row.availableToPromise.toLocaleString()} <span className="text-muted-foreground">{row.unit}</span>
        </span>
      ),
    },
    {
      accessor: 'minStock',
      header: 'Min stock',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.minStock.toLocaleString()} {row.unit}</span>,
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
              onClick={() => router.push('/inventory/materials')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{stock.name}</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            <code className="font-mono">{stock.sku}</code>
            {' — '}{stock.unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/inventory/materials/${params.id}/history`)}
          >
            <History className="mr-1 h-3.5 w-3.5" />
            Movement history
          </Button>
        </div>
      </div>

      {/* Stock status */}
      <div className="flex items-center gap-3">
        <StatusBadge variant={stockHealth}>
          {stockHealth === 'out' ? 'Out of stock'
            : stockHealth === 'low' ? 'Low stock'
            : 'In stock'}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          Min: {stock.minStock} {stock.unit}
        </span>
      </div>

      {/* Stock levels table */}
      <DataTable
        key={`stock-${stock.id}`}
        columns={columns}
        data={[stock]}
        keyField="id"
        emptyMessage="No stock data"
      />

      {/* ATP summary */}
      <div className={`rounded-lg border p-4 text-sm ${stock.availableToPromise <= 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' : 'border-muted bg-muted/30'}`}>
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          <span className="font-medium">Available to promise:</span>
          <span className={`tabular-nums font-semibold ${stock.availableToPromise <= 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
            {stock.availableToPromise.toLocaleString()} {stock.unit}
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">
          On hand {stock.onHand.toLocaleString()} {stock.unit} − reserved {stock.reserved.toLocaleString()} {stock.unit}
        </p>
      </div>
    </div>
  );
}
