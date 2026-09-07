'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { User, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/session-provider';
import { RoleGate } from '@/components/role-gate';
import { Role } from '@/server/rabc/roles';
import { Action } from '@/server/rabc/permissions';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const session = useSession();
  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <span className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <span className="truncate max-w-[120px] text-sm font-medium">
              {session.user.name}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
            {session.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">{session.user.name}</span>
            <span className="text-xs text-muted-foreground">{session.user.email}</span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="gap-2">
          <User className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2">
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>

        <RoleGate roles={[Role.OWNER]} action={Action.VIEW_AUDIT_LOG}>
          <DropdownMenuItem className="gap-2">
            <ShieldCheck className="size-4" />
            Audit log
          </DropdownMenuItem>
        </RoleGate>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
