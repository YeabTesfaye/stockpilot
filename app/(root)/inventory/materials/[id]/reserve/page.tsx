'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface Material {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  reservedQty: number;
  minStock: number;
}

export default function ReservePage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [material, setMaterial] = React.useState<Material | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ quantity: '' });
  const [reserving, setReserving] = React.useState(false);
  const [result, setResult] = React.useState<{
    success: boolean;
    message: string;
    newReserved?: number;
  } | null>(null);

  React.useEffect(() => {
    fetchMaterial();
  }, []);

  async function fetchMaterial() {
    setLoading(true);
    try {
      const res = await fetch(`/api/materials/${params.id}`);
      if (res.ok) setMaterial(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function handleReserve() {
    if (!form.quantity) return;
    setReserving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/materials/${params.id}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(form.quantity) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, message: data.error ?? 'Reservation failed' });
      } else {
        setResult({
          success: true,
          message: `Reserved ${form.quantity} units. New reserved total: ${data.result.newReserved}.`,
          newReserved: data.result.newReserved,
        });
        setForm({ quantity: '' });
        await fetchMaterial();
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Unknown error' });
    }
    finally { setReserving(false); }
  }

  const available = material ? material.currentStock - material.reservedQty : 0;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -ml-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Reserve stock</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : !material ? (
        <p>Material not found.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Reserve against {material.name}</CardTitle>
              <CardDescription>
                Available to promise:{' '}
                <strong className={available <= 0 ? 'text-red-600 dark:text-red-400' : ''}>
                  {available} {material.unit}
                </strong>
                {material.minStock > 0
                  ? ` · reorder point: ${material.minStock}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label htmlFor="qty">
                  Quantity to reserve ({material.unit})
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  max={available}
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ quantity: e.target.value }))
                  }
                  placeholder={`1–${available}`}
                  disabled={reserving || available <= 0}
                />
                {available <= 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Nothing available to reserve — adjust stock first.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReserve}
                  disabled={reserving || !form.quantity || available <= 0}
                >
                  {reserving ? 'Reserving...' : 'Reserve'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={reserving}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Alert
              variant={result.success ? 'success' : 'danger'}
              className="flex items-center gap-2"
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {result.message}
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
