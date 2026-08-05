"use client";

import Link from "next/link";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";

import { dashboardService } from "@/services/api";
import {
  DashboardCardsSummary,
  RecentSaleItem,
} from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";

export default function DashboardPage() {
  // Independent query 1: Cards summary
  const { data: summaryQueryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardService.getSummary(),
  });

  // Independent query 2: Recent sales
  const { data: salesQueryData, isLoading: isSalesLoading } = useQuery({
    queryKey: ["dashboard-recent-sales"],
    queryFn: () => dashboardService.getRecentSales(),
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

  const recentSales: RecentSaleItem[] = salesQueryData?.data || [];

  const isProfitPositive = summary.total_profit >= 0;

  return (
    <HasPermission code="dashboard.view">
      <div className="space-y-6">
        <PageHeader
          title="Business Executive Dashboard"
          description="Real-time operational summary, sales metrics, customer & supplier balances, and recent sales transactions."
        />

        {/* 8 KPI Cards Grid: 2 rows x 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* --- ROW 1 --- */}

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

          {/* --- ROW 2 --- */}

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

        {/* Recent Sales Transactions Table (Full Width) */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                Recent Sales Transactions
              </CardTitle>
              <CardDescription className="text-xs">
                Latest sales orders processed across channels.
              </CardDescription>
            </div>
            <Link href="/sales">
              <Button variant="ghost" size="sm" className="text-xs text-primary font-semibold">
                View All Sales &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-right">Amount ($)</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isSalesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No sales transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-accent/40 transition-colors">
                      <td className="p-3 font-bold text-primary">
                        {sale.invoice_no}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        {sale.customer_name}
                      </td>
                      <td className="p-3 text-right font-extrabold text-blue-500">
                        {formatCurrency(sale.grand_total)}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(sale.sale_date)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </HasPermission>
  );
}
