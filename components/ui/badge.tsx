import * as React from 'react';
import { cn } from '@/lib/utils';

function Badge({ className, variant = 'secondary', ...props }: React.ComponentProps<'span'> & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/80',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/80',
        variant === 'outline' && 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
