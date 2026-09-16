import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  description?: string;
  trend?: { direction: 'up' | 'down' | 'neutral' | 'warning'; value: string };
  icon?: React.ReactNode;
  className?: string;
}

export function StatTile({ label, value, description, trend, icon, className }: StatTileProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend.direction === 'up' && (
            <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {trend.direction === 'down' && (
            <svg className="h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span className={cn(
            trend.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
            trend.direction === 'down' ? 'text-red-600 dark:text-red-400' :
            'text-muted-foreground',
            'font-medium',
          )}>
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
