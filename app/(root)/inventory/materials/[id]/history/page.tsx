'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package, Plus, Minus, RefreshCw, AlertTriangle, Truck, Scissors, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useRouter } from 'next/navigation';

// Movement type badge component — color-coded per the spec.
function MovementTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    PURCHASE: { label: 'Purchase', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: <Plus className="h-3 w-3" /> },
    RETURN: { label: 'Return', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: <RefreshCw className="h-3 w-3" /> },
    SALE: { label: 'Sale', className: 'bg-red-500/15 text-red-600 dark:text-red-400', icon: <Minus className="h-3 w-3" /> },
    DAMAGE: { label: 'Damage', className: 'bg-red-500/15 text-red-600 dark:text-red-400', icon: <AlertTriangle className="h-3 w-3" /> },
    TRANSFER: { label: 'Transfer', className: 'bg-muted text-muted-foreground', icon: <Truck className="h-3 w-3" /> },
    ADJUSTMENT: { label: 'Adjust', className: 'bg-muted text-muted-foreground', icon: <Scale className="h-3 w-3" /> },
    RESERVATION: { label: 'Reserve', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', icon: <Scissors className="h-3 w-3" /> },
    RESERVATION_RELEASE: { label: 'Release', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: <RefreshCw className="h-3 w-3" /> },
  };
  const cfg = config[type] ?? { label: type, className: 'bg-muted text-muted-foreground', icon: <RefreshCw className="h-3 w-3" /> };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

interface MovementRow {
  id: string;
  materialName: string;
  materialSku: string;
  warehouseName: string | null;
  type: string;
  quantity: number;
  reference: string | null;
  referenceId: string | null;
  createdAt: string;
}

export default function MaterialHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [movements, setMovements] = React.useState<MovementRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [materialName, setMaterialName] = React.useState<string | null>(null);
  const [materialSku, setMaterialSku] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!params.id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/materials/${params.id}/history`);
        if (!res.ok) throw new Error('Failed to load movement history');
        const data = await res.json();
        setMovements(data.movements);
        setMaterialName(data.materialName);
        setMaterialSku(data.materialSku);
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

  if (error || !materialName) {
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

  const columns: Column<MovementRow>[] = [
    {
      accessor: 'createdAt',
      header: 'Date',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      accessor: 'type',
      header: 'Type',
      cell: (row) => <MovementTypeBadge type={row.type} />,
    },
    {
      accessor: 'quantity',
      header: 'Qty',
      cell: (row) => (
        <span className={`text-sm tabular-nums font-medium ${row.quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {row.quantity > 0 ? '+' : ''}{row.quantity.toLocaleString()}
        </span>
      ),
    },
    {
      accessor: 'materialSku',
      header: 'Material',
      cell: (row) => (
        <div>
          <code className="text-sm font-mono">{row.materialSku}</code>
          <div className="text-xs text-muted-foreground">{row.materialName}</div>
        </div>
      ),
    },
    {
      accessor: 'warehouseName',
      header: 'Warehouse',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.warehouseName ?? '—'}
        </span>
      ),
    },
    {
      accessor: 'reference',
      header: 'Reference',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.reference ?? '—'}
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
              onClick={() => router.push(`/inventory/materials/${params.id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Movement history</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            <code className="font-mono">{materialSku}</code>
            {' — '}{materialName}
          </p>
        </div>
      </div>

      {movements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No movements recorded for this material yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Stock movements are created when materials are purchased, sold, returned, damaged, transferred, or adjusted.
          </p>
        </div>
      ) : (
        <DataTable
          key={`ledger-${params.id}`}
          columns={columns}
          data={movements}
          keyField="id"
          emptyMessage="No movements match the current filters."
        />
      )}
    </div>
  );
}
