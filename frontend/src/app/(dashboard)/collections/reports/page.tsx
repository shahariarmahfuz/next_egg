"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  Search,
  Wallet,
  CreditCard,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { HasPermission } from "@/providers/auth-provider";
import { collectionService } from "@/services/api";
import { CustomerCollectionItem, CollectionReportSummaryData } from "@/types";
import {
  formatCurrency,
  formatDate,
  exportCollectionsCSV,
  exportCollectionsExcel,
} from "@/components/collections/collection-export-utils";

export default function CollectionReportPage() {
  const [presetFilter, setPresetFilter] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query Report Summary
  const { data: reportQueryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: [
      "collection-report-summary",
      presetFilter,
      startDate,
      endDate,
      debouncedSearch,
      paymentMethod,
    ],
    queryFn: () =>
      collectionService.getCollectionReports({
        preset_range: presetFilter !== "custom" ? presetFilter : undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        search: debouncedSearch || undefined,
        payment_method: paymentMethod !== "all" ? paymentMethod : undefined,
      }),
  });

  // Query Report List of Collections
  const { data: collectionsQueryData, isLoading: isListLoading } = useQuery({
    queryKey: [
      "collection-report-list",
      presetFilter,
      startDate,
      endDate,
      debouncedSearch,
      paymentMethod,
    ],
    queryFn: () =>
      collectionService.getCollections({
        size: 100,
        search: debouncedSearch || undefined,
        payment_method: paymentMethod !== "all" ? paymentMethod : undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      }),
  });

  const summary: CollectionReportSummaryData = reportQueryData?.data || {
    total_collections_count: 0,
    total_collected_amount: 0,
    today_amount: 0,
    yesterday_amount: 0,
    this_week_amount: 0,
    this_month_amount: 0,
    payment_method_breakdown: [],
    daily_breakdown: [],
  };

  const collectionsList: CustomerCollectionItem[] = collectionsQueryData?.data?.items || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <HasPermission code="collection.report">
      <div className="space-y-6 print:p-0">
        <PageHeader
          title="Customer Collection Report"
          description="Comprehensive analytical report on customer due payments, collection breakdown by payment methods, and timeline activity."
          action={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4 text-primary" />
                Print / Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCollectionsCSV(collectionsList, "collection_report.csv")}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-500" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCollectionsExcel(collectionsList, "collection_report.xls")}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-blue-500" />
                Export Excel
              </Button>
              <Button asChild variant="default" size="sm">
                <Link href="/collections">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Manage Collections
                </Link>
              </Button>
            </div>
          }
        />

        {/* 1. Filter Preset Buttons & Controls */}
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

              {/* Payment Method Selector */}
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-44 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="mobile_banking">Mobile Banking</option>
              </select>
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
                  <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Search Customer / Voucher</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Customer, Voucher #..."
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
              <span className="text-[11px] font-semibold text-emerald-600 uppercase block">Total Collected</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-emerald-500 ">
                  {formatCurrency(summary.total_collected_amount)}
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
                  {summary.total_collections_count}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Today's Collection</span>
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

        {/* 3. Payment Method Breakdown & Daily Timeline Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Method Distribution */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Method Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Collection volume distributed by payment channel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {summary.payment_method_breakdown.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No payment method breakdown available for this range.
                </div>
              ) : (
                summary.payment_method_breakdown.map((pm) => {
                  const percentage =
                    summary.total_collected_amount > 0
                      ? (pm.total_amount / summary.total_collected_amount) * 100
                      : 0;
                  return (
                    <div key={pm.payment_method} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="capitalize text-foreground flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase ">
                            {pm.payment_method.replace("_", " ")}
                          </Badge>
                          ({pm.count} vouchers)
                        </span>
                        <span className="font-bold text-emerald-500">
                          {formatCurrency(pm.total_amount)} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Daily Collection Timeline */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Daily Collection Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Date-wise breakdown of collected dues and transaction counts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                    <th className="p-3">Date</th>
                    <th className="p-3 text-center">Vouchers Count</th>
                    <th className="p-3 text-right">Total Amount ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.daily_breakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-muted-foreground">
                        No daily activity recorded.
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

        {/* 4. Detailed Collection Vouchers Table */}
        <Card className="glass-card">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Detailed Collection Log ({collectionsList.length} vouchers)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Voucher #</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Collection Date</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Name</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Contact Number</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Address</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Collected Amount</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Payment Channel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isListLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="h-10">
                      <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : collectionsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No collection vouchers found for selected date range and filters.
                    </td>
                  </tr>
                ) : (
                  collectionsList.map((col, index) => (
                    <tr key={col.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">{index + 1}</td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">{col.collection_no}</td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">{formatDate(col.collection_date)}</td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={col.customer?.name || "N/A"}>
                        {col.customer?.name || "N/A"}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                        {col.customer?.phone || "-"}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap max-w-[220px] truncate" title={col.customer?.address || "-"}>
                        {col.customer?.address || "-"}
                      </td>
                      <td className="px-3 py-2 align-middle text-right font-semibold text-emerald-500 whitespace-nowrap">{formatCurrency(col.amount)}</td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <Badge variant="outline" className="capitalize text-[10px] py-0 px-2 h-5">
                          {col.payment_method.replace("_", " ")}
                        </Badge>
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
