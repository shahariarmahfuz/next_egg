"use client";

import { useState, useCallback } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-foreground hover:bg-accent"
            aria-label="Open mobile menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="left"
          className="w-[280px] max-w-[calc(100vw-48px)] p-0 flex flex-col gap-0 border-r border-border bg-card text-card-foreground shadow-2xl z-50"
        >
          <SidebarContent key={open ? "open" : "closed"} isMobile={true} onNavigate={close} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
