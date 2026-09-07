'use client';

import { useSession } from '@/components/session-provider';
import { canRole } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import type { Role } from '@/server/rabc/roles';

type RoleGateProps = {
  /** One or more roles that are allowed to see the children. */
  roles: Role[];
  /** The action being gated. If the user's role can perform this action,
   * children render. */
  action?: Action;
  /** Fallback when the user is not authorized. Defaults to null. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * RoleGate renders its children only when the current user holds one of
 * the given roles for the (optional) action. Use it to hide nav items,
 * buttons, and sections that the current role may not access.
 *
 *   <RoleGate roles={[Role.OWNER]}>
 *     <ManageUsersButton />
 *   </RoleGate>
 *
 *   <RoleGate action={Action.MANAGE_USERS}>
 *     <ManageUsersButton />
 *   </RoleGate>
 */
export function RoleGate({
  roles,
  action,
  fallback = null,
  children,
}: RoleGateProps) {
  const session = useSession();
  if (!session) return fallback;

  // Check by explicit role list first (UI gating — "show this to owners
  // and production managers"). If an action is given, also check the
  // permission matrix so the UI stays in sync with the backend.
  const hasRole = roles.some((r) =>
    session.roleBindings.some((b) => b.role === r),
  );
  if (!hasRole) return fallback;

  // If an action is specified, verify the role can actually perform it.
  // This keeps the UI consistent with can() on the server.
  if (action) {
    const allowed = session.roleBindings.some(
      (b) => canRole(b.role as Role, action),
    );
    if (!allowed) return fallback;
  }

  return <>{children}</>;
}

/** Convenience: gate on a single role. */
export function RoleGateOne({
  role,
  fallback = null,
  children,
}: {
  role: Role;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RoleGate roles={[role]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}
