"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  DollarSign,
  ShoppingBag,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { purchaseService } from "@/services/api";
import { PurchaseItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { formatCurrency, formatDate } from "@/utils/formatters";

export default function PurchaseReportsPage() {
  const [reportType, setReportType] = useState<"today" | "date_wise" | "date_range" | "monthly">("today");
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["purchase-report", reportType, targetDate, startDate, endDate, month, year],
    queryFn: () =>
      purchaseService.getPurchaseReports({
        report_type: reportType,
        target_date: reportType === "date_wise" ? targetDate : undefined,
        start_date: reportType === "date_range" ? startDate : undefined,
        end_date: reportType === "date_range" ? endDate : undefined,
        month: reportType === "monthly" ? month : undefined,
        year: reportType === "monthly" ? year : undefined,
      }),
  });

  const summary = reportData?.data;
  const purchases: PurchaseItem[] = summary?.purchases || [];

  return (
    <HasPermission code="purchase.report">
      <div className="space-y-6">
        <PageHeader
          title="Purchase Executive Report"
          description="Analyze procurement performance, total expenditure, supplier payment settlements, and outstanding dues."
          action={
            <Button asChild variant="outline">
              <Link href="/purchases">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Purchases
              </Link>
            </Button>
          }
        />

        {/* Report Timeframe Selector Tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-muted/40 rounded-xl border max-w-fit">
          <Button
            variant={reportType === "today" ? "default" : "ghost"}
            size="sm"
            onClick={() => setReportType("today")}
          >
            Today
          </Button>
          <Button
            variant={reportType === "date_wise" ? "default" : "ghost"}
            size="sm"
            onClick={() => setReportType("date_wise")}
          >
            Date Wise
          </Button>
          <Button
            variant={reportType === "date_range" ? "default" : "ghost"}
            size="sm"
            onClick={() => setReportType("date_range")}
          >
            Date Range
          </Button>
          <Button
            variant={reportType === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setReportType("monthly")}
          >
            Monthly
          </Button>
        </div>

        {/* Dynamic Filter Controls */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <Filter className="h-4 w-4 text-primary" />

              {reportType === "date_wise" && (
                <div className="flex items-center space-x-2">
                  <span>Select Date:</span>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="h-9 w-40 text-xs"
                  />
                </div>
              )}

              {reportType === "date_range" && (
                <div className="flex flex-wrap items-center space-x-2">
                  <span>Start Date:</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-40 text-xs"
                  />
                  <span>End Date:</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-40 text-xs"
                  />
                </div>
              )}

              {reportType === "monthly" && (
                <div className="flex items-center space-x-2">
                  <span>Month:</span>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2026, i, 1).toLocaleString("default", { month: "long" })}
                      </option>
                    ))}
                  </select>

                  <span>Year:</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="ml-auto text-xs text-muted-foreground ">
                Report Period: <span className="font-bold text-foreground">{summary?.period || "Loading..."}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Total Orders</span>
                <span className="text-2xl font-extrabold text-foreground">
                  {summary?.total_purchases ?? 0}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Total Purchase Amount</span>
                <span className="text-2xl font-extrabold text-foreground">
                  {formatCurrency(summary?.total_amount || 0)}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Total Settled / Paid</span>
                <span className="text-2xl font-extrabold text-emerald-500">
                  {formatCurrency(summary?.total_paid || 0)}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Total Outstanding Due</span>
                <span className="text-2xl font-extrabold text-amber-500">
                  {formatCurrency(summary?.total_due || 0)}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Purchase Report Table */}
        <Card className="glass-card overflow-hidden w-full">
          <div className="p-4 border-b font-semibold text-sm">
            Detailed Purchase Statement ({purchases.length} records)
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">PO Number</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Subtotal</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Grand Total</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Paid</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Due</th>
                  <th className="px-3 py-2.5 align-middle w-[110px] whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="h-10">
                      <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-16" /></td>
                    </tr>
                  ))
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No purchase orders recorded for the selected report period.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase, index) => (
                    <tr key={purchase.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {purchase.purchase_no}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap">
                        {purchase.supplier?.name || "Supplier"}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(purchase.purchase_date)}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {formatCurrency(purchase.subtotal)}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(purchase.grand_total)}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs font-semibold text-emerald-500 whitespace-nowrap">
                        {formatCurrency(purchase.paid_amount)}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs font-semibold text-amber-500 whitespace-nowrap">
                        {formatCurrency(purchase.due_amount)}
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <Badge
                          variant={
                            purchase.payment_status === "paid"
                              ? "success"
                              : purchase.payment_status === "partial"
                              ? "warning"
                              : "secondary"
                          }
                          className="capitalize text-[10px] py-0 px-2 h-5"
                        >
                          {purchase.payment_status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </HasPermission>
  );
}
