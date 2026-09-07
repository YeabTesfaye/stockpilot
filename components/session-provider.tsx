'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export type SessionUser = {
  user: { id: string; name: string; email: string };
  memberships: Array<{
    id: string;
    role: string;
    tenant: { id: string; name: string };
  }>;
  roleBindings: readonly { role: string; tenantId: string }[];
};

type SessionContextValue = {
  session: SessionUser | null;
  loading: boolean;
  refresh: () => void;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  refresh: () => {},
});

function sessionEqual(a: SessionUser | null, b: SessionUser | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.user.id === b.user.id &&
    a.user.name === b.user.name &&
    a.user.email === b.user.email &&
    a.memberships.length === b.memberships.length &&
    a.roleBindings.length === b.roleBindings.length
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const refresh = useCallback(() => {
    // Cancel any in-flight request before starting a new one.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    fetch('/api/auth/me', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('not authenticated');
        return res.json();
      })
      .then((data: SessionUser) => {
        // Avoid a re-render when the session hasn't actually changed.
        if (!sessionEqual(sessionRef.current, data)) {
          setSession(data);
        }
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') {
          setSession(null);
        }
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setLoading(false);
      });
  }, []);

  // Fetch once on mount; clean up the in-flight request on unmount.
  useEffect(() => {
    refresh();
    return () => {
      controllerRef.current?.abort();
    };
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx.session;
}
