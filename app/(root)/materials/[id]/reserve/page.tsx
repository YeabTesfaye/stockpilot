'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

export default function ReservePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [form, setForm] = React.useState({ quantity: '' });

  async function handleReserve() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/materials/${params.id}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(form.quantity) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Reservation failed');
      }
      setResult({ success: true, message: data.message ?? `Reserved ${form.quantity} units.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResult({ success: false, message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
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
            <h1 className="text-2xl font-semibold tracking-tight">Reserve stock</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Reserve stock against material <code className="font-mono">{params.id}</code>. Open this page in two tabs to demo the race.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertTriangle className="mr-2 h-4 w-4" />
          {error}
        </Alert>
      )}

      {result && (
        <Alert variant={result.success ? 'success' : 'danger'}>
          {result.success ? (
            <CheckCircle className="mr-2 h-4 w-4" />
          ) : (
            <AlertTriangle className="mr-2 h-4 w-4" />
          )}
          {result.message}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reserve units</CardTitle>
          <CardDescription>
            Enter a quantity to reserve against this material. If you open this page in two tabs and submit both at the same time, only one reservation will succeed — the other will be rejected with an insufficient-stock error. This is the live demo of the Day 12 concurrency test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 max-w-sm">
            <div>
              <Label htmlFor="reserve-qty">Quantity</Label>
              <Input
                id="reserve-qty"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm(f => ({ quantity: e.target.value }))}
                placeholder="e.g. 5"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleReserve} disabled={loading || !form.quantity}>
            {loading ? 'Reserving...' : 'Reserve'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
