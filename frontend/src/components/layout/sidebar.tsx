"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, createContext, useContext } from "react";
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
  Sprout,
  Landmark,
  ArrowUpRight,
  Banknote,
  FileText,
  ClipboardList,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { useSettingsStore } from "@/store/settings";

/* -------------------------------------------------------------------------
   Adaptive Menu Density Context (Compact, Normal, Comfortable)
   ------------------------------------------------------------------------- */

type MenuDensity = "compact" | "normal" | "comfortable";

const MenuDensityContext = createContext<MenuDensity>("compact");
const useMenuDensity = () => useContext(MenuDensityContext);

/* -------------------------------------------------------------------------
   Helper Components: Clean, Modern Sidebar Items Preserving Icon Colors
   ------------------------------------------------------------------------- */

interface NavItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  activeColorClass: string;
  label: string;
  isActive: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  badge?: React.ReactNode;
}

function NavItem({
  href,
  icon: Icon,
  iconColor,
  activeColorClass,
  label,
  isActive,
  collapsed = false,
  onNavigate,
  badge,
}: NavItemProps) {
  const density = useMenuDensity();

  const sizeClass = collapsed
    ? density === "comfortable"
      ? "h-11 w-11 mx-auto justify-center"
      : density === "normal"
      ? "h-[42px] w-[42px] mx-auto justify-center"
      : "h-[40px] w-[40px] mx-auto justify-center"
    : density === "comfortable"
    ? "h-[44px] px-3.5 gap-3.5 text-sm"
    : density === "normal"
    ? "h-[42px] px-3 gap-3 text-sm"
    : "h-[40px] px-3 gap-3 text-[13.5px]";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg font-medium transition-all duration-200 ease-out select-none",
        sizeClass,
        isActive
          ? cn(activeColorClass, "font-semibold shadow-xs")
          : "text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60"
      )}
    >
      {/* Active Left Accent Indicator */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-current transition-all duration-200 ease-out" />
      )}
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-hover:scale-[1.05] group-hover:translate-x-[0.5px] motion-reduce:transform-none",
          iconColor
        )}
      />
      {!collapsed && <span className="truncate transition-colors duration-150">{label}</span>}
      {!collapsed && badge && <span className="ml-auto">{badge}</span>}
    </Link>
  );
}

interface NavGroupProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  isOpen: boolean;
  isActive: boolean;
  onToggle: () => void;
  collapsed?: boolean;
  children: React.ReactNode;
}

function NavGroup({
  title,
  icon: Icon,
  iconColor,
  isOpen,
  isActive,
  onToggle,
  collapsed = false,
  children,
}: NavGroupProps) {
  const density = useMenuDensity();

  const buttonSizeClass = collapsed
    ? density === "comfortable"
      ? "h-11 w-11 mx-auto justify-center"
      : density === "normal"
      ? "h-[42px] w-[42px] mx-auto justify-center"
      : "h-[40px] w-[40px] mx-auto justify-center"
    : density === "comfortable"
    ? "h-[44px] px-3.5 gap-3.5 text-sm"
    : density === "normal"
    ? "h-[42px] px-3 gap-3 text-sm"
    : "h-[40px] px-3 gap-3 text-[13.5px]";

  const subContainerSpacing = "space-y-0.5 py-0.5";

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? title : undefined}
        className={cn(
          "w-full group flex items-center justify-between rounded-lg font-medium transition-all duration-200 ease-out select-none",
          buttonSizeClass,
          isActive
            ? "text-slate-900 dark:text-white font-semibold bg-slate-100/70 dark:bg-slate-800/50"
            : "text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60"
        )}
      >
        <div className={cn("flex items-center min-w-0", density === "comfortable" ? "gap-3.5" : "gap-3")}>
          <Icon
            className={cn(
              "h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-hover:scale-[1.05] group-hover:translate-x-[0.5px] motion-reduce:transform-none",
              iconColor
            )}
          />
          {!collapsed && <span className="truncate transition-colors duration-150">{title}</span>}
        </div>
        {!collapsed && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ease-out group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 motion-reduce:transform-none",
              isOpen && "rotate-180 text-slate-700 dark:text-slate-200"
            )}
          />
        )}
      </button>

      {/* Smooth CSS Grid Accordion Expansion & Collapse */}
      {!collapsed && (
        <div
          className={cn(
            "grid transition-all duration-200 ease-out motion-reduce:transition-none",
            isOpen
              ? "grid-rows-[1fr] opacity-100 my-0.5"
              : "grid-rows-[0fr] opacity-0 my-0 pointer-events-none"
          )}
        >
          <div className="overflow-hidden">
            <div className={cn("ml-4 pl-3.5 border-l border-slate-200 dark:border-slate-800", subContainerSpacing)}>
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SubNavItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  activeColorClass?: string;
  label: string;
  isActive: boolean;
  onNavigate?: () => void;
}

function SubNavItem({
  href,
  icon: Icon,
  iconColor,
  activeColorClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  label,
  isActive,
  onNavigate,
}: SubNavItemProps) {
  const density = useMenuDensity();

  const subItemSize =
    density === "comfortable"
      ? "h-9 px-3 gap-2.5 text-[13px]"
      : density === "normal"
      ? "h-[35px] px-2.5 gap-2.5 text-[13px]"
      : "h-[34px] px-2.5 gap-2.5 text-[13px]";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center rounded-md transition-all duration-150 ease-out select-none",
        subItemSize,
        isActive
          ? cn(activeColorClass, "font-semibold")
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/40 font-normal"
      )}
    >
      {/* Active Left Accent Indicator */}
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-current transition-all duration-150 ease-out" />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-[0.5px] motion-reduce:transform-none",
          iconColor
            ? iconColor
            : isActive
              ? "text-current"
              : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
        )}
      />
      <span className="truncate transition-colors duration-150">{label}</span>
    </Link>
  );
}

/* -------------------------------------------------------------------------
   Helper: Determine Active Accordion Group Based on Route Path
   ------------------------------------------------------------------------- */

function getActiveGroup(path: string): string | null {
  if (path.startsWith("/sales") && !path.startsWith("/sale-returns")) return "sales";
  if (path.startsWith("/sale-returns")) return "sale_returns";
  if (path.startsWith("/customers")) return "customers";
  if (path.startsWith("/collections")) return "collections";
  if (path.startsWith("/purchases") && !path.startsWith("/product-returns")) return "purchases";
  if (path.startsWith("/product-returns")) return "product_returns";
  if (path.startsWith("/suppliers") && !path.startsWith("/supplier-payments")) return "suppliers";
  if (path.startsWith("/supplier-payments")) return "supplier_payments";
  if (path.startsWith("/expenses")) return "expenses";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/farm")) return "farm";
  if (path.startsWith("/cash") || path === "/accounts/cash-book" || path === "/accounts/cash-out") return "cash";
  if (path === "/dashboard/filtered" || path.startsWith("/reports")) return "accounts";
  if (path.startsWith("/users")) return "users";
  return null;
}

/* -------------------------------------------------------------------------
   Sidebar Content
   ------------------------------------------------------------------------- */

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
  const { settings } = useSettingsStore();

  const brandName = settings.business_name || "Enterprise Hub";
  const initial = brandName.charAt(0).toUpperCase();

  // Accordion state: default open if current route belongs to a group
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => getActiveGroup(pathname));

  useEffect(() => {
    const group = getActiveGroup(pathname);
    if (group) {
      setExpandedGroup(group);
    }
  }, [pathname]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroup((prev) => (prev === groupKey ? null : groupKey));
  };

  const isGroupOpen = (groupKey: string) => expandedGroup === groupKey;

  // Active module checks for parent group styling
  const isSalesActive = pathname.startsWith("/sales") && !pathname.startsWith("/sale-returns");
  const isSaleReturnActive = pathname.startsWith("/sale-returns");
  const isCustomerActive = pathname.startsWith("/customers");
  const isCollectionActive = pathname.startsWith("/collections");
  const isPurchaseActive = pathname.startsWith("/purchases") && !pathname.startsWith("/product-returns");
  const isProductReturnActive = pathname.startsWith("/product-returns");
  const isSupplierActive = pathname.startsWith("/suppliers") && !pathname.startsWith("/supplier-payments");
  const isSupplierPaymentActive = pathname.startsWith("/supplier-payments");
  const isExpenseActive = pathname.startsWith("/expenses");
  const isProductActive = pathname.startsWith("/products");
  const isFarmActive = pathname.startsWith("/farm");

  const isCashBookActive = pathname === "/cash/cash-book" || pathname === "/accounts/cash-book";
  const isCashOutActive = pathname === "/cash/cash-out" || pathname === "/accounts/cash-out";
  const isCashOutManageActive = pathname === "/cash/cash-out/manage";
  const isCashActive = pathname.startsWith("/cash") || isCashBookActive || isCashOutActive || isCashOutManageActive;

  const isFilteredDashboardActive = pathname === "/dashboard/filtered";
  const isReportsCenterActive = pathname.startsWith("/reports");
  const isAccountsActive = isFilteredDashboardActive || isReportsCenterActive;

  const isUsersActive = pathname.startsWith("/users");

  // Semantic Active Color Classes
  const blueActive = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  const amberActive = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  const orangeActive = "bg-orange-500/10 text-orange-600 dark:text-orange-400";
  const emeraldActive = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  const roseActive = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  const indigoActive = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
  const purpleActive = "bg-purple-500/10 text-purple-600 dark:text-purple-400";
  const violetActive = "bg-violet-500/10 text-violet-600 dark:text-violet-400";
  const skyActive = "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  const tealActive = "bg-teal-500/10 text-teal-600 dark:text-teal-400";
  const cyanActive = "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
  const slateActive = "bg-slate-500/10 text-slate-700 dark:text-slate-300";

  // Permissions & Visibility Checks for Adaptive Density
  const showDashboard = hasPermission("dashboard.view");
  const showSales = hasPermission("sales.view");
  const showSaleReturn = hasPermission("sale_return.view") || hasPermission("sale_return.create");
  const showCustomers = hasPermission("customer.view");
  const showCollections = hasPermission("collection.view") || hasPermission("collection.create");
  const showPurchases = hasPermission("purchase.view");
  const showProductReturn = hasPermission("product_return.view") || hasPermission("product_return.create");
  const showSuppliers = hasPermission("supplier.view");
  const showSupplierPayments = hasPermission("supplier_payment.view") || hasPermission("supplier_payment.create");
  const showExpenses = hasPermission("expense.view") || hasPermission("expense.category.view");
  const showProducts = hasPermission("product.view");
  const showFarm = hasPermission([
    "farm.view",
    "farm.create",
    "farm.edit",
    "farm.delete",
    "farm.production.view",
    "farm.production.create",
    "farm.production.edit",
    "farm.production.delete",
    "farm.delivery.view",
    "farm.delivery.create",
    "farm.delivery.edit",
    "farm.delivery.delete",
    "farm.report",
  ]);
  const showCash = hasPermission([
    "accounts.cash_book.view",
    "cash_out.view",
    "accounts.cash_out.view",
    "reports.view",
  ]);
  const showAccounts = hasPermission(["dashboard.filtered.view", "reports.view"]);
  const showUsers = hasPermission("user.view");
  const showRoles = hasPermission("role.view");
  const showArchitecture = user?.role?.code === "owner";
  const showApiStatus = user?.role?.code === "owner";
  const showSecurity = hasPermission("security.view");
  const showSettings = hasPermission("settings.view");

  const visibleItemCount = [
    showDashboard,
    showSales,
    showSaleReturn,
    showCustomers,
    showCollections,
    showPurchases,
    showProductReturn,
    showSuppliers,
    showSupplierPayments,
    showExpenses,
    showProducts,
    showFarm,
    showCash,
    showAccounts,
    showUsers,
    showRoles,
    showArchitecture,
    showApiStatus,
    showSecurity,
    showSettings,
  ].filter(Boolean).length;

  // Adaptive Menu Density:
  // 10+ visible items -> compact density
  // 6-9 visible items -> normal density
  // 1-5 visible items -> comfortable density
  const density: MenuDensity =
    visibleItemCount >= 10
      ? "compact"
      : visibleItemCount >= 6
      ? "normal"
      : "comfortable";

  const containerSpacing = collapsed
    ? density === "comfortable"
      ? "py-3 px-2 space-y-1"
      : "py-2.5 px-2 space-y-0.5"
    : density === "comfortable"
    ? "py-3.5 px-3 space-y-1"
    : "py-2.5 px-3 space-y-0.5";

  return (
    <div className="flex flex-col h-full w-full bg-card text-card-foreground">
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-border/70 shrink-0">
        {!collapsed ? (
          <Link
            href="/"
            onClick={onNavigate}
            className="group/brand flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-95"
          >
            {settings.business_logo ? (
              <img
                src={settings.business_logo}
                alt={brandName}
                className="h-8 w-8 rounded-lg object-contain bg-white shrink-0 border border-border/50 transition-transform duration-200 ease-out group-hover/brand:scale-105 motion-reduce:transform-none"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center font-bold text-sm shrink-0 transition-transform duration-200 ease-out group-hover/brand:scale-105 motion-reduce:transform-none">
                {initial}
              </div>
            )}
            <span className="font-bold text-[15px] tracking-tight text-foreground truncate transition-colors duration-150 group-hover/brand:text-primary">
              {brandName}
            </span>
          </Link>
        ) : (
          settings.business_logo ? (
            <img
              src={settings.business_logo}
              alt={brandName}
              className="mx-auto h-8 w-8 rounded-lg object-contain bg-white shrink-0 border border-border/50 transition-transform duration-200 ease-out hover:scale-105 motion-reduce:transform-none"
            />
          ) : (
            <div className="mx-auto h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center font-bold text-sm shrink-0 transition-transform duration-200 ease-out hover:scale-105 motion-reduce:transform-none">
              {initial}
            </div>
          )
        )}

        {setCollapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-95 transition-all duration-150 shrink-0"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200" /> : <ChevronLeft className="h-3.5 w-3.5 transition-transform duration-200" />}
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <MenuDensityContext.Provider value={density}>
        <div className={cn("flex-1 overflow-y-auto overscroll-contain", containerSpacing)}>
        {/* Dashboard Home (Blue) */}
        {showDashboard && (
          <NavItem
            href="/"
            icon={LayoutDashboard}
            iconColor="text-blue-500 dark:text-blue-400"
            activeColorClass={blueActive}
            label="Dashboard"
            isActive={pathname === "/"}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        )}

        {/* Sales Module (Blue) */}
        {showSales && (
          <NavGroup
            title="Sales"
            icon={ShoppingCart}
            iconColor="text-blue-500 dark:text-blue-400"
            isOpen={isGroupOpen("sales")}
            isActive={isSalesActive}
            onToggle={() => toggleGroup("sales")}
            collapsed={collapsed}
          >
            {hasPermission("sales.create") && (
              <SubNavItem
                href="/sales/new"
                icon={Plus}
                iconColor="text-blue-500 dark:text-blue-400"
                activeColorClass={blueActive}
                label="Add Sale"
                isActive={pathname === "/sales/new"}
                onNavigate={onNavigate}
              />
            )}
            <SubNavItem
              href="/sales"
              icon={ShoppingCart}
              iconColor="text-blue-500 dark:text-blue-400"
              activeColorClass={blueActive}
              label="Manage Sale"
              isActive={pathname === "/sales"}
              onNavigate={onNavigate}
            />
            {(hasPermission("sales.report.view") || hasPermission("sales.view")) && (
              <SubNavItem
                href="/sales/reports"
                icon={BarChart3}
                iconColor="text-blue-500 dark:text-blue-400"
                activeColorClass={blueActive}
                label="Sale Report"
                isActive={pathname === "/sales/reports"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Sales Return Module (Orange / Amber) */}
        {showSaleReturn && (
          <NavGroup
            title="Sales Return"
            icon={RotateCcw}
            iconColor="text-amber-500 dark:text-amber-400"
            isOpen={isGroupOpen("sale_returns")}
            isActive={isSaleReturnActive}
            onToggle={() => toggleGroup("sale_returns")}
            collapsed={collapsed}
          >
            {hasPermission("sale_return.create") && (
              <SubNavItem
                href="/sale-returns/new"
                icon={Undo2}
                iconColor="text-amber-500 dark:text-amber-400"
                activeColorClass={amberActive}
                label="Add Sale Return"
                isActive={pathname === "/sale-returns/new"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("sale_return.view") && (
              <SubNavItem
                href="/sale-returns"
                icon={RotateCcw}
                iconColor="text-amber-500 dark:text-amber-400"
                activeColorClass={amberActive}
                label="Manage Sale Return"
                isActive={pathname === "/sale-returns"}
                onNavigate={onNavigate}
              />
            )}
            {(hasPermission("sale_return.report") || hasPermission("sale_return.view")) && (
              <SubNavItem
                href="/sale-returns/reports"
                icon={BarChart3}
                iconColor="text-amber-500 dark:text-amber-400"
                activeColorClass={amberActive}
                label="Sale Return Report"
                isActive={pathname === "/sale-returns/reports"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Customers Module (Blue) */}
        {showCustomers && (
          <NavGroup
            title="Customers"
            icon={Users}
            iconColor="text-blue-500 dark:text-blue-400"
            isOpen={isGroupOpen("customers")}
            isActive={isCustomerActive}
            onToggle={() => toggleGroup("customers")}
            collapsed={collapsed}
          >
            {hasPermission("customer.create") && (
              <SubNavItem
                href="/customers/new"
                icon={UserPlus}
                iconColor="text-blue-500 dark:text-blue-400"
                activeColorClass={blueActive}
                label="Add Customer"
                isActive={pathname === "/customers/new"}
                onNavigate={onNavigate}
              />
            )}
            <SubNavItem
              href="/customers"
              icon={Users}
              iconColor="text-blue-500 dark:text-blue-400"
              activeColorClass={blueActive}
              label="Customer List / Manage"
              isActive={pathname === "/customers"}
              onNavigate={onNavigate}
            />
            <SubNavItem
              href="/customers/ledger"
              icon={BookOpen}
              iconColor="text-blue-500 dark:text-blue-400"
              activeColorClass={blueActive}
              label="Customer Ledger"
              isActive={pathname === "/customers/ledger"}
              onNavigate={onNavigate}
            />
            {hasPermission("customer.due.view") && (
              <SubNavItem
                href="/customers/dues"
                icon={AlertCircle}
                iconColor="text-amber-500 dark:text-amber-400"
                activeColorClass={amberActive}
                label="Customer Due List"
                isActive={pathname === "/customers/dues"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Customer Collection Module (Green / Emerald) */}
        {showCollections && (
          <NavGroup
            title="Customer Collection"
            icon={Wallet}
            iconColor="text-emerald-500 dark:text-emerald-400"
            isOpen={isGroupOpen("collections")}
            isActive={isCollectionActive}
            onToggle={() => toggleGroup("collections")}
            collapsed={collapsed}
          >
            {hasPermission("collection.create") && (
              <SubNavItem
                href="/collections/new"
                icon={PlusCircle}
                iconColor="text-emerald-500 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Add Collection"
                isActive={pathname === "/collections/new"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("collection.view") && (
              <SubNavItem
                href="/collections"
                icon={Receipt}
                iconColor="text-emerald-500 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Manage Collection"
                isActive={pathname === "/collections"}
                onNavigate={onNavigate}
              />
            )}
            {(hasPermission("collection.report") || hasPermission("collection.view")) && (
              <SubNavItem
                href="/collections/reports"
                icon={BarChart3}
                iconColor="text-emerald-500 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Collection Report"
                isActive={pathname === "/collections/reports"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Purchase Module (Purple / Indigo) */}
        {showPurchases && (
          <NavGroup
            title="Purchase"
            icon={ShoppingBag}
            iconColor="text-indigo-500 dark:text-indigo-400"
            isOpen={isGroupOpen("purchases")}
            isActive={isPurchaseActive}
            onToggle={() => toggleGroup("purchases")}
            collapsed={collapsed}
          >
            {hasPermission("purchase.create") && (
              <SubNavItem
                href="/purchases/new"
                icon={Plus}
                iconColor="text-indigo-500 dark:text-indigo-400"
                activeColorClass={indigoActive}
                label="Add Purchase"
                isActive={pathname === "/purchases/new"}
                onNavigate={onNavigate}
              />
            )}
            <SubNavItem
              href="/purchases"
              icon={ShoppingBag}
              iconColor="text-indigo-500 dark:text-indigo-400"
              activeColorClass={indigoActive}
              label="Manage Purchase"
              isActive={pathname === "/purchases"}
              onNavigate={onNavigate}
            />
            {hasPermission("purchase.report") && (
              <SubNavItem
                href="/purchases/reports"
                icon={BarChart3}
                iconColor="text-indigo-500 dark:text-indigo-400"
                activeColorClass={indigoActive}
                label="Purchase Report"
                isActive={pathname === "/purchases/reports"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Product Return Module (Orange / Red) */}
        {showProductReturn && (
          <NavGroup
            title="Product Return"
            icon={RotateCcw}
            iconColor="text-orange-500 dark:text-orange-400"
            isOpen={isGroupOpen("product_returns")}
            isActive={isProductReturnActive}
            onToggle={() => toggleGroup("product_returns")}
            collapsed={collapsed}
          >
            {hasPermission("product_return.create") && (
              <SubNavItem
                href="/product-returns/new"
                icon={Undo2}
                iconColor="text-orange-500 dark:text-orange-400"
                activeColorClass={orangeActive}
                label="Add Product Return"
                isActive={pathname === "/product-returns/new"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("product_return.view") && (
              <SubNavItem
                href="/product-returns"
                icon={RotateCcw}
                iconColor="text-orange-500 dark:text-orange-400"
                activeColorClass={orangeActive}
                label="Manage Product Return"
                isActive={pathname === "/product-returns"}
                onNavigate={onNavigate}
              />
            )}
            {(hasPermission("product_return.report") || hasPermission("product_return.view")) && (
              <SubNavItem
                href="/product-returns/reports"
                icon={BarChart3}
                iconColor="text-orange-500 dark:text-orange-400"
                activeColorClass={orangeActive}
                label="Product Return Report"
                isActive={pathname === "/product-returns/reports"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Supplier Module (Blue) */}
        {showSuppliers && (
          <NavGroup
            title="Suppliers"
            icon={Truck}
            iconColor="text-blue-500 dark:text-blue-400"
            isOpen={isGroupOpen("suppliers")}
            isActive={isSupplierActive}
            onToggle={() => toggleGroup("suppliers")}
            collapsed={collapsed}
          >
            {hasPermission("supplier.create") && (
              <SubNavItem
                href="/suppliers/new"
                icon={UserPlus}
                iconColor="text-blue-500 dark:text-blue-400"
                activeColorClass={blueActive}
                label="Add Supplier"
                isActive={pathname === "/suppliers/new"}
                onNavigate={onNavigate}
              />
            )}
            <SubNavItem
              href="/suppliers"
              icon={Truck}
              iconColor="text-blue-500 dark:text-blue-400"
              activeColorClass={blueActive}
              label="Supplier List / Manage"
              isActive={pathname === "/suppliers"}
              onNavigate={onNavigate}
            />
            <SubNavItem
              href="/suppliers/ledger"
              icon={BookOpen}
              iconColor="text-blue-500 dark:text-blue-400"
              activeColorClass={blueActive}
              label="Supplier Ledger"
              isActive={pathname === "/suppliers/ledger"}
              onNavigate={onNavigate}
            />
            <SubNavItem
              href="/suppliers/dues"
              icon={AlertCircle}
              iconColor="text-amber-500 dark:text-amber-400"
              activeColorClass={amberActive}
              label="Supplier Due List"
              isActive={pathname === "/suppliers/dues"}
              onNavigate={onNavigate}
            />
          </NavGroup>
        )}

        {/* Supplier Payment Module (Green / Emerald) */}
        {showSupplierPayments && (
          <NavGroup
            title="Supplier Payment"
            icon={Receipt}
            iconColor="text-emerald-500 dark:text-emerald-400"
            isOpen={isGroupOpen("supplier_payments")}
            isActive={isSupplierPaymentActive}
            onToggle={() => toggleGroup("supplier_payments")}
            collapsed={collapsed}
          >
            {hasPermission("supplier_payment.create") && (
              <SubNavItem
                href="/supplier-payments/new"
                icon={PlusCircle}
                iconColor="text-emerald-500 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Add Supplier Payment"
                isActive={pathname === "/supplier-payments/new"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("supplier_payment.view") && (
              <SubNavItem
                href="/supplier-payments"
                icon={Receipt}
                iconColor="text-emerald-500 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Manage Supplier Payment"
                isActive={pathname === "/supplier-payments"}
                onNavigate={onNavigate}
              />
            )}
            {(hasPermission("supplier_payment.report") || hasPermission("supplier_payment.view")) && (
              <SubNavItem
                href="/supplier-payments/reports"
                icon={BarChart3}
                iconColor="text-emerald-500 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Supplier Payment Report"
                isActive={pathname === "/supplier-payments/reports"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Expenses Module (Pink / Red / Rose) */}
        {showExpenses && (
          <NavGroup
            title="Expenses"
            icon={Receipt}
            iconColor="text-rose-500 dark:text-rose-400"
            isOpen={isGroupOpen("expenses")}
            isActive={isExpenseActive}
            onToggle={() => toggleGroup("expenses")}
            collapsed={collapsed}
          >
            {(hasPermission("expense.category.view") || hasPermission("expense.view")) && (
              <SubNavItem
                href="/expenses/categories"
                icon={Layers}
                iconColor="text-rose-500 dark:text-rose-400"
                activeColorClass={roseActive}
                label="Expense Categories"
                isActive={pathname === "/expenses/categories"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("expense.create") && (
              <SubNavItem
                href="/expenses/new"
                icon={Plus}
                iconColor="text-rose-500 dark:text-rose-400"
                activeColorClass={roseActive}
                label="Add Expense"
                isActive={pathname === "/expenses/new"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("expense.view") && (
              <SubNavItem
                href="/expenses"
                icon={Receipt}
                iconColor="text-rose-500 dark:text-rose-400"
                activeColorClass={roseActive}
                label="Manage Expenses"
                isActive={pathname === "/expenses"}
                onNavigate={onNavigate}
              />
            )}
            {(hasPermission("expense.report.view") || hasPermission("expense.view")) && (
              <SubNavItem
                href="/expenses/reports"
                icon={BarChart3}
                iconColor="text-rose-500 dark:text-rose-400"
                activeColorClass={roseActive}
                label="Expense Report"
                isActive={pathname === "/expenses/reports"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Product Module (Sky / Blue) */}
        {showProducts && (
          <NavGroup
            title="Product"
            icon={Package}
            iconColor="text-sky-500 dark:text-sky-400"
            isOpen={isGroupOpen("products")}
            isActive={isProductActive}
            onToggle={() => toggleGroup("products")}
            collapsed={collapsed}
          >
            {hasPermission("product.create") && (
              <SubNavItem
                href="/products/new"
                icon={PackagePlus}
                iconColor="text-sky-500 dark:text-sky-400"
                activeColorClass={skyActive}
                label="Add Product"
                isActive={pathname === "/products/new"}
                onNavigate={onNavigate}
              />
            )}
            <SubNavItem
              href="/products"
              icon={PackageSearch}
              iconColor="text-sky-500 dark:text-sky-400"
              activeColorClass={skyActive}
              label="Product List / Manage"
              isActive={pathname === "/products"}
              onNavigate={onNavigate}
            />
          </NavGroup>
        )}

        {/* Farm Module (Green / Emerald) */}
        {showFarm && (
          <NavGroup
            title="Farm"
            icon={Sprout}
            iconColor="text-emerald-500 dark:text-emerald-400"
            isOpen={isGroupOpen("farm")}
            isActive={isFarmActive}
            onToggle={() => toggleGroup("farm")}
            collapsed={collapsed}
          >
            {hasPermission("farm.create") && (
              <SubNavItem
                href="/farm/add"
                icon={Plus}
                iconColor="text-emerald-600 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Add Farm"
                isActive={pathname === "/farm/add"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission(["farm.view", "farm.edit", "farm.delete"]) && (
              <SubNavItem
                href="/farm"
                icon={Layers}
                iconColor="text-emerald-600 dark:text-emerald-400"
                activeColorClass={emeraldActive}
                label="Manage Farm"
                isActive={pathname === "/farm"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission([
              "farm.production.view",
              "farm.production.create",
              "farm.production.edit",
              "farm.production.delete",
            ]) && (
              <SubNavItem
                href="/farm/production"
                icon={PlusCircle}
                iconColor="text-amber-500 dark:text-amber-400"
                activeColorClass={emeraldActive}
                label="Production"
                isActive={pathname === "/farm/production"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission(["farm.production.view", "production.view"]) && (
              <SubNavItem
                href="/farm/production/manage"
                icon={ClipboardList}
                iconColor="text-amber-600 dark:text-amber-400"
                activeColorClass={emeraldActive}
                label="Manage Production"
                isActive={pathname === "/farm/production/manage"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission([
              "farm.delivery.view",
              "farm.delivery.create",
              "farm.delivery.edit",
              "farm.delivery.delete",
            ]) && (
              <SubNavItem
                href="/farm/delivery"
                icon={Truck}
                iconColor="text-blue-500 dark:text-blue-400"
                activeColorClass={emeraldActive}
                label="Delivery"
                isActive={pathname === "/farm/delivery"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission(["farm.delivery.view", "delivery.view"]) && (
              <SubNavItem
                href="/farm/delivery/manage"
                icon={PackageCheck}
                iconColor="text-blue-600 dark:text-blue-400"
                activeColorClass={emeraldActive}
                label="Manage Delivery"
                isActive={pathname === "/farm/delivery/manage"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission(["farm.report", "farm.view"]) && (
              <SubNavItem
                href="/farm/ledger"
                icon={BookOpen}
                iconColor="text-purple-500 dark:text-purple-400"
                activeColorClass={emeraldActive}
                label="Farm Ledger"
                isActive={pathname === "/farm/ledger"}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("farm.report") && (
              <SubNavItem
                href="/farm/report"
                icon={BarChart3}
                iconColor="text-indigo-500 dark:text-indigo-400"
                activeColorClass={emeraldActive}
                label="Production & Delivery Report"
                isActive={pathname === "/farm/report"}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Cash Module (Teal / Blue) */}
        {showCash && (
          <NavGroup
            title="Cash"
            icon={Banknote}
            iconColor="text-teal-500 dark:text-teal-400"
            isOpen={isGroupOpen("cash")}
            isActive={isCashActive}
            onToggle={() => toggleGroup("cash")}
            collapsed={collapsed}
          >
            {hasPermission(["accounts.cash_book.view", "reports.view"]) && (
              <SubNavItem
                href="/cash/cash-book"
                icon={BookOpen}
                iconColor="text-teal-500 dark:text-teal-400"
                activeColorClass={tealActive}
                label="Cash Book"
                isActive={isCashBookActive}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission(["accounts.cash_out.view", "accounts.cash_book.view", "reports.view"]) && (
              <SubNavItem
                href="/cash/cash-out"
                icon={ArrowUpRight}
                iconColor="text-teal-500 dark:text-teal-400"
                activeColorClass={tealActive}
                label="Cash Out"
                isActive={isCashOutActive}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission(["cash_out.view", "accounts.cash_out.view"]) && (
              <SubNavItem
                href="/cash/cash-out/manage"
                icon={FileText}
                iconColor="text-teal-500 dark:text-teal-400"
                activeColorClass={tealActive}
                label="Cash Out Manage"
                isActive={isCashOutManageActive}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* Accounts & Reports Module (Purple / Indigo) */}
        {showAccounts && (
          <NavGroup
            title="Accounts"
            icon={Landmark}
            iconColor="text-purple-500 dark:text-purple-400"
            isOpen={isGroupOpen("accounts")}
            isActive={isAccountsActive}
            onToggle={() => toggleGroup("accounts")}
            collapsed={collapsed}
          >
            {hasPermission("dashboard.filtered.view") && (
              <SubNavItem
                href="/dashboard/filtered"
                icon={LayoutDashboard}
                iconColor="text-purple-500 dark:text-purple-400"
                activeColorClass={purpleActive}
                label="Filtered Dashboard"
                isActive={isFilteredDashboardActive}
                onNavigate={onNavigate}
              />
            )}
            {hasPermission("reports.view") && (
              <SubNavItem
                href="/reports"
                icon={BarChart3}
                iconColor="text-purple-500 dark:text-purple-400"
                activeColorClass={purpleActive}
                label="Reports Center"
                isActive={isReportsCenterActive}
                onNavigate={onNavigate}
              />
            )}
          </NavGroup>
        )}

        {/* User Management (Violet / Indigo) */}
        {showUsers && (
          <NavGroup
            title="User Management"
            icon={UserCheck}
            iconColor="text-violet-500 dark:text-violet-400"
            isOpen={isGroupOpen("users")}
            isActive={isUsersActive}
            onToggle={() => toggleGroup("users")}
            collapsed={collapsed}
          >
            {hasPermission("user.create") && (
              <SubNavItem
                href="/users/new"
                icon={UserPlus}
                iconColor="text-violet-500 dark:text-violet-400"
                activeColorClass={violetActive}
                label="Add User"
                isActive={pathname === "/users/new"}
                onNavigate={onNavigate}
              />
            )}
            <SubNavItem
              href="/users"
              icon={Users}
              iconColor="text-violet-500 dark:text-violet-400"
              activeColorClass={violetActive}
              label="Manage Users"
              isActive={pathname === "/users"}
              onNavigate={onNavigate}
            />
          </NavGroup>
        )}

        {/* Roles & Permissions / RBAC (Amber / Orange) */}
        {showRoles && (
          <NavItem
            href="/roles"
            icon={ShieldCheck}
            iconColor="text-amber-500 dark:text-amber-400"
            activeColorClass={amberActive}
            label="Roles & Permissions"
            isActive={pathname === "/roles"}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        )}

        {/* System Architecture (Owner only - Indigo) */}
        {showArchitecture && (
          <NavItem
            href="/architecture"
            icon={Layers}
            iconColor="text-indigo-500 dark:text-indigo-400"
            activeColorClass={indigoActive}
            label="System Architecture"
            isActive={pathname === "/architecture"}
            collapsed={collapsed}
            onNavigate={onNavigate}
            badge={
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-300 dark:border-slate-700 font-normal">
                Foundation
              </Badge>
            }
          />
        )}

        {/* API Status (Owner only - Emerald) */}
        {showApiStatus && (
          <NavItem
            href="/system-status"
            icon={Activity}
            iconColor="text-emerald-500 dark:text-emerald-400"
            activeColorClass={emeraldActive}
            label="API Status"
            isActive={pathname === "/system-status"}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        )}

        {/* Security & Auth (Cyan / Blue) */}
        {showSecurity && (
          <NavItem
            href="/security"
            icon={Shield}
            iconColor="text-cyan-500 dark:text-cyan-400"
            activeColorClass={cyanActive}
            label="Security & Auth"
            isActive={pathname === "/security"}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        )}

        {/* System Settings (Slate) */}
        {showSettings && (
          <NavItem
            href="/settings"
            icon={Settings}
            iconColor="text-slate-500 dark:text-slate-400"
            activeColorClass={slateActive}
            label="System Settings"
            isActive={pathname === "/settings"}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        )}
        </div>
      </MenuDensityContext.Provider>

      {/* Footer User Area & Logout */}
      {user && (
        <div className="p-2 border-t border-border/70 shrink-0 bg-card">
          {!collapsed ? (
            <div className="group/user flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-all duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0 transition-transform duration-200 ease-out group-hover/user:scale-105 motion-reduce:transform-none">
                  {user.full_name?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-[13px] text-foreground leading-tight truncate">
                    {user.full_name || user.username}
                  </span>
                  <span className="text-[11px] text-muted-foreground capitalize leading-tight truncate">
                    {user.role?.name || "User"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onNavigate?.();
                  logout();
                }}
                title="Sign Out"
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all duration-150 shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                logout();
              }}
              title={`Sign Out (${user.full_name || user.username})`}
              className="h-8 w-8 mx-auto flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all duration-150"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
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
        "hidden md:flex flex-col border-r border-border/70 bg-card transition-[width] duration-200 ease-out motion-reduce:transition-none relative z-30 h-full md:h-[100dvh] shrink-0 sticky top-0 text-card-foreground print:hidden",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
    </aside>
  );
}
