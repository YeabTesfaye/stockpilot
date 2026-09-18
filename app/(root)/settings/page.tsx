'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { User, Users, LogOut, Building, Shield } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface SessionUser {
  id: string;
  name: string;
  email: string;
}

interface Membership {
  id: string;
  tenant: { id: string; name: string };
  role: string;
}

interface Session {
  user: SessionUser;
  memberships: Membership[];
}

interface AdminUsersResponse {
  ok: boolean;
  roleThatWasChecked: string[];
  message: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = React.useState<Session | null>(null);
  const [adminPayload, setAdminPayload] = React.useState<AdminUsersResponse | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    fetchSession();
  }, []);

  async function fetchSession() {
    const token =
      typeof document !== 'undefined'
        ? (`; ${document.cookie}`).split('; stockpilot_session=').pop()?.split(';')[0]?.trim()
        : null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: token ? { cookie: `stockpilot_session=${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) setSession(await res.json());
    } catch {
      // leave session null
    } finally {
      setLoading(false);
    }
  }

  async function fetchAdminUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        cache: 'no-store',
      });
      if (res.ok) setAdminPayload(await res.json());
    } catch {
      // leave payload null
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setLoggingOut(false);
      router.push('/login');
      router.refresh();
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your account and team members."
        />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const primaryMembership = session?.memberships[0];
  const roleLabel = primaryMembership?.role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Unknown';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and team members for {primaryMembership?.tenant.name ?? 'your company'}."
        actions={
          <Button variant="outline" onClick={fetchAdminUsers} disabled={usersLoading}>
            <Users className="mr-2 h-4 w-4" />
            {usersLoading ? 'Loading members…' : 'Refresh team'}
          </Button>
        }
      />

      {/* My account */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>My account</CardTitle>
          </div>
          <CardDescription>
            Your login and role across the company you belong to.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name
            </div>
            <div className="text-sm font-medium">{session?.user.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </div>
            <div className="text-sm font-medium">{session?.user.email ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Company
            </div>
            <div className="text-sm font-medium flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              {primaryMembership?.tenant.name ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary">{roleLabel}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Team members</CardTitle>
          </div>
          <CardDescription>
            People who share access to {primaryMembership?.tenant.name ?? 'this company'}.
            Only owners can manage members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adminPayload ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">{adminPayload.message}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                roles checked: {adminPayload.roleThatWasChecked.join(', ')}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                In a future release this list is backed by a real tenant users
                table. The /api/admin/users endpoint already enforces the
                owner-only RBAC gate (Day 3 break task).
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="mb-2">Team member list is empty for now.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAdminUsers}
                disabled={usersLoading}
              >
                Load team info
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            Sign out
          </CardTitle>
          <CardDescription>
            End your session. You will need to sign in again to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
