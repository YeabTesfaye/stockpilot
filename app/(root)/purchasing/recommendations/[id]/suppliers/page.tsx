'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Clock, DollarSign, Star } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';

type RankedSupplier = {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  leadTimeDays: number;
  score: number;
  rank: number;
};

export default function RankedSupplierListPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [rankings, setRankings] = React.useState<Record<string, RankedSupplier[]>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!params.id) return;
    const materialId = decodeURIComponent(params.id);
    fetchRankings(materialId);
  }, [params.id]);

  async function fetchRankings(materialId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/rank?materialIds=${encodeURIComponent(materialId)}`);
      if (!res.ok) throw new Error('Failed to load rankings');
      const data = await res.json();
      // Convert the rankings object to a simpler structure.
      const entries = Object.entries(data.rankings);
      if (entries.length > 0) {
        setRankings({ [materialId]: entries[1][1] as RankedSupplier[] });
      }
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const recommendationId = (() => {
    try {
      return decodeURIComponent(params.id);
    } catch {
      return '';
    }
  })();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => router.push('/purchasing/recommendations')}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Ranked suppliers</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Vias this is a placeholder page — connect to a recommendation.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-zinc-200 p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(rankings).map(([matId, suppliers]) => (
            <Card key={matId}>
              <CardHeader>
                <CardTitle className="text-base">Materials for this recommendation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suppliers.map((s) => (
                    <div
                      key={s.supplierId}
                      className={`rounded-md border p-4 ${
                        s.rank === 1
                          ? 'border-emerald-500/30 bg-emerald-50/30 dark:border-emerald-800/30 dark:bg-emerald-950/30'
                          : 'border-zinc-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            {s.rank === 1 && (
                              <BadgeCheck className="h-4 w-4 text-emerald-500" />
                            )}
                            <h3 className="font-medium">{s.supplierName}</h3>
                            {s.rank === 1 && (
                              <StatusBadge variant="healthy" className="text-xs">
                                Recommended
                              </StatusBadge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <DollarSign className="h-3.5 w-3.5" />
                              <span>${s.unitPrice.toFixed(2)} / unit</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{s.leadTimeDays} days lead time</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />
                              <span>Score: {s.score.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {s.rank > 1 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Alternative — rank #{s.rank}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {Object.keys(rankings).length === 0 && !loading && (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">No suppliers ranked for this material.</p>
        </div>
      )}
    </div>
  );
}
