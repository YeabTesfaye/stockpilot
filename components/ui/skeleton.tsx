import * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className,
      )}
    />
  );
}

export function TableRowSkeleton() {
  return (
    <tr>
      <td className="p-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-16" />
      </td>
    </tr>
  );
}
