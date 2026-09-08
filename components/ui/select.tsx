'use client';

import * as React from 'react';
import { Select as SelectRoot, SelectTrigger, SelectValue, SelectIcon, SelectContent, SelectViewport, SelectItem, SelectItemIndicator, SelectItemText } from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps {
  options: Array<{ value: string; label: string }>;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SelectComponent({ options, value, onValueChange, placeholder, className }: SelectProps) {
  return (
    <SelectRoot value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)}>
        <SelectValue placeholder={placeholder} className="truncate" />
        <SelectIcon>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectIcon>
      </SelectTrigger>
      <SelectContent className="z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-card p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 motion-reduce:transition-none">
        <SelectViewport className="p-1">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <SelectItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <Check className="h-4 w-4" />
              </SelectItemIndicator>
              <SelectItemText>{opt.label}</SelectItemText>
            </SelectItem>
          ))}
        </SelectViewport>
      </SelectContent>
    </SelectRoot>
  );
}
