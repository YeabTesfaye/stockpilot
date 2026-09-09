import * as React from 'react';
import { cn } from '@/lib/utils';

type StatusVariant = 'healthy' | 'low' | 'out' | 'neutral' | 'warning' | 'danger';

interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<StatusVariant, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  low: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  out: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
