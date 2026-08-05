"use client";

import { AlertOctagon, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-6 bg-card border border-border p-8 rounded-2xl shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <AlertOctagon className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Critical Application Error</h1>
            <p className="text-sm text-muted-foreground">
              A fatal error occurred in the root layout context.
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
