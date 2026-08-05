"use client";

import { Breadcrumbs } from "./breadcrumbs";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserNav } from "./user-nav";
import { QuickActions } from "./quick-actions";
import { Server } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card/80 dark:bg-card/70 px-4 md:px-6 backdrop-blur-md text-card-foreground">
      <div className="flex items-center space-x-3 min-w-0">
        <MobileNav />
        <div className="hidden sm:block min-w-0">
          <Breadcrumbs />
        </div>
      </div>

      <div className="flex items-center space-x-3 shrink-0">
        {/* Backend health status indicator - large desktop only */}
        <div className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium">
          <Server className="h-3.5 w-3.5" />
          <span>API Online</span>
        </div>

        {/* Quick Action Icons (Desktop Icon Toolbar / Mobile Bottom Sheet Trigger) */}
        <QuickActions />

        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  );
}
