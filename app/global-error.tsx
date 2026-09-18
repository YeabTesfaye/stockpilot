'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // In production, send the error payload to the monitoring endpoint / log
    // pipeline here (e.g. fetch('/api/errors', { method: 'POST', body: ... })).
    console.error('GlobalError boundary caught:', error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col p-6">
      <Card className="m-auto w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Something went wrong
          </CardTitle>
          <CardDescription>
            StockPilot encountered an unexpected error. The incident has been
            logged. Please try again in a moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred.'}
            {error.digest ? (
              <span className="block mt-1 font-mono text-xs opacity-70">
                Incident id: {error.digest}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Try again
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard">Back to dashboard</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
