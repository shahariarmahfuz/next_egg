"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Receipt,
  Search,
  X,
  Layers,
  CreditCard,
  DollarSign,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { expenseService } from "@/services/api";
import { Expense, ExpenseCategory, ExpenseReportSummary } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";

export default function ExpenseReportPage() {
  // Filters State
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch Categories for Filter
  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseService.getCategories(false),
  });
  const categories: ExpenseCategory[] = categoriesData?.data || [];

  // Fetch Summary Cards
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["expense-report-summary", categoryId, paymentMethod, startDate, endDate],
    queryFn: () =>
      expenseService.getReportSummary({
        category_id: categoryId || undefined,
        payment_method: paymentMethod || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
      }),
  });

  const summary: ExpenseReportSummary = summaryData?.data || {
    total_expenses: 0,
    today_expenses: 0,
    this_month_expenses: 0,
    this_year_expenses: 0,
    total_count: 0,
  };

  // Fetch Report Expenses Table
  const { data: reportExpensesData, isLoading: isTableLoading } = useQuery({
    queryKey: ["expense-report-table", categoryId, paymentMethod, startDate, endDate],
    queryFn: () =>
      expenseService.getExpenses({
        category_id: categoryId || undefined,
        payment_method: paymentMethod || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
        page: 1,
        page_size: 500, // retrieve up to 500 for report export
      }),
  });

  const expenses: Expense[] = reportExpensesData?.data?.items || [];

  const clearFilters = () => {
    setCategoryId("");
    setPaymentMethod("");
    setStartDate("");
    setEndDate("");
  };

  // Export CSV
  const exportCSV = () => {
    if (expenses.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = ["SL", "Voucher No", "Date", "Category", "Description", "Amount", "Payment Method", "Created By"];
    const rows = expenses.map((e, idx) => [
      idx + 1,
      `"${e.voucher_no}"`,
      `"${formatDate(e.expense_date)}"`,
      `"${e.category_name || ""}"`,
      `"${(e.description || "").replace(/"/g, '""')}"`,
      e.amount,
      `"${e.payment_method}"`,
      `"${e.created_by_name || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Expense_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF / Print View
  const exportPDF = () => {
    window.print();
  };

  return (
    <HasPermission code="expense.report.view">
      <div className="space-y-6 print:p-0">
        <PageHeader
          title="Expense Analytics & Report"
          description="Comprehensive breakdown of business operating expenses and historical summary."
          action={
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export CSV / Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5 text-xs">
                <Printer className="h-4 w-4 text-primary" />
                Print / Export PDF
              </Button>
            </div>
          }
        />

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
          {/* Card 1: Total Expenses */}
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
              <div className="text-[11px] text-muted-foreground mt-1">
                Filtered total ({summary.total_count} vouchers)
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Today's Expenses */}
          <Card className="glass-card border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Today's Expenses</span>
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <div className="text-2xl font-extrabold text-amber-500 mt-1">
                  {formatCurrency(summary.today_expenses)}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-1">Recorded today</div>
            </CardContent>
          </Card>

          {/* Card 3: This Month Expenses */}
          <Card className="glass-card border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">This Month</span>
                <div className="h-9 w-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <div className="text-2xl font-extrabold text-blue-500 mt-1">
                  {formatCurrency(summary.this_month_expenses)}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-1">Current calendar month</div>
            </CardContent>
          </Card>

          {/* Card 4: This Year Expenses */}
          <Card className="glass-card border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">This Year</span>
                <div className="h-9 w-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <div className="text-2xl font-extrabold text-purple-500 mt-1">
                  {formatCurrency(summary.this_year_expenses)}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-1">Current fiscal year total</div>
            </CardContent>
          </Card>
        </div>

        {/* Report Filter Controls */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Category Filter */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Expense Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-9 px-2.5 py-1 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-9 px-2.5 py-1 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Payment Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Mobile Banking">Mobile Banking</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">From Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              {/* End Date */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">To Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
                {(categoryId || paymentMethod || startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                    <th className="p-3 w-12 text-center">SL</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Voucher No</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount ($)</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isTableLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="p-3 text-center"><div className="h-4 w-4 bg-muted animate-pulse rounded mx-auto" /></td>
                        <td className="p-3"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                        <td className="p-3"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                        <td className="p-3"><div className="h-4 w-28 bg-muted animate-pulse rounded" /></td>
                        <td className="p-3"><div className="h-4 w-40 bg-muted animate-pulse rounded" /></td>
                        <td className="p-3"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                        <td className="p-3"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                        <td className="p-3"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                      </tr>
                    ))
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No expense records found matching the report filters.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp, idx) => (
                      <tr key={exp.id} className="hover:bg-accent/40 transition-colors">
                        <td className="p-3 text-center font-medium text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {formatDate(exp.expense_date)}
                        </td>
                        <td className="p-3 font-bold text-rose-500">
                          {exp.voucher_no}
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                            {exp.category_name}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {exp.description || "—"}
                        </td>
                        <td className="p-3 text-right font-extrabold text-foreground">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            {exp.payment_method}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {exp.created_by_name}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </HasPermission>
  );
}
