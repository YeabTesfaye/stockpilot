'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/session-provider';
import { AuthForm } from '@/components/auth-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

  // Keep showing the form until the session resolves so the page doesn't
  // flash; an authenticated user will be redirected immediately.
  if (session === undefined) return null;

  return (
    // The form column is viewport-locked on desktop, so main owns the scroll
    // (m-auto centers the card when there is room and scrolls without clipping
    // when the form is taller than the viewport).
    <main className="bg-muted/40 flex flex-1 flex-col overflow-y-auto p-6">
      <Card className="m-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to StockPilot</CardTitle>
          <CardDescription>
            Welcome back — inventory intelligence for your shop floor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="login" />
          <p className="text-muted-foreground mt-6 text-center text-sm">
            No account?{' '}
            <Link href="/signup" className="text-primary font-medium underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
