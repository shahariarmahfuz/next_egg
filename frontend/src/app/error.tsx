"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Something Went Wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unhandled runtime exception occurred. Our error boundary intercepted the error to prevent application crash.
          </p>
          {error.digest && (
            <p className="text-xs bg-muted p-2 rounded text-muted-foreground">
              Error Digest: {error.digest}
            </p>
          )}
        </div>
        <div className="flex space-x-4 pt-4">
          <Button onClick={() => reset()} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <a href="/">
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
