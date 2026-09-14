'use client';

import * as React from 'react';
import { Package, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';

type Recommendation = {
  id: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  recommendedQuantity: number;
  unit: string;
  suggestedSupplierId: string | null;
  suggestedSupplierName: string | null;
  estimatedCost: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  createdAt: string;
};

export default function PurchaseRecommendationsPage() {
  const [recommendations, setRecommendations] = React.useState<Recommendation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchRecommendations();
  }, []);

  async function fetchRecommendations() {
    setLoading(true);
    try {
      const res = await fetch('/api/purchasing/recommendations');
      if (!res.ok) throw new Error('Failed to load recommendations');
      const data = await res.json();
      setRecommendations(data.recommendations);
      setGeneratedAt(data.generatedAt);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const priorityVariant = (p: string) => {
    switch (p) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      default: return 'neutral';
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Purchase recommendations"
        description="Materials that need replenishment, ranked by priority. Generated from current stock levels and reorder points."
        actions={
          <Button onClick={fetchRecommendations}>
            <Package className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {generatedAt && (
        <p className="text-sm text-muted-foreground">
          Generated {timeAgo(generatedAt)}
        </p>
      )}

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
      ) : recommendations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No purchase recommendations.</p>
          <p className="text-xs text-muted-foreground mt-1">
            All materials are above their reorder points.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <Card key={rec.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <code className="text-sm font-mono">{rec.materialSku}</code>
                    <span className="text-muted-foreground">— {rec.materialName}</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                </div>
                <StatusBadge variant={priorityVariant(rec.priority)}>
                  {rec.priority}
                </StatusBadge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{rec.recommendedQuantity} {rec.unit}</span>
                  </div>
                  {rec.suggestedSupplierName && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{rec.suggestedSupplierName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>${rec.estimatedCost.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
