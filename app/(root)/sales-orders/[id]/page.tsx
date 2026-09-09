'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';

interface RequirementRow {
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: number;
  materialId: string;
  materialName: string;
  materialSku: string;
  quantityPerUnit: number;
  totalRequired: number;
  available: number;
  shortage: number;
  unit: string;
}

export default function SalesOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [requirements, setRequirements] = React.useState<RequirementRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!params.id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/sales-orders/${params.id}/requirements`);
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? 'Failed to load requirements');
        }
        const data = await res.json();
        setRequirements(data.requirements);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();
    return () => controller.abort();
  }, [params.id]);

  const hasShortages = requirements.some(r => r.shortage > 0);
  const totalShortage = requirements.reduce((sum, r) => sum + r.shortage, 0);

  const columns: Column<RequirementRow>[] = [
    {
      accessor: 'productSku',
      header: 'Product',
      cell: (row: RequirementRow) => (
        <div>
          <code className="text-sm font-mono">{row.productSku}</code>
          <div className="text-xs text-muted-foreground">{row.productName}</div>
        </div>
      ),
    },
    {
      accessor: 'materialSku',
      header: 'Material',
      cell: (row: RequirementRow) => (
        <div>
          <code className="text-sm font-mono">{row.materialSku}</code>
          <div className="text-xs text-muted-foreground">{row.materialName}</div>
        </div>
      ),
    },
    {
      accessor: 'quantityOrdered',
      header: 'Ordered',
      cell: (row: RequirementRow) => (
        <span className="text-sm tabular-nums">{row.quantityOrdered}</span>
      ),
    },
    {
      accessor: 'quantityPerUnit',
      header: 'Per unit',
      cell: (row: RequirementRow) => (
        <span className="text-sm text-muted-foreground">
          {row.quantityPerUnit} {row.unit}
        </span>
      ),
    },
    {
      accessor: 'totalRequired',
      header: 'Required',
      cell: (row: RequirementRow) => (
        <span className="text-sm tabular-nums">
          {row.totalRequired} {row.unit}
        </span>
      ),
    },
    {
      accessor: 'available',
      header: 'Available',
      cell: (row: RequirementRow) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.available} {row.unit}
        </span>
      ),
    },
    {
      accessor: 'shortage',
      header: 'Shortage',
      cell: (row: RequirementRow) => {
        if (row.shortage <= 0) {
          return (
            <StatusBadge variant="healthy">
              <CheckCircle className="mr-1 h-3 w-3" />
              OK
            </StatusBadge>
          );
        }
        return (
          <StatusBadge variant="danger">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {row.shortage} {row.unit}
          </StatusBadge>
        );
      },
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2"
              onClick={() => router.push('/sales-orders')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Material requirements</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Sales order <code className="font-mono">{params.id}</code>
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {hasShortages && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="mr-2 h-4 w-4" />
          <strong>{totalShortage} units short</strong> across {requirements.filter(r => r.shortage > 0).length} material lines.
          Review the shortage rows below before promising delivery.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No requirements to show.</p>
          <p className="text-xs text-muted-foreground mt-1">
            This order may not have line items, or the products may not have BOMs yet.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={requirements}
          keyField="materialId"
          emptyMessage="No requirements match the current filters."
        />
      )}
    </div>
  );
}
