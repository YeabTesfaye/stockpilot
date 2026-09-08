'use client';

import * as React from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Column<T> {
  accessor: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  renderRowActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  renderRowActions,
  emptyMessage = 'No records found.',
  className,
}: DataTableProps<T>) {
  const key = String(keyField);
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.accessor}
                  className={`text-left text-xs font-medium uppercase tracking-wider text-muted-foreground ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
              {renderRowActions && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (renderRowActions ? 1 : 0)}
                  className="h-24 text-center text-sm text-muted-foreground py-12"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={String((row as Record<string, unknown>)[key])} className="hover:bg-muted/30">
                  {columns.map((col) => (
                    <td key={col.accessor} className={col.className ?? ''}>
                      {col.cell(row)}
                    </td>
                  ))}
                  {renderRowActions && (
                    <td className="align-middle">
                      {renderRowActions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}

export function RowActions({ onEdit, onDelete, deleteLabel = 'Delete' }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <ChevronDown className="mr-1 h-3 w-3" />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
