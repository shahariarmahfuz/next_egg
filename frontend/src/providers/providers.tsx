"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./auth-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";
import { SettingsProvider } from "./settings-provider";
import { PrintProvider } from "./print-provider";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryProvider>
        <AuthProvider>
          <SettingsProvider>
            <PrintProvider>
              {children}
              <Toaster />
            </PrintProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
