"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Calendar,
  Printer,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { reportService } from "@/services/api";
import { DailyCashReportData } from "@/types";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";
import { HasPermission } from "@/providers/auth-provider";
import { usePrint } from "@/lib/print-service";
import { PrintableCashReport } from "@/components/accounts/printable-cash-report";

export default function CashReportPage() {
  const { settings } = useSettingsStore();
  const { printDocument, isPrinting } = usePrint();

  // Date helper (YYYY-MM-DD in client local time)
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [targetDate, setTargetDate] = useState<string>(getTodayStr());
  const [startDate, setStartDate] = useState<string>(getTodayStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());

  // Fetch daily cash report
  const {
    data: cashReportData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "daily-cash-report",
      dateMode,
      dateMode === "single" ? targetDate : `${startDate}_${endDate}`,
      settings.timezone,
    ],
    queryFn: () => {
      const params =
        dateMode === "single"
          ? {
              target_date: targetDate,
              timezone: settings.timezone || "Asia/Dhaka",
            }
          : {
              start_date: startDate,
              end_date: endDate,
              timezone: settings.timezone || "Asia/Dhaka",
            };
      return reportService.getCashReport(params);
    },
  });

  const report: DailyCashReportData | undefined = cashReportData?.data;

  // Print trigger
  const handlePrint = async () => {
    if (!report) return;
    await printDocument(<PrintableCashReport report={report} />);
  };

  // Quick Date Selectors
  const handleSelectToday = () => {
    const today = getTodayStr();
    setDateMode("single");
    setTargetDate(today);
  };

  const handleSelectYesterday = () => {
    const yesterday = getYesterdayStr();
    setDateMode("single");
    setTargetDate(yesterday);
  };

  return (
    <HasPermission
      code="cash_report.view"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Cash Reports.
        </div>
      }
    >
      <div className="space-y-6 pb-12 w-full max-w-full">
        {/* PAGE HEADER */}
        <PageHeader
          title="Daily Cash Report"
          description="Consolidated daily cash inflow (Sales & Collections), outflow (Cash Outs & Expenses), and net remaining cash balance."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2 shrink-0"
              >
                <RotateCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                onClick={handlePrint}
                disabled={!report || isLoading || isPrinting}
                className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Printer className="h-4 w-4" />
                <span>{isPrinting ? "Printing..." : "Print Statement"}</span>
              </Button>
            </div>
          }
        />

        {/* CONTROLS / FILTER TOOLBAR */}
        <Card className="border shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left: Quick Date Presets & Mode Toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={dateMode === "single" && targetDate === getTodayStr() ? "default" : "outline"}
                  onClick={handleSelectToday}
                  className="text-xs h-8"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dateMode === "single" && targetDate === getYesterdayStr() ? "default" : "outline"}
                  onClick={handleSelectYesterday}
                  className="text-xs h-8"
                >
                  Yesterday
                </Button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />
                <Button
                  type="button"
                  size="sm"
                  variant={dateMode === "single" ? "secondary" : "ghost"}
                  onClick={() => setDateMode("single")}
                  className="text-xs h-8"
                >
                  Single Date
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dateMode === "range" ? "secondary" : "ghost"}
                  onClick={() => {
                    setDateMode("range");
                    setStartDate(targetDate);
                    setEndDate(targetDate);
                  }}
                  className="text-xs h-8"
                >
                  Date Range
                </Button>
              </div>

              {/* Right: Date Inputs */}
              <div className="flex flex-wrap items-center gap-2.5">
                {dateMode === "single" ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap hidden sm:inline">
                      Date:
                    </span>
                    <div className="relative w-full sm:w-44">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="pl-8 text-xs h-9 w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">From:</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-xs h-9 w-36"
                    />
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">To:</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-xs h-9 w-36"
                    />
                  </div>
                )}
                {report && (
                  <Badge variant="outline" className="text-[11px] font-mono text-slate-500 hidden md:inline-flex">
                    {report.timezone}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ERROR STATE */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4 flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Failed to load Daily Cash Report</p>
                <p className="text-xs opacity-90">{(error as any)?.message || "Please check your network connection and try again."}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* LOADING STATE */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* LOADED REPORT VIEW */}
        {!isLoading && report && (
          <>
            {/* 1. EXECUTIVE KPI SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Inflow Card */}
              <Card className="border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                      Total Cash In (মোট প্রাপ্তি)
                    </CardTitle>
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <ArrowDownLeft className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-5 pb-4 space-y-3">
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-900 dark:text-emerald-300 font-mono tracking-tight">
                    {formatCurrency(report.total_cash_in)}
                  </div>
                  <div className="border-t border-emerald-100 dark:border-emerald-900/30 pt-2.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                        Cash Sales:
                      </span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(report.cash_sales_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-teal-500"></span>
                        Due Collections:
                      </span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(report.customer_collections_amount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Outflow Card */}
              <Card className="border-rose-200 dark:border-rose-900/40 bg-gradient-to-br from-white to-rose-50/40 dark:from-slate-900 dark:to-rose-950/20 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-400">
                      Total Cash Out (মোট প্রদান)
                    </CardTitle>
                    <div className="h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-5 pb-4 space-y-3">
                  <div className="text-2xl sm:text-3xl font-extrabold text-rose-900 dark:text-rose-300 font-mono tracking-tight">
                    {formatCurrency(report.total_cash_out)}
                  </div>
                  <div className="border-t border-rose-100 dark:border-rose-900/30 pt-2.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                        Cash Out / Withdrawal:
                      </span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(report.cash_out_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                        Total Expenses:
                      </span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(report.expenses_amount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Net Remaining Cash Card */}
              <Card
                className={`border shadow-xs relative overflow-hidden sm:col-span-2 lg:col-span-1 ${
                  report.remaining_cash >= 0
                    ? "border-blue-200 dark:border-blue-900/40 bg-gradient-to-br from-white to-blue-50/40 dark:from-slate-900 dark:to-blue-950/20"
                    : "border-red-200 dark:border-red-900/40 bg-gradient-to-br from-white to-red-50/40 dark:from-slate-900 dark:to-red-950/20"
                }`}
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    report.remaining_cash >= 0 ? "bg-blue-600" : "bg-red-600"
                  }`}
                />
                <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        report.remaining_cash >= 0
                          ? "text-blue-800 dark:text-blue-400"
                          : "text-red-800 dark:text-red-400"
                      }`}
                    >
                      Net Remaining Cash (অবশিষ্ট ব্যালেন্স)
                    </CardTitle>
                    <Badge
                      className={
                        report.remaining_cash >= 0
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-none"
                          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-none"
                      }
                    >
                      {report.remaining_cash >= 0 ? "Surplus" : "Deficit"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-5 pb-4 space-y-3">
                  <div
                    className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                      report.remaining_cash >= 0
                        ? "text-blue-900 dark:text-blue-300"
                        : "text-red-900 dark:text-red-300"
                    }`}
                  >
                    {formatCurrency(report.remaining_cash)}
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between items-center">
                      <span>Formula:</span>
                      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        Inflow ({formatNumber(report.total_cash_in)}) - Outflow ({formatNumber(report.total_cash_out)})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Report Period:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {report.target_date}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 2. ITEMIZED RECONCILIATION SECTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* LEFT COLUMN: CASH INFLOW TABLES */}
              <div className="space-y-6">
                {/* 2A. Cash Sales */}
                <Card className="border shadow-xs overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800/40 py-3.5 px-4 sm:px-5 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        Today's Cash Sales
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Direct cash collected from sales today
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200">
                      {formatCurrency(report.cash_sales_amount)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {report.breakdown.cash_sales.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No cash sales recorded for this date.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-w-full">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b">
                            <tr>
                              <th className="py-2.5 px-3">Invoice</th>
                              <th className="py-2.5 px-3">Customer</th>
                              <th className="py-2.5 px-3 text-right">Bill Total</th>
                              <th className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400 font-bold">
                                Cash Paid
                              </th>
                              <th className="py-2.5 px-3 text-right">Due</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {report.breakdown.cash_sales.map((sale) => (
                              <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-3 font-mono font-medium text-blue-600 dark:text-blue-400">
                                  {sale.invoice_no}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {sale.customer_name}
                                  </div>
                                  {sale.customer_code && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {sale.customer_code}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {formatNumber(sale.grand_total)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatNumber(sale.paid_amount)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-500">
                                  {formatNumber(sale.due_amount)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] uppercase ${
                                      sale.payment_status === "paid"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    {sale.payment_status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2B. Customer Due Collections */}
                <Card className="border shadow-xs overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800/40 py-3.5 px-4 sm:px-5 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <Receipt className="h-4 w-4 text-teal-600" />
                        Customer Due Collections
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Previous dues collected from customers today
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-teal-700 bg-teal-50 dark:bg-teal-950/40 border-teal-200">
                      {formatCurrency(report.customer_collections_amount)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {report.breakdown.customer_collections.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No customer collections recorded for this date.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-w-full">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b">
                            <tr>
                              <th className="py-2.5 px-3">Collection No</th>
                              <th className="py-2.5 px-3">Customer</th>
                              <th className="py-2.5 px-3">Method</th>
                              <th className="py-2.5 px-3 text-right text-teal-700 dark:text-teal-400 font-bold">
                                Amount
                              </th>
                              <th className="py-2.5 px-3">Ref / Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {report.breakdown.customer_collections.map((col) => (
                              <tr key={col.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                                  {col.collection_no}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {col.customer_name}
                                  </div>
                                  {col.customer_code && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {col.customer_code}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3 capitalize text-slate-600 dark:text-slate-400">
                                  {col.payment_method}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                                  {formatNumber(col.amount)}
                                </td>
                                <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[150px]">
                                  {col.notes || col.reference_no || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT COLUMN: CASH OUTFLOW TABLES */}
              <div className="space-y-6">
                {/* 2C. Cash Out / Withdrawals */}
                <Card className="border shadow-xs overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800/40 py-3.5 px-4 sm:px-5 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <Banknote className="h-4 w-4 text-amber-600" />
                        Today's Cash Out / Withdrawals
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Proprietor withdrawals and non-expense cash out
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200">
                      {formatCurrency(report.cash_out_amount)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {report.breakdown.cash_outs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No cash withdrawals recorded for this date.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-w-full">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b">
                            <tr>
                              <th className="py-2.5 px-3">Voucher No</th>
                              <th className="py-2.5 px-3">Reason</th>
                              <th className="py-2.5 px-3">Created By</th>
                              <th className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400 font-bold">
                                Amount
                              </th>
                              <th className="py-2.5 px-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {report.breakdown.cash_outs.map((co) => (
                              <tr key={co.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                                  {co.cash_out_no}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {co.reason}
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  {co.created_by_name || "—"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {formatNumber(co.amount)}
                                </td>
                                <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[150px]">
                                  {co.notes || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2D. Today's Expenses */}
                <Card className="border shadow-xs overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800/40 py-3.5 px-4 sm:px-5 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <FileText className="h-4 w-4 text-rose-600" />
                        Today's Expenses
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Itemized operational and general business expenses
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200">
                      {formatCurrency(report.expenses_amount)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {report.breakdown.expenses.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No expenses recorded for this date.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-w-full">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b">
                            <tr>
                              <th className="py-2.5 px-3">Voucher</th>
                              <th className="py-2.5 px-3">Category</th>
                              <th className="py-2.5 px-3">Method</th>
                              <th className="py-2.5 px-3 text-right text-rose-700 dark:text-rose-400 font-bold">
                                Amount
                              </th>
                              <th className="py-2.5 px-3">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {report.breakdown.expenses.map((exp) => (
                              <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                                  {exp.voucher_no}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {exp.category_name}
                                </td>
                                <td className="py-2 px-3 capitalize text-slate-600 dark:text-slate-400">
                                  {exp.payment_method}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                  {formatNumber(exp.amount)}
                                </td>
                                <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[150px]">
                                  {exp.description || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </HasPermission>
  );
}
