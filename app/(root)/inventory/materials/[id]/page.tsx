'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Clock, TrendingUp, AlertTriangle, Plus, History, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';

interface Material {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  minStock: number;
  currentStock: number;
  reservedQty: number;
  createdAt: string;
  updatedAt: string;
}

export default function MaterialDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [material, setMaterial] = React.useState<Material | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchMaterial();
  }, []);

  async function fetchMaterial() {
    if (!params.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/materials/${params.id}`);
      if (res.status === 404) setMaterial(null);
      else if (res.ok) setMaterial(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  const available = material ? material.currentStock - material.reservedQty : 0;
  const atpLabel = material && material.minStock > 0
    ? (available <= material.minStock ? 'Below reorder point' : 'Above reorder point')
    : 'No reorder point set';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : !material ? (
        <div className="mx-auto max-w-4xl space-y-4">
          <PageHeader title="Material not found" description="This material does not exist or you do not have access." />
          <Button onClick={() => router.push('/inventory/materials')}>Back to materials</Button>
        </div>
      ) : (
        <>
          <PageHeader
            title={material.name}
            description={material.description ?? `${material.sku} · ${material.unit}`}
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <a href={`/inventory/materials/${material.id}/edit`}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </a>
                </Button>
                <Button asChild>
                  <a href={`/inventory/materials/${material.id}/reserve`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Reserve
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={`/inventory/materials/${material.id}/history`}>
                    <History className="mr-2 h-4 w-4" />
                    History
                  </a>
                </Button>
              </div>
            }
          />

          {/* Stock level cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">On hand</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">{material.currentStock}</span>
                  <span className="text-sm text-muted-foreground">{material.unit}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Reserved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{material.reservedQty}</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    committed
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Available to promise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-semibold tabular-nums ${available <= 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {available}
                  </span>
                  <span className="text-sm text-muted-foreground">{material.unit}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{atpLabel}</p>
              </CardContent>
            </Card>
          </div>

          {/* Reorder point + status */}
          <Card>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reorder point</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {material.minStock > 0 ? `${material.minStock} ${material.unit}` : 'Not set'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {available <= 0 && material.currentStock <= 0 ? (
                  <StatusBadge variant="danger">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Out of stock
                  </StatusBadge>
                ) : available <= material.minStock && material.minStock > 0 ? (
                  <StatusBadge variant="warning">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    Below reorder
                  </StatusBadge>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <a href={`/inventory/materials/${material.id}/history`}>
                    <History className="mr-1 h-3 w-3" />
                    Ledger
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/inventory/materials/${material.id}/reserve`}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Reserve stock
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/inventory/materials/${material.id}/history`}>
                <History className="mr-1 h-3 w-3" />
                View history
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
