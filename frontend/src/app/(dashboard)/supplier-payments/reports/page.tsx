"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  Search,
  Receipt,
  TrendingUp,
  CreditCard,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { HasPermission } from "@/providers/auth-provider";
import { supplierPaymentService } from "@/services/api";
import { SupplierPaymentItem, SupplierPaymentReportSummaryData } from "@/types";
import {
  formatCurrency,
  formatDate,
  exportSupplierPaymentsCSV,
  exportSupplierPaymentsExcel,
} from "@/components/supplier-payments/supplier-payment-export-utils";

export default function SupplierPaymentReportPage() {
  const [presetFilter, setPresetFilter] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query Report Summary
  const { data: reportQueryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: [
      "supplier-payment-report-summary",
      presetFilter,
      startDate,
      endDate,
      debouncedSearch,
      paymentMethod,
    ],
    queryFn: () =>
      supplierPaymentService.getSupplierPaymentReports({
        preset_range: presetFilter !== "custom" ? presetFilter : undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        search: debouncedSearch || undefined,
        payment_method: paymentMethod || undefined,
      }),
  });

  // Query Report List of Supplier Payments
  const { data: paymentsQueryData, isLoading: isListLoading } = useQuery({
    queryKey: [
      "supplier-payment-report-list",
      presetFilter,
      startDate,
      endDate,
      debouncedSearch,
      paymentMethod,
    ],
    queryFn: () =>
      supplierPaymentService.getSupplierPayments({
        size: 100,
        search: debouncedSearch || undefined,
        payment_method: paymentMethod || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      }),
  });

  const summary: SupplierPaymentReportSummaryData = reportQueryData?.data || {
    total_payments_count: 0,
    total_paid_amount: 0,
    today_amount: 0,
    yesterday_amount: 0,
    this_week_amount: 0,
    this_month_amount: 0,
    payment_method_breakdown: {},
    daily_breakdown: [],
  };

  const paymentsList: SupplierPaymentItem[] = paymentsQueryData?.data?.items || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <HasPermission code="supplier_payment.report">
      <div className="space-y-6 print:p-0">
        <PageHeader
          title="Supplier Payment Report"
          description="Analytical report on supplier disbursements, payment channel volume, daily timeline, and voucher audit trail."
          action={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4 text-primary" />
                Print / Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportSupplierPaymentsCSV(paymentsList, "supplier_payment_report.csv")}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-500" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportSupplierPaymentsExcel(paymentsList, "supplier_payment_report.xls")}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-blue-500" />
                Export Excel
              </Button>
              <Button asChild variant="default" size="sm">
                <Link href="/supplier-payments">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Manage Supplier Payments
                </Link>
              </Button>
            </div>
          }
        />

        {/* 1. Filter Presets Bar */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Presets */}
              <div className="flex flex-wrap items-center gap-1.5 bg-accent/40 p-1 rounded-xl border">
                {[
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "this_week", label: "This Week" },
                  { id: "this_month", label: "This Month" },
                  { id: "date_wise", label: "Date Wise" },
                  { id: "custom", label: "Date Range" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setPresetFilter(preset.id);
                      if (preset.id !== "custom") {
                        setStartDate("");
                        setEndDate("");
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      presetFilter === preset.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Pickers & Method Filter */}
            {(presetFilter === "custom" || presetFilter === "date_wise") && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t">
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold block mb-1">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none"
                  >
                    <option value="">All Channels</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                    <option value="mobile_wallet">Mobile Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Search Supplier / Voucher</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Supplier name, Voucher #..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. KPI Summary Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase block">Total Disbursed</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-emerald-500 ">
                  {formatCurrency(summary.total_paid_amount)}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Total Vouchers</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <span className="text-xl font-extrabold text-foreground ">
                  {summary.total_payments_count}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Today's Payments</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-foreground ">
                  {formatCurrency(summary.today_amount)}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Yesterday</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-foreground ">
                  {formatCurrency(summary.yesterday_amount)}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">This Week</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-foreground ">
                  {formatCurrency(summary.this_week_amount)}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">This Month</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-foreground ">
                  {formatCurrency(summary.this_month_amount)}
                </span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 3. Payment Method Distribution & Daily Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Channel Breakdown */}
          <Card className="glass-card md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-500" />
                Payment Method Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {Object.keys(summary.payment_method_breakdown).length === 0 ? (
                <p className="text-xs text-muted-foreground">No payments recorded in period.</p>
              ) : (
                Object.entries(summary.payment_method_breakdown).map(([method, amt]) => {
                  const pct = summary.total_paid_amount > 0 ? (amt / summary.total_paid_amount) * 100 : 0;
                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="uppercase text-muted-foreground">{method.replace("_", " ")}</span>
                        <span className="text-emerald-500">{formatCurrency(amt)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full bg-accent/60 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Daily Timeline */}
          <Card className="glass-card md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Daily Supplier Payment Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Date-wise breakdown of total disbursements and voucher count.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                    <th className="p-3">Date</th>
                    <th className="p-3 text-center">Vouchers Count</th>
                    <th className="p-3 text-right">Total Amount Paid ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.daily_breakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-muted-foreground">
                        No daily payment activity recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    summary.daily_breakdown.map((row) => (
                      <tr key={row.date} className="hover:bg-accent/40 transition-colors">
                        <td className="p-3 font-semibold text-foreground">{row.date}</td>
                        <td className="p-3 text-center ">{row.count}</td>
                        <td className="p-3 text-right font-bold text-emerald-500">
                          {formatCurrency(row.total_amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* 4. Detailed Supplier Payment Log Table */}
        <Card className="glass-card">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              Detailed Supplier Payment Vouchers Log ({paymentsList.length} vouchers)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                  <th className="p-3">Payment Voucher #</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-right">Amount Paid ($)</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isListLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : paymentsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No supplier payment vouchers found for selected date range and filters.
                    </td>
                  </tr>
                ) : (
                  paymentsList.map((pay) => (
                    <tr key={pay.id} className="hover:bg-accent/40 transition-colors">
                      <td className="p-3 font-bold text-emerald-500">{pay.payment_no}</td>
                      <td className="p-3 text-muted-foreground ">{formatDate(pay.payment_date)}</td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{pay.supplier?.name || "N/A"}</div>
                        <div className="text-[10px] text-muted-foreground ">
                          {pay.supplier?.supplier_code} • {pay.supplier?.phone}
                        </div>
                      </td>
                      <td className="p-3 text-right font-extrabold text-emerald-500 text-sm">{formatCurrency(pay.amount)}</td>
                      <td className="p-3 uppercase text-[10px]">{pay.payment_method}</td>
                      <td className="p-3 text-muted-foreground">{pay.reference_no || "-"}</td>
                      <td className="p-3 text-muted-foreground">{pay.user?.full_name || pay.user?.username || "System"}</td>
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
