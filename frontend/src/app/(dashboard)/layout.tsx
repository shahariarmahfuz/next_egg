import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
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
