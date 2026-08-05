"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isLoading) {
      const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth_token");
      if (!isAuthenticated || !hasToken) {
        router.replace("/login");
      }
    }
  }, [isClient, isLoading, isAuthenticated, router]);

  // 1. Render full-screen spinner while checking auth status (NO sidebar, NO navbar, NO page flash)
  if (!isClient || isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  // 2. Render NOTHING if not authenticated (prevents any rendering of dashboard elements)
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth_token");
  if (!isAuthenticated || !hasToken) {
    return null;
  }

  // 3. Render Dashboard Layout only when fully authenticated
  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-full w-full mx-auto animate-in fade-in-50 duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
