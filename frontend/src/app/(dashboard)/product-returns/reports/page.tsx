"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  Search,
  RotateCcw,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { HasPermission } from "@/providers/auth-provider";
import { productReturnService } from "@/services/api";
import { ProductReturnItem, ProductReturnReportSummaryData } from "@/types";
import {
  formatCurrency,
  formatDate,
  exportProductReturnsCSV,
  exportProductReturnsExcel,
} from "@/components/product-returns/product-return-export-utils";

export default function ProductReturnReportPage() {
  const [presetFilter, setPresetFilter] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query Report Summary
  const { data: reportQueryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: [
      "product-return-report-summary",
      presetFilter,
      startDate,
      endDate,
      debouncedSearch,
    ],
    queryFn: () =>
      productReturnService.getProductReturnReports({
        preset_range: presetFilter !== "custom" ? presetFilter : undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        search: debouncedSearch || undefined,
      }),
  });

  // Query Report List of Product Returns
  const { data: returnsQueryData, isLoading: isListLoading } = useQuery({
    queryKey: [
      "product-return-report-list",
      presetFilter,
      startDate,
      endDate,
      debouncedSearch,
    ],
    queryFn: () =>
      productReturnService.getProductReturns({
        size: 100,
        search: debouncedSearch || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      }),
  });

  const summary: ProductReturnReportSummaryData = reportQueryData?.data || {
    total_returns_count: 0,
    total_returned_amount: 0,
    total_refund_received: 0,
    today_amount: 0,
    yesterday_amount: 0,
    this_week_amount: 0,
    this_month_amount: 0,
    daily_breakdown: [],
  };

  const returnsList: ProductReturnItem[] = returnsQueryData?.data?.items || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <HasPermission code="product_return.report">
      <div className="space-y-6 print:p-0">
        <PageHeader
          title="Supplier Product Return Report"
          description="Analytical report on product returns to suppliers, inventory stock reduction volume, cash refunds received, and daily return timeline."
          action={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4 text-primary" />
                Print / Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportProductReturnsCSV(returnsList, "product_return_report.csv")}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-500" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportProductReturnsExcel(returnsList, "product_return_report.xls")}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-blue-500" />
                Export Excel
              </Button>
              <Button asChild variant="default" size="sm">
                <Link href="/product-returns">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Manage Product Returns
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

            {/* Custom Date Pickers & Search */}
            {(presetFilter === "custom" || presetFilter === "date_wise") && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
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
                  <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Search Supplier / Voucher</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Supplier name, Return #..."
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
          <Card className="glass-card border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-blue-600 uppercase block">Total Returned Value</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-blue-500 ">
                  {formatCurrency(summary.total_returned_amount)}
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
                  {summary.total_returns_count}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase block">Refund Received</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-emerald-500 ">
                  {formatCurrency(summary.total_refund_received)}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Today's Returns</span>
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

        {/* 3. Daily Timeline Table */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Daily Product Return Timeline
            </CardTitle>
            <CardDescription className="text-xs">
              Date-wise summary of product returned value and voucher volume to suppliers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                  <th className="p-3">Date</th>
                  <th className="p-3 text-center">Vouchers Count</th>
                  <th className="p-3 text-right">Total Returned Value ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.daily_breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-muted-foreground">
                      No daily return activity recorded for this period.
                    </td>
                  </tr>
                ) : (
                  summary.daily_breakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-accent/40 transition-colors">
                      <td className="p-3 font-semibold text-foreground">{row.date}</td>
                      <td className="p-3 text-center ">{row.count}</td>
                      <td className="p-3 text-right font-bold text-blue-500">
                        {formatCurrency(row.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 4. Detailed Product Return Log Table */}
        <Card className="glass-card">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-blue-500" />
              Detailed Product Return Vouchers Log ({returnsList.length} vouchers)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                  <th className="p-3">Return Voucher #</th>
                  <th className="p-3">Return Date</th>
                  <th className="p-3">PO / Invoice #</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-center">Items Count</th>
                  <th className="p-3 text-right">Grand Total ($)</th>
                  <th className="p-3 text-right">Refund Received ($)</th>
                  <th className="p-3">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isListLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : returnsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No product return vouchers found for selected date range and filters.
                    </td>
                  </tr>
                ) : (
                  returnsList.map((ret) => (
                    <tr key={ret.id} className="hover:bg-accent/40 transition-colors">
                      <td className="p-3 font-bold text-blue-500">{ret.return_no}</td>
                      <td className="p-3 text-muted-foreground ">{formatDate(ret.return_date)}</td>
                      <td className="p-3 font-semibold text-primary">{ret.purchase?.purchase_no || ret.purchase?.invoice_no || "-"}</td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{ret.supplier?.name || "N/A"}</div>
                        <div className="text-[10px] text-muted-foreground ">
                          {ret.supplier?.supplier_code} • {ret.supplier?.phone}
                        </div>
                      </td>
                      <td className="p-3 text-center font-semibold">{ret.items?.length || 0}</td>
                      <td className="p-3 text-right font-bold text-foreground">{formatCurrency(ret.grand_total)}</td>
                      <td className="p-3 text-right font-bold text-blue-600">{formatCurrency(ret.refund_received)}</td>
                      <td className="p-3 text-muted-foreground">{ret.user?.full_name || ret.user?.username || "System"}</td>
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
