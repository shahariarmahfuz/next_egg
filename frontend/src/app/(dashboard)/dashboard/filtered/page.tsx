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
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-CA');
  
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: summaryQueryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["dashboard-summary", startDate, endDate],
    queryFn: () => dashboardService.getSummary(startDate, endDate),
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

  // Restrict to owner or admin
  if (user?.role?.code !== 'owner' && user?.role?.code !== 'admin') {
    return <div className="p-8 text-center text-red-500">Access Denied</div>;
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
        <Card className="glass-card border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total Sales</span>
              <div className="h-9 w-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className="text-2xl font-extrabold text-blue-500 mt-1">
                {formatCurrency(summary.total_sales)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">Gross sales turnover</div>
          </CardContent>
        </Card>

        {/* Card 2: Total Cash Sales */}
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Cash Sales</span>
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Banknote className="h-5 w-5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className="text-2xl font-extrabold text-emerald-500 mt-1">
                {formatCurrency(summary.total_cash_sales)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">Fully paid invoices</div>
          </CardContent>
        </Card>

        {/* Card 3: Total Due Sales */}
        <Card className="glass-card border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Total Due Sales</span>
              <div className="h-9 w-9 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className="text-2xl font-extrabold text-orange-500 mt-1">
                {formatCurrency(summary.total_due_sales)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">Sales with outstanding balance</div>
          </CardContent>
        </Card>

        {/* Card 4: Total Purchases */}
        <Card className="glass-card border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Total Purchases</span>
              <div className="h-9 w-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className="text-2xl font-extrabold text-purple-500 mt-1">
                {formatCurrency(summary.total_purchases)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">Procurement orders total</div>
          </CardContent>
        </Card>

        {/* Card 5: Total Expenses */}
        <Card className="glass-card border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Total Expenses</span>
              <div className="h-9 w-9 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className="text-2xl font-extrabold text-rose-500 mt-1">
                {formatCurrency(summary.total_expenses)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">Business operating costs</div>
          </CardContent>
        </Card>

        {/* Card 6: Customer Due */}
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Customer Due</span>
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className="text-2xl font-extrabold text-emerald-500 mt-1">
                {formatCurrency(summary.customer_due)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">Outstanding receivables</div>
          </CardContent>
        </Card>

        {/* Card 7: Supplier Due */}
        <Card className="glass-card border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Supplier Due</span>
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className="text-2xl font-extrabold text-amber-500 mt-1">
                {formatCurrency(summary.supplier_due)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">Outstanding payables to vendors</div>
          </CardContent>
        </Card>

        {/* Card 8: Total Profit */}
        <Card className={`glass-card ${
          isProfitPositive
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                isProfitPositive ? "text-emerald-600" : "text-red-600"
              }`}>Total Profit</span>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                isProfitPositive
                  ? "bg-emerald-500/20 text-emerald-500"
                  : "bg-red-500/20 text-red-500"
              }`}>
                {isProfitPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <div className={`text-2xl font-extrabold mt-1 ${
                isProfitPositive ? "text-emerald-500" : "text-red-500"
              }`}>
                {formatCurrency(summary.total_profit)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">
              Sales − Purchases − Expenses
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
