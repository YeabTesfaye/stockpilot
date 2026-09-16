'use client';

import * as React from 'react';
import { TrendingUp, Calendar, Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectComponent } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';

type ForecastPoint = {
  date: string;
  projectedDemand: number;
  cumulativeDemand: number;
};

type ForecastResult = {
  materialId: string;
  materialName: string;
  materialSku: string;
  unit: string;
  historicalDays: number;
  averageDailyDemand: number;
  projection: ForecastPoint[];
  totalProjectedDemand: number;
  generatedAt: string;
  source: 'movements' | 'bom_demand' | 'none';
};

export default function ForecastPage() {
  const [forecasts, setForecasts] = React.useState<ForecastResult[]>([]);
  const [selectedMaterial, setSelectedMaterial] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [materialOptions, setMaterialOptions] = React.useState<Array<{ value: string; label: string }>>([]);

  React.useEffect(() => {
    fetchForecasts();
    fetchMaterials();
  }, []);

  async function fetchMaterials() {
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        setMaterialOptions(
          data.map((m: { id: string; sku: string; name: string }) => ({
            value: m.id,
            label: `${m.sku} — ${m.name}`,
          })),
        );
      }
    } catch { /* silent */ }
  }

  async function fetchForecasts() {
    setLoading(true);
    try {
      const url = selectedMaterial
        ? `/api/planning/forecast?materialId=${selectedMaterial}`
        : '/api/planning/forecast';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load forecast');
      const data = await res.json();
      if (selectedMaterial) {
        setForecasts([data.forecast]);
      } else {
        setForecasts(data.forecasts);
      }
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const selectedForecast = forecasts.find(f => f.materialId === selectedMaterial) ?? forecasts[0];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Demand forecast"
        description="7-day moving average projected forward for the next 7 days. Helps you anticipate material needs before shortages occur."
      />

      <div className="flex items-center gap-4">
        <SelectComponent
          options={materialOptions}
          value={selectedMaterial}
          onValueChange={(v) => { setSelectedMaterial(v); fetchForecasts(); }}
          placeholder="Select a material (or leave empty for all)"
          className="w-80"
        />
        <Button variant="outline" onClick={fetchForecasts}>
          <TrendingUp className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : forecasts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No materials to forecast.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add materials and create products with BOMs to see demand projections.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {forecasts.map((fc) => (
            <Card key={fc.materialId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <code className="text-sm font-mono">{fc.materialSku}</code>
                    <span className="text-muted-foreground">— {fc.materialName}</span>
                  </CardTitle>
                  <StatusBadge
                    variant={fc.source === 'none' ? 'neutral' : fc.averageDailyDemand > 0 ? 'healthy' : 'neutral'}
                  >
                    <Activity className="mr-1 h-3 w-3" />
                    {fc.averageDailyDemand.toFixed(1)} {fc.unit}/day avg
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fc.source === 'movements'
                    ? `Based on ${fc.historicalDays} days of movement history`
                    : fc.source === 'bom_demand'
                      ? `Estimated from ${fc.historicalDays} days of sales-order demand`
                      : 'No demand history — material is idle'}
                  {' | '}Generated {new Date(fc.generatedAt).toLocaleTimeString()}
                </p>
              </CardHeader>
              <CardContent>
                {fc.source === 'none' ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No demand history for this material.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fc.historicalDays === 0
                        ? 'No stock movements and no sales orders use this material in their BOM.'
                        : 'Demand is too low to project.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Mini bar chart using divs */}
                    <div className="flex items-end gap-1 h-24">
                      {fc.projection.map((p, i) => {
                        const maxVal = Math.max(...fc.projection.map(pp => pp.projectedDemand), 1);
                        const height = maxVal > 0 ? (p.projectedDemand / maxVal) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {p.projectedDemand.toFixed(0)}
                            </span>
                            <div
                              className="w-full rounded-t bg-primary/60 transition-all"
                              style={{ height: `${Math.max(height, 2)}%` }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(p.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                      <span>Next 7 days:</span>
                      <span>
                        <span className="font-medium text-foreground">{fc.totalProjectedDemand.toFixed(0)} {fc.unit}</span>
                        {' '}total projected demand
                      </span>
                    </div>
                  </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
