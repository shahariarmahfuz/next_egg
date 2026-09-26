"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  ShoppingBag,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Banknote,
  CreditCard,
  Receipt,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";
import { dashboardService } from "@/services/api";
import { useSettingsStore } from "@/store/settings";
import { DashboardCardsSummary } from "@/types";
import { formatCurrency } from "@/utils/formatters";

export default function FilteredDashboardPage() {
  const { user, hasPermission } = useAuth();
  const today = new Date().toLocaleDateString('en-CA');
  
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: summaryQueryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["dashboard-summary", startDate, endDate],
    queryFn: () => dashboardService.getSummary(startDate, endDate),
    enabled: hasPermission("dashboard.filtered.view"),
  });

  const summary: DashboardCardsSummary = summaryQueryData?.data || {
    total_products: 0,
    total_customers: 0,
    total_sales: 0,
    total_cash_sales: 0,
    total_due_sales: 0,
    total_purchases: 0,
    total_expenses: 0,
    customer_due: 0,
    supplier_due: 0,
    total_profit: 0,
  };

  const isProfitPositive = summary.total_profit >= 0;
  const { settings } = useSettingsStore();

  if (!hasPermission("dashboard.filtered.view")) {
    return (
      <div className="p-8 text-center text-destructive font-medium">
        Access Denied: You do not have permission to view Filtered Dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Filtered Dashboard"
          description="View business performance over a specific date range."
        />
        <div className="flex items-center space-x-4 bg-card p-3 rounded-lg border shadow-sm">
          <div className="flex items-center space-x-2">
            <Label htmlFor="start_date">From</Label>
            <Input 
              type="date" 
              id="start_date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-auto h-8"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="end_date">To</Label>
            <Input 
              type="date" 
              id="end_date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-auto h-8"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales */}
        <Card className="relative overflow-hidden rounded-xl border border-blue-200/70 bg-gradient-to-br from-white via-white to-blue-50/50 shadow-xs transition-all duration-200 hover:shadow-sm dark:border-blue-900/40 dark:from-card dark:via-card dark:to-blue-950/25 dark:shadow-none">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl dark:bg-blue-400/15" aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Total Sales
              </span>
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border border-blue-200/60 bg-blue-500/10 text-blue-600 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-400">
                <ShoppingCart className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight text-blue-600 dark:text-blue-300">
                {formatCurrency(summary.total_sales)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Gross sales turnover
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Cash Sales */}
        <Card className="relative overflow-hidden rounded-xl border border-emerald-200/70 bg-gradient-to-br from-white via-white to-emerald-50/50 shadow-xs transition-all duration-200 hover:shadow-sm dark:border-emerald-900/40 dark:from-card dark:via-card dark:to-emerald-950/25 dark:shadow-none">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl dark:bg-emerald-400/15" aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Total Cash Sales
              </span>
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border border-emerald-200/60 bg-emerald-500/10 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Banknote className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight text-emerald-600 dark:text-emerald-300">
                {formatCurrency(summary.total_cash_sales)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Fully paid invoices
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Due Sales */}
        <Card className="relative overflow-hidden rounded-xl border border-orange-200/70 bg-gradient-to-br from-white via-white to-orange-50/50 shadow-xs transition-all duration-200 hover:shadow-sm dark:border-orange-900/40 dark:from-card dark:via-card dark:to-orange-950/25 dark:shadow-none">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl dark:bg-orange-400/15" aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                Total Due Sales
              </span>
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border border-orange-200/60 bg-orange-500/10 text-orange-600 dark:border-orange-800/50 dark:bg-orange-950/50 dark:text-orange-400">
                <CreditCard className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight text-orange-600 dark:text-orange-300">
                {formatCurrency(summary.total_due_sales)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Sales with outstanding balance
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Total Purchases */}
        <Card className="relative overflow-hidden rounded-xl border border-purple-200/70 bg-gradient-to-br from-white via-white to-purple-50/50 shadow-xs transition-all duration-200 hover:shadow-sm dark:border-purple-900/40 dark:from-card dark:via-card dark:to-purple-950/25 dark:shadow-none">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl dark:bg-purple-400/15" aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Total Purchases
              </span>
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border border-purple-200/60 bg-purple-500/10 text-purple-600 dark:border-purple-800/50 dark:bg-purple-950/50 dark:text-purple-400">
                <ShoppingBag className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight text-purple-600 dark:text-purple-300">
                {formatCurrency(summary.total_purchases)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Procurement orders total
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Total Expenses */}
        <Card className="relative overflow-hidden rounded-xl border border-rose-200/70 bg-gradient-to-br from-white via-white to-rose-50/50 shadow-xs transition-all duration-200 hover:shadow-sm dark:border-rose-900/40 dark:from-card dark:via-card dark:to-rose-950/25 dark:shadow-none">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl dark:bg-rose-400/15" aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Total Expenses
              </span>
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border border-rose-200/60 bg-rose-500/10 text-rose-600 dark:border-rose-800/50 dark:bg-rose-950/50 dark:text-rose-400">
                <Receipt className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight text-rose-600 dark:text-rose-300">
                {formatCurrency(summary.total_expenses)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Business operating costs
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Customer Due */}
        <Card className="relative overflow-hidden rounded-xl border border-emerald-200/70 bg-gradient-to-br from-white via-white to-emerald-50/50 shadow-xs transition-all duration-200 hover:shadow-sm dark:border-emerald-900/40 dark:from-card dark:via-card dark:to-emerald-950/25 dark:shadow-none">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl dark:bg-emerald-400/15" aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Customer Due
              </span>
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border border-emerald-200/60 bg-emerald-500/10 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight text-emerald-600 dark:text-emerald-300">
                {formatCurrency(summary.customer_due)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Outstanding receivables
            </div>
          </CardContent>
        </Card>

        {/* Card 7: Supplier Due */}
        <Card className="relative overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-br from-white via-white to-amber-50/50 shadow-xs transition-all duration-200 hover:shadow-sm dark:border-amber-900/40 dark:from-card dark:via-card dark:to-amber-950/25 dark:shadow-none">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl dark:bg-amber-400/15" aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Supplier Due
              </span>
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border border-amber-200/60 bg-amber-500/10 text-amber-600 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight text-amber-600 dark:text-amber-300">
                {formatCurrency(summary.supplier_due)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Outstanding payables to vendors
            </div>
          </CardContent>
        </Card>

        {/* Card 8: Total Profit */}
        <Card className={`relative overflow-hidden rounded-xl border shadow-xs transition-all duration-200 hover:shadow-sm dark:shadow-none ${
          isProfitPositive
            ? "border-emerald-200/70 bg-gradient-to-br from-white via-white to-emerald-50/50 dark:border-emerald-900/40 dark:from-card dark:via-card dark:to-emerald-950/25"
            : "border-red-200/70 bg-gradient-to-br from-white via-white to-red-50/50 dark:border-red-900/40 dark:from-card dark:via-card dark:to-red-950/25"
        }`}>
          <div className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl ${
            isProfitPositive ? "bg-emerald-500/10 dark:bg-emerald-400/15" : "bg-red-500/10 dark:bg-red-400/15"
          }`} aria-hidden="true" />
          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${
                isProfitPositive
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}>
                Total Profit
              </span>
              <div className={`flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-lg border ${
                isProfitPositive
                  ? "border-emerald-200/60 bg-emerald-500/10 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "border-red-200/60 bg-red-500/10 text-red-600 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-400"
              }`}>
                {isProfitPositive ? <TrendingUp className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> : <TrendingDown className="h-4 w-4 sm:h-4.5 sm:w-4.5" />}
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className={`mt-1 text-2xl sm:text-[26px] font-extrabold tracking-tight ${
                isProfitPositive ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"
              }`}>
                {formatCurrency(summary.total_profit)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground/80 dark:text-muted-foreground">
              Sales − COGS − Expenses
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
