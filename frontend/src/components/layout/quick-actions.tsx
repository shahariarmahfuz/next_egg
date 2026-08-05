"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Wallet,
  Receipt,
  ShoppingBag,
  UserPlus,
  Truck,
  PackagePlus,
  Zap,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickActionItem {
  id: string;
  label: string;
  href: string;
  icon: any;
  permission: string;
  colorClass: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: "sale",
    label: "Add Sale",
    href: "/sales/new",
    icon: ShoppingCart,
    permission: "sales.create",
    colorClass: "text-primary hover:bg-primary/10",
  },
  {
    id: "collection",
    label: "Add Customer Collection",
    href: "/collections/new",
    icon: Wallet,
    permission: "collection.create",
    colorClass: "text-emerald-500 hover:bg-emerald-500/10",
  },
  {
    id: "expense",
    label: "Add Expense",
    href: "/supplier-payments/new",
    icon: Receipt,
    permission: "supplier_payment.create",
    colorClass: "text-rose-500 hover:bg-rose-500/10",
  },
  {
    id: "purchase",
    label: "Add Purchase",
    href: "/purchases/new",
    icon: ShoppingBag,
    permission: "purchase.create",
    colorClass: "text-blue-500 hover:bg-blue-500/10",
  },
  {
    id: "customer",
    label: "Add Customer",
    href: "/customers/new",
    icon: UserPlus,
    permission: "customer.create",
    colorClass: "text-violet-500 hover:bg-violet-500/10",
  },
  {
    id: "supplier",
    label: "Add Supplier",
    href: "/suppliers/new",
    icon: Truck,
    permission: "supplier.create",
    colorClass: "text-amber-500 hover:bg-amber-500/10",
  },
  {
    id: "product",
    label: "Add Product",
    href: "/products/new",
    icon: PackagePlus,
    permission: "product.create",
    colorClass: "text-indigo-500 hover:bg-indigo-500/10",
  },
];

export function QuickActions() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const availableActions = QUICK_ACTIONS.filter((action) =>
    hasPermission(action.permission)
  );

  if (availableActions.length === 0) return null;

  const handleNavigate = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Desktop Quick Actions Icon Toolbar (lg and above): Always visible icon-only buttons with tooltips */}
      <div className="hidden lg:flex items-center space-x-1 border-l border-r border-border/50 px-2 my-auto">
        <TooltipProvider delayDuration={100}>
          {availableActions.map((action) => {
            const Icon = action.icon;
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleNavigate(action.href)}
                    className={`h-9 w-9 rounded-xl transition-all ${action.colorClass}`}
                    aria-label={action.label}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  <span>{action.label}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>

      {/* Mobile / Tablet Quick Actions Bottom Sheet (below lg) */}
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full"
              aria-label="Quick Actions"
            >
              <Zap className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
            <SheetHeader className="pb-3 border-b">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Quick Actions
              </SheetTitle>
            </SheetHeader>
            <div className="py-4 grid grid-cols-1 gap-2.5">
              {availableActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant="outline"
                    className="w-full justify-start h-12 text-sm font-medium gap-3 rounded-xl border-border/60 hover:bg-accent/60"
                    onClick={() => handleNavigate(action.href)}
                  >
                    <div className={`p-2 rounded-lg bg-accent/50 ${action.colorClass.split(" ")[0]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span>{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
