import * as React from 'react';
import { cn } from '@/lib/utils';

type AlertVariant = 'default' | 'danger' | 'warning' | 'success';

interface AlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<AlertVariant, string> = {
  default: 'border-border bg-muted/30 text-foreground',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

export function Alert({ variant = 'default', children, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border p-3 text-sm',
        variants[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
