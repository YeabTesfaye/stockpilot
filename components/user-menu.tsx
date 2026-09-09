'use client';

import { useState, useRef, useEffect } from 'react';
import {
  User,
  LogOut,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { RoleGate } from '@/components/role-gate';
import { Role } from '@/server/rabc/roles';
import { Action } from '@/server/rabc/permissions';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const rotuer = useRouter()

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the menu.
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;

      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  // Close when pressing Escape.
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!session) {
    return null;
  }

  const initials = session.user.name.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User className="size-4" />

        <span className="max-w-30 truncate">
          {session.user.name}
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 z-50 mb-1 w-56 overflow-visible rounded-lg border bg-card py-1 shadow-lg"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
              {initials}
            </div>

            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">
                {session.user.name}
              </span>

              <span className="truncate text-xs text-muted-foreground">
                {session.user.email}
              </span>
            </div>
          </div>

          <div className="border-t" />

          {/* Profile */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            role="menuitem"
          >
            <User className="size-4" />
            Profile
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            role="menuitem"
          >
            <Settings className="size-4" />
            Settings
          </button>

          {/* Audit log */}
          <RoleGate
            roles={[Role.OWNER]}
            action={Action.VIEW_AUDIT_LOG}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              role="menuitem"
            >
              <ShieldCheck className="size-4" />
              Audit log
            </button>
          </RoleGate>

          <div className="border-t" />

          {/* Sign out */}
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                });
              } finally {
                rotuer.push('/login');
              }
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive transition-colors hover:bg-muted"
            role="menuitem"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
