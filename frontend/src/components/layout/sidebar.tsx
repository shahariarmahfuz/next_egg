"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  PackagePlus,
  PackageSearch,
  Truck,
  UserPlus,
  Users,
  UserCheck,
  ShieldCheck,
  Layers,
  Settings,
  Shield,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  AlertCircle,
  BarChart3,
  Plus,
  Wallet,
  Receipt,
  PlusCircle,
  RotateCcw,
  Undo2,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { useSettingsStore } from "@/store/settings";

export function SidebarContent({
  onNavigate,
  collapsed = false,
  setCollapsed,
  isMobile = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  isMobile?: boolean;
}) {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuth();

  // Accordion state: default null (all expandable groups collapsed by default on load)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroup((prev) => (prev === groupKey ? null : groupKey));
  };

  const isGroupOpen = (groupKey: string) => {
    return expandedGroup === groupKey;
  };

  const isSalesActive = pathname.startsWith("/sales") && !pathname.startsWith("/sale-returns");
  const isSaleReturnActive = pathname.startsWith("/sale-returns");
  const isCustomerActive = pathname.startsWith("/customers");
  const isCollectionActive = pathname.startsWith("/collections");

  const isPurchaseActive = pathname.startsWith("/purchases") && !pathname.startsWith("/product-returns");
  const isProductReturnActive = pathname.startsWith("/product-returns");
  const isProductActive = pathname.startsWith("/products");
  const isSupplierActive = pathname.startsWith("/suppliers") && !pathname.startsWith("/supplier-payments");
  const isSupplierPaymentActive = pathname.startsWith("/supplier-payments");
  const isExpenseActive = pathname.startsWith("/expenses");

  const { settings } = useSettingsStore();

  const brandName = settings.business_short_name || settings.business_name || "Enterprise Hub";
  const initial = brandName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
        {!collapsed && (
          <Link href="/" onClick={onNavigate} className="flex items-center space-x-2">
            {settings.business_logo ? (
              <img src={settings.business_logo} alt={brandName} className="h-8 w-8 rounded-lg object-contain bg-white shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-lg shadow-md shrink-0">
                {initial}
              </div>
            )}
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent truncate">
              {brandName}
            </span>
          </Link>
        )}
        {collapsed && (
          settings.business_logo ? (
            <img src={settings.business_logo} alt={brandName} className="mx-auto h-8 w-8 rounded-lg object-contain bg-white shrink-0" />
          ) : (
            <div className="mx-auto h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-lg shrink-0">
              {initial}
            </div>
          )
        )}
        {setCollapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto overscroll-contain py-4 px-3 space-y-1">
        {/* Dashboard Home */}
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
            pathname === "/"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          )}
          title={collapsed ? "Dashboard" : undefined}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {/* Filtered Dashboard (Owner/Admin Only) */}
        {(user?.role?.code === 'owner' || user?.role?.code === 'admin') && (
          <Link
            href="/dashboard/filtered"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
              pathname === "/dashboard/filtered"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            title={collapsed ? "Filtered Dashboard" : undefined}
          >
            <BarChart3 className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Filtered Dashboard</span>}
          </Link>
        )}

        {/* Centralized Reports Hub */}
        {(hasPermission("reports.view") || hasPermission("sales.report.view")) && (
          <Link
            href="/reports"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
              pathname.startsWith("/reports")
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            title={collapsed ? "Reports Center" : undefined}
          >
            <BarChart3 className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Reports Center</span>}
          </Link>
        )}

        {/* Sales Module Collapsible Group */}
        {hasPermission("sales.view") && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("sales")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isSalesActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Sales Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <ShoppingCart className="h-5 w-5 shrink-0 text-primary" />
                {!collapsed && <span>Sales</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("sales") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("sales") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("sales.create") && (
                  <Link
                    href="/sales/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/sales/new"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Sale</span>
                  </Link>
                )}

                <Link
                  href="/sales"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/sales"
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Manage Sale</span>
                </Link>

                {(hasPermission("sales.report.view") || hasPermission("sales.view")) && (
                  <Link
                    href="/sales/reports"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/sales/reports"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>Sale Report</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sales Return Module Collapsible Group */}
        {(hasPermission("sale_return.view") || hasPermission("sale_return.create")) && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("sale_returns")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isSaleReturnActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Sales Return Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <RotateCcw className="h-5 w-5 shrink-0 text-amber-500" />
                {!collapsed && <span>Sales Return</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("sale_returns") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("sale_returns") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("sale_return.create") && (
                  <Link
                    href="/sale-returns/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/sale-returns/new"
                        ? "bg-primary/15 text-amber-500 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Undo2 className="h-3.5 w-3.5 text-amber-500" />
                    <span>Add Sale Return</span>
                  </Link>
                )}

                {hasPermission("sale_return.view") && (
                  <Link
                    href="/sale-returns"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/sale-returns"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Manage Sale Return</span>
                  </Link>
                )}

                {(hasPermission("sale_return.report") || hasPermission("sale_return.view")) && (
                  <Link
                    href="/sale-returns/reports"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/sale-returns/reports"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>Sale Return Report</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Customer Module Collapsible Group */}
        {hasPermission("customer.view") && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("customers")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isCustomerActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Customers Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 shrink-0 text-primary" />
                {!collapsed && <span>Customers</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("customers") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("customers") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("customer.create") && (
                  <Link
                    href="/customers/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/customers/new"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Add Customer</span>
                  </Link>
                )}

                <Link
                  href="/customers"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/customers"
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Customer List / Manage</span>
                </Link>

                <Link
                  href="/customers/ledger"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/customers/ledger"
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  <span>Customer Ledger</span>
                </Link>

                {hasPermission("customer.due.view") && (
                  <Link
                    href="/customers/dues"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/customers/dues"
                        ? "bg-primary/15 text-amber-500 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span>Customer Due List</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Customer Collection Module Collapsible Group */}
        {(hasPermission("collection.view") || hasPermission("collection.create")) && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("collections")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isCollectionActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Customer Collection Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <Wallet className="h-5 w-5 shrink-0 text-emerald-500" />
                {!collapsed && <span>Customer Collection</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("collections") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("collections") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("collection.create") && (
                  <Link
                    href="/collections/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/collections/new"
                        ? "bg-primary/15 text-emerald-500 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Add Collection</span>
                  </Link>
                )}

                {hasPermission("collection.view") && (
                  <Link
                    href="/collections"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/collections"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Manage Collection</span>
                  </Link>
                )}

                {(hasPermission("collection.report") || hasPermission("collection.view")) && (
                  <Link
                    href="/collections/reports"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/collections/reports"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>Collection Report</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Purchase Module Collapsible Group */}
        {hasPermission("purchase.view") && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("purchases")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isPurchaseActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Purchase Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <ShoppingBag className="h-5 w-5 shrink-0 text-primary" />
                {!collapsed && <span>Purchase</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("purchases") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("purchases") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("purchase.create") && (
                  <Link
                    href="/purchases/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/purchases/new"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Purchase</span>
                  </Link>
                )}

                <Link
                  href="/purchases"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/purchases"
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Manage Purchase</span>
                </Link>

                {hasPermission("purchase.report") && (
                  <Link
                    href="/purchases/reports"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/purchases/reports"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Purchase Report</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Product Return Module Collapsible Group */}
        {(hasPermission("product_return.view") || hasPermission("product_return.create")) && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("product_returns")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isProductReturnActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Product Return Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <RotateCcw className="h-5 w-5 shrink-0 text-blue-500" />
                {!collapsed && <span>Product Return</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("product_returns") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("product_returns") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("product_return.create") && (
                  <Link
                    href="/product-returns/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/product-returns/new"
                        ? "bg-primary/15 text-blue-500 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Undo2 className="h-3.5 w-3.5 text-blue-500" />
                    <span>Add Product Return</span>
                  </Link>
                )}

                {hasPermission("product_return.view") && (
                  <Link
                    href="/product-returns"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/product-returns"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Manage Product Return</span>
                  </Link>
                )}

                {(hasPermission("product_return.report") || hasPermission("product_return.view")) && (
                  <Link
                    href="/product-returns/reports"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/product-returns/reports"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>Product Return Report</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Supplier Module Collapsible Group */}
        {hasPermission("supplier.view") && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("suppliers")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isSupplierActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Suppliers Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <Truck className="h-5 w-5 shrink-0 text-primary" />
                {!collapsed && <span>Suppliers</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("suppliers") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("suppliers") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("supplier.create") && (
                  <Link
                    href="/suppliers/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/suppliers/new"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Add Supplier</span>
                  </Link>
                )}

                <Link
                  href="/suppliers"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/suppliers"
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Supplier List / Manage</span>
                </Link>

                <Link
                  href="/suppliers/dues"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/suppliers/dues"
                      ? "bg-primary/15 text-amber-500 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Supplier Due List</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Supplier Payment Module Collapsible Group */}
        {(hasPermission("supplier_payment.view") || hasPermission("supplier_payment.create")) && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("supplier_payments")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isSupplierPaymentActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Supplier Payment Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <Receipt className="h-5 w-5 shrink-0 text-emerald-500" />
                {!collapsed && <span>Supplier Payment</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("supplier_payments") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("supplier_payments") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("supplier_payment.create") && (
                  <Link
                    href="/supplier-payments/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/supplier-payments/new"
                        ? "bg-primary/15 text-emerald-500 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Add Supplier Payment</span>
                  </Link>
                )}

                {hasPermission("supplier_payment.view") && (
                  <Link
                    href="/supplier-payments"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/supplier-payments"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Manage Supplier Payment</span>
                  </Link>
                )}

                {(hasPermission("supplier_payment.report") || hasPermission("supplier_payment.view")) && (
                  <Link
                    href="/supplier-payments/reports"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/supplier-payments/reports"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>Supplier Payment Report</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Expenses Module Collapsible Group */}
        {(hasPermission("expense.view") || hasPermission("expense.category.view")) && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("expenses")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isExpenseActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Expenses Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <Receipt className="h-5 w-5 shrink-0 text-rose-500" />
                {!collapsed && <span>Expenses</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("expenses") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("expenses") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {(hasPermission("expense.category.view") || hasPermission("expense.view")) && (
                  <Link
                    href="/expenses/categories"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/expenses/categories"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Expense Categories</span>
                  </Link>
                )}

                {hasPermission("expense.create") && (
                  <Link
                    href="/expenses/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/expenses/new"
                        ? "bg-primary/15 text-rose-500 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5 text-rose-500" />
                    <span>Add Expense</span>
                  </Link>
                )}

                {hasPermission("expense.view") && (
                  <Link
                    href="/expenses"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/expenses"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Manage Expenses</span>
                  </Link>
                )}

                {(hasPermission("expense.report.view") || hasPermission("expense.view")) && (
                  <Link
                    href="/expenses/reports"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/expenses/reports"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>Expense Report</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Product Module Collapsible Group */}
        {hasPermission("product.view") && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("products")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                isProductActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "Product Module" : undefined}
            >
              <div className="flex items-center space-x-3">
                <Package className="h-5 w-5 shrink-0 text-primary" />
                {!collapsed && <span>Product</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("products") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("products") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("product.create") && (
                  <Link
                    href="/products/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/products/new"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    <span>Add Product</span>
                  </Link>
                )}

                <Link
                  href="/products"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/products"
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <PackageSearch className="h-3.5 w-3.5" />
                  <span>Product List / Manage</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* User Management Collapsible Group */}
        {hasPermission("user.view") && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup("users")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                pathname.startsWith("/users")
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title={collapsed ? "User Management" : undefined}
            >
              <div className="flex items-center space-x-3">
                <UserCheck className="h-5 w-5 shrink-0 text-primary" />
                {!collapsed && <span>User Management</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen("users") ? "rotate-180" : "")}
                />
              )}
            </button>

            {isGroupOpen("users") && !collapsed && (
              <div className="pl-9 space-y-1 animate-in fade-in-50">
                {hasPermission("user.create") && (
                  <Link
                    href="/users/new"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      pathname === "/users/new"
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                    <span>Add User</span>
                  </Link>
                )}

                <Link
                  href="/users"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    pathname === "/users"
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Manage Users</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Roles & Permissions */}
        {hasPermission("role.view") && (
          <Link
            href="/roles"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
              pathname === "/roles"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            title={collapsed ? "Roles & Permissions" : undefined}
          >
            <ShieldCheck className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Roles & Permissions</span>}
          </Link>
        )}

        {/* System Architecture */}
        {user?.role?.code === 'owner' && (
          <Link
            href="/architecture"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
              pathname === "/architecture"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            title={collapsed ? "System Architecture" : undefined}
          >
            <Layers className="h-5 w-5 shrink-0" />
            {!collapsed && <span>System Architecture</span>}
            {!collapsed && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">Foundation</Badge>}
          </Link>
        )}

        {/* API Status */}
        {user?.role?.code === 'owner' && (
          <Link
            href="/system-status"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
              pathname === "/system-status"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            title={collapsed ? "API Status" : undefined}
          >
            <Activity className="h-5 w-5 shrink-0" />
            {!collapsed && <span>API Status</span>}
          </Link>
        )}

        {/* Security & Auth */}
        {hasPermission("security.view") && (
          <Link
            href="/security"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
              pathname === "/security"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            title={collapsed ? "Security & Auth" : undefined}
          >
            <Shield className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Security & Auth</span>}
          </Link>
        )}

        {/* System Settings */}
        {hasPermission("settings.view") && (
          <Link
            href="/settings"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
              pathname === "/settings"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            title={collapsed ? "System Settings" : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && <span>System Settings</span>}
          </Link>
        )}
      </div>

      {/* Footer User & Logout */}
      {!collapsed && user && (
        <div className="p-3 border-t m-3 rounded-xl bg-accent/40 text-xs flex items-center justify-between shrink-0">
          <div className="flex flex-col truncate pr-2">
            <span className="font-semibold text-foreground truncate">{user.full_name}</span>
            <span className="text-muted-foreground capitalize text-[10px]">{user.role?.name || "User"}</span>
          </div>
          <button
            onClick={() => {
              onNavigate?.();
              logout();
            }}
            title="Sign Out"
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 relative z-30 h-screen sticky top-0 text-card-foreground",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
    </aside>
  );
}
