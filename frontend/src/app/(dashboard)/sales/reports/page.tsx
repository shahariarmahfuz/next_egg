"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Search,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  DollarSign,
  ShoppingCart,
  ArrowLeft,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { saleService } from "@/services/api";
import { SaleItem, SaleReportSummaryData } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { SaleViewModal } from "@/components/sales/sale-view-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate } from "@/utils/formatters";

export default function SaleReportPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("month");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [viewingSale, setViewingSale] = useState<SaleItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Compute ISO Start/End Dates based on preset selection
  const getDateRange = () => {
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { start_date: start, end_date: undefined };
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString();
      return { start_date: start, end_date: end };
    } else if (dateFilter === "week") {
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()).toISOString();
      return { start_date: start, end_date: undefined };
    } else if (dateFilter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return { start_date: start, end_date: undefined };
    } else if (dateFilter === "year") {
      const start = new Date(now.getFullYear(), 0, 1).toISOString();
      return { start_date: start, end_date: undefined };
    } else if (dateFilter === "custom" && customStartDate) {
      return {
        start_date: new Date(customStartDate).toISOString(),
        end_date: customEndDate ? new Date(customEndDate).toISOString() : undefined,
      };
    }
    return { start_date: undefined, end_date: undefined };
  };

  const { start_date, end_date } = getDateRange();

  // Fetch Report Summary Cards Metrics
  const { data: reportSummaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["sales-report-summary", debouncedSearch, dateFilter, customStartDate, customEndDate],
    queryFn: () =>
      saleService.getSaleReports({
        search: debouncedSearch || undefined,
        start_date,
        end_date,
      }),
  });

  // Fetch Server-Side Paginated & Filtered Sales
  const { data: salesData, isLoading: isSalesLoading } = useQuery({
    queryKey: ["sales-report-list", page, debouncedSearch, sortBy, dateFilter, customStartDate, customEndDate],
    queryFn: () =>
      saleService.getSales({
        page,
        size: 15,
        search: debouncedSearch || undefined,
        start_date,
        end_date,
        sort_by: sortBy,
      }),
  });

  const summary: SaleReportSummaryData = reportSummaryData?.data || {
    total_sales: 0,
    total_sale_amount: 0,
    total_discount: 0,
    total_paid: 0,
    total_due: 0,
    total_items_sold: 0,
  };

  const sales: SaleItem[] = salesData?.data?.items || [];
  const totalPages = salesData?.data?.pages || 1;

  // Export File Generators
  const handleExportCSV = () => {
    if (sales.length === 0) return;

    const headers = ["Invoice No", "Sale Date", "Customer Name", "Customer Phone", "Line Items", "Grand Total", "Paid Amount", "Due Amount", "Payment Status"];
    const rows = sales.map((s) => [
      `"${s.invoice_no}"`,
      `"${formatDate(s.sale_date)}"`,
      `"${s.customer?.name || "Cash Customer"}"`,
      `"${s.customer?.phone || ""}"`,
      s.items?.length || 0,
      s.grand_total,
      s.paid_amount,
      s.due_amount,
      `"${s.payment_status}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <HasPermission code="sales.report.view">
      <div className="space-y-6 print:p-0">
        <PageHeader
          title="Sales Executive Report"
          description="Comprehensive analytical report covering revenue, customer due balances, line discounts, and item volumes."
          action={
            <div className="flex flex-wrap space-x-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4 text-primary" />
                Print Report
              </Button>

              <HasPermission code="sales.report.export">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-500" />
                  Export CSV / Excel
                </Button>
              </HasPermission>

              <Button asChild variant="default" size="sm">
                <Link href="/sales">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Manage Sales
                </Link>
              </Button>
            </div>
          }
        />

        {/* 6 Summary Cards (KPIs) */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Total Sales</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <span className="text-xl font-extrabold text-foreground">{summary.total_sales}</span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Total Revenue</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-primary ">{formatCurrency(summary.total_sale_amount)}</span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Total Discount</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span className="text-xl font-extrabold text-amber-500 ">{formatCurrency(summary.total_discount)}</span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Total Collected</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-emerald-500 ">{formatCurrency(summary.total_paid)}</span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Total Outstanding Due</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-xl font-extrabold text-amber-500 ">{formatCurrency(summary.total_due)}</span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Items Sold Volume</span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <span className="text-xl font-extrabold text-foreground ">{summary.total_items_sold}</span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters and Sorting Bar */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoice #, customer name, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                {/* Date Filter Preset */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Date Range</option>
                </select>

                {/* Sort By Selector */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest_amount">Highest Amount</option>
                  <option value="lowest_amount">Lowest Amount</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range Pickers */}
            {dateFilter === "custom" && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs">
                <span className="font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Start Date:
                </span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 w-40 text-xs"
                />
                <span className="font-medium text-muted-foreground">End Date:</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 w-40 text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card className="glass-card overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Invoice #</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer</th>
                  <th className="px-3 py-2.5 align-middle text-center whitespace-nowrap">Items</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Grand Total</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Paid</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Due</th>
                  <th className="px-3 py-2.5 align-middle w-[120px] text-right whitespace-nowrap print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isSalesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="h-10">
                      <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle text-right print:hidden"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No sales records found matching the report filter parameters.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale, index) => (
                    <tr key={sale.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {sale.invoice_no}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatDate(sale.sale_date)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="font-semibold text-foreground">{sale.customer?.name || "Walk-in Cash Customer"}</div>
                        {sale.customer?.phone && (
                          <div className="text-[10px] text-muted-foreground">{sale.customer.phone}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle text-center whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] py-0 px-2 h-5">
                          {sale.items?.length || 0}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-xs font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(sale.grand_total)}
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-xs font-semibold text-emerald-500 whitespace-nowrap">
                        {formatCurrency(sale.paid_amount)}
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-xs font-semibold text-amber-500 whitespace-nowrap">
                        {formatCurrency(sale.due_amount)}
                      </td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1 print:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewingSale(sale)}
                          title="View Invoice Profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-muted/20 print:hidden">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* View Modal */}
        <SaleViewModal
          sale={viewingSale}
          isOpen={!!viewingSale}
          onClose={() => setViewingSale(null)}
        />
      </div>
    </HasPermission>
  );
}
