'use client';

import * as React from 'react';
import {  Filter, Clock, Package, Building, Box, History, LogOut, Shield, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { SelectComponent } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  description: string | null;
  createdAt: string;
}

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All resource types' },
  { value: 'user', label: 'Users' },
  { value: 'material', label: 'Materials' },
  { value: 'product', label: 'Products' },
  { value: 'warehouse', label: 'Warehouses' },
  { value: 'bom', label: 'BOMs' },
  { value: 'stock_movement', label: 'Stock movements' },
  { value: 'session', label: 'Sessions' },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-emerald-500',
  UPDATE: 'text-blue-500',
  DELETE: 'text-red-500',
  RESTORE: 'text-amber-500',
  LOGIN: 'text-purple-500',
  LOGOUT: 'text-muted-foreground',
  PASSWORD_CHANGE: 'text-rose-500',
};

export default function AuditLogPage() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [resourceType, setResourceType] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const pageSize = 50;

  React.useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (resourceType) params.set('resourceType', resourceType);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        params.set('limit', String(pageSize));
        params.set('offset', String((page - 1) * pageSize));

        const res = await fetch(`/api/audit-log?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load audit log');
        const json = await res.json();
        setEntries(json.entries);
        setTotal(json.total);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('audit log fetch failed:', err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [resourceType, startDate, endDate, page]);

  function clearFilters() {
    setResourceType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  const hasFilters = resourceType || startDate || endDate;

  const columns = [
    {
      accessor: 'createdAt',
      header: 'When',
      cell: (entry: AuditEntry) => (
        <span className="flex items-center gap-1.5 text-sm">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {new Date(entry.createdAt).toLocaleString()}
          </span>
        </span>
      ),
    },
    {
      accessor: 'actorName',
      header: 'Actor',
      cell: (entry: AuditEntry) => (
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{entry.actorName}</span>
        </div>
      ),
    },
    {
      accessor: 'action',
      header: 'Action',
      cell: (entry: AuditEntry) => (
        <span className={cn('inline-flex items-center gap-1 text-sm font-medium', ACTION_COLORS[entry.action] ?? 'text-muted-foreground')}>
          {entry.action === 'CREATE' && <History className="h-3.5 w-3.5" />}
          {entry.action === 'UPDATE' && <ChevronDown className="h-3.5 w-3.5" />}
          {entry.action === 'DELETE' && <LogOut className="h-3.5 w-3.5" />}
          {entry.action === 'LOGIN' && <Shield className="h-3.5 w-3.5" />}
          {!['CREATE', 'UPDATE', 'DELETE', 'LOGIN'].includes(entry.action) && <History className="h-3.5 w-3.5" />}
          {entry.action}
        </span>
      ),
    },
    {
      accessor: 'resourceType',
      header: 'Resource',
      cell: (entry: AuditEntry) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          {entry.resourceType === 'material' && <Package className="h-3.5 w-3.5 text-muted-foreground" />}
          {entry.resourceType === 'product' && <Package className="h-3.5 w-3.5 text-muted-foreground" />}
          {entry.resourceType === 'warehouse' && <Building className="h-3.5 w-3.5 text-muted-foreground" />}
          {entry.resourceType === 'user' && <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
          {entry.resourceType === 'bom' && <Box className="h-3.5 w-3.5 text-muted-foreground" />}
          {entry.resourceType === 'stock_movement' && <History className="h-3.5 w-3.5 text-muted-foreground" />}
          {entry.resourceType === 'session' && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
          <code className="font-mono">{entry.resourceType}</code>
        </span>
      ),
    },
    {
      accessor: 'resourceId',
      header: 'Resource ID',
      cell: (entry: AuditEntry) => (
        <code className="text-xs font-mono text-muted-foreground break-all">{entry.resourceId}</code>
      ),
    },
    {
      accessor: 'description',
      header: 'Description',
      cell: (entry: AuditEntry) => (
        <span className="text-sm text-muted-foreground">
          {entry.description ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Audit log"
        description="Every change made in the platform, recorded for traceability."
        actions={
          <div className="flex items-center gap-2">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(hasFilters && 'bg-accent/50')}>
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  Filters
                  {hasFilters && <span className="ml-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-600">{1}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Filter by date range</h3>
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear all
                      </Button>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="filter-start" className="text-xs">From</Label>
                    <Input
                      id="filter-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="filter-end" className="text-xs">To</Label>
                    <Input
                      id="filter-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                      className="mt-1"
                    />
                  </div>

                  <div className="border-t pt-3">
                    <Label className="text-xs mb-2 block">Resource type</Label>
                    <SelectComponent
                      options={RESOURCE_TYPE_OPTIONS}
                      value={resourceType}
                      onValueChange={(v) => { setResourceType(v); setPage(1); }}
                      placeholder="All resource types"
                    />
                  </div>

                  {hasFilters && (
                    <Button variant="outline" className="w-full" onClick={() => setPopoverOpen(false)}>
                      Apply filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} entries</span>
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span>
          </div>
          <DataTable
            key={`audit-${resourceType}-${startDate}-${endDate}-${page}`}
            columns={columns}
            data={entries}
            keyField="id"
            emptyMessage="No entries match the current filters."
          />
          {total > page * pageSize && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
                Next page
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}