"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye, ShoppingCart, CircleCheck, CircleAlert, Boxes, Calendar, ArrowRight } from "lucide-react";
import { purchaseService } from "@/services/api";
import { PurchaseItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { PurchaseViewModal } from "@/components/purchases/purchase-view-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${day} ${MONTH_NAMES[monthIdx]} ${year}`;
}

export default function PurchasesReportPage() {
  const today = new Date().toLocaleDateString('en-CA');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: purchasesData, isLoading } = useQuery({
    queryKey: ["purchases-reports", page, debouncedSearch, paymentStatus, startDate, endDate],
    queryFn: () =>
      purchaseService.getPurchases({
        page,
        size: 15,
        search: debouncedSearch || undefined,
        payment_status: paymentStatus || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
  });

  const purchases: PurchaseItem[] = purchasesData?.data?.items || [];
  const totalPages = purchasesData?.data?.pages || 1;
  const pageSize = 15;
  const aggregate = purchasesData?.data?.aggregate || {};
  const totalPurchases = aggregate.total_purchases ?? aggregate.total_amount ?? aggregate.total_purchase_amount ?? 0;
  const totalPaid = aggregate.total_paid ?? aggregate.paid_amount ?? 0;
  const totalDue = aggregate.total_due ?? aggregate.due_amount ?? 0;
  const totalQuantity = aggregate.total_quantity ?? aggregate.total_units ?? aggregate.total_items_purchased ?? 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">Paid</Badge>;
      case "partial":
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Partial</Badge>;
      case "due":
        return <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/20">Due</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader title="Purchase Report" description="Comprehensive report of all purchase transactions." />
        <div className="flex items-center w-full md:w-auto justify-between md:justify-start gap-1.5 sm:gap-2 p-1 sm:p-1.5 bg-card dark:bg-card/90 rounded-xl border border-border/80 dark:border-border/60 shadow-xs dark:shadow-none">
          {/* FROM Date Field */}
          <div className="relative flex-1 md:flex-initial md:w-40 flex items-center min-w-0 bg-background dark:bg-muted/30 hover:bg-muted/40 dark:hover:bg-muted/50 transition-colors border border-border/70 dark:border-border/60 rounded-lg px-2.5 py-1.5 shadow-2xs dark:shadow-none cursor-pointer group focus-within:ring-2 focus-within:ring-primary/30">
            <input
              type="date"
              id="start_date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker?.();
                } catch {}
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="From date"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <Label htmlFor="start_date" className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-1 cursor-pointer">
                FROM
              </Label>
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <span className="text-xs sm:text-[13px] font-semibold text-foreground tracking-tight truncate">
                  {formatDisplayDate(startDate) || "Select date"}
                </span>
              </div>
            </div>
          </div>

          {/* Separator Arrow */}
          <div className="text-muted-foreground/50 shrink-0 px-0.5 sm:px-1" aria-hidden="true">
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>

          {/* TO Date Field */}
          <div className="relative flex-1 md:flex-initial md:w-40 flex items-center min-w-0 bg-background dark:bg-muted/30 hover:bg-muted/40 dark:hover:bg-muted/50 transition-colors border border-border/70 dark:border-border/60 rounded-lg px-2.5 py-1.5 shadow-2xs dark:shadow-none cursor-pointer group focus-within:ring-2 focus-within:ring-primary/30">
            <input
              type="date"
              id="end_date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker?.();
                } catch {}
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="To date"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <Label htmlFor="end_date" className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-1 cursor-pointer">
                TO
              </Label>
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <span className="text-xs sm:text-[13px] font-semibold text-foreground tracking-tight truncate">
                  {formatDisplayDate(endDate) || "Select date"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6">
        <Card className="bg-white border-purple-500/20 shadow-xs dark:bg-purple-950/25 dark:border-purple-900/35 dark:shadow-none sm:dark:bg-purple-950/20 sm:dark:border-purple-900/30 min-w-0 rounded-xl">
          <CardContent className="p-2.5 sm:p-4 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold text-purple-600 dark:text-purple-300 sm:dark:text-purple-300 uppercase tracking-wider truncate">Total Purchases</span>
              <div className="h-5 w-5 rounded-md bg-purple-500/10 dark:bg-purple-950/50 flex items-center justify-center shrink-0 sm:hidden">
                <ShoppingCart className="h-3.5 w-3.5 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
            <div className="text-[18px] sm:text-xl font-bold sm:font-extrabold tracking-tight text-purple-600 dark:text-purple-200 sm:dark:text-purple-200 truncate" title={formatCurrency(totalPurchases)}>{formatCurrency(totalPurchases)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-emerald-500/20 shadow-xs dark:bg-emerald-950/25 dark:border-emerald-900/35 dark:shadow-none sm:dark:bg-emerald-950/20 sm:dark:border-emerald-900/30 min-w-0 rounded-xl">
          <CardContent className="p-2.5 sm:p-4 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-300 sm:dark:text-emerald-300 uppercase tracking-wider truncate">Total Paid</span>
              <div className="h-5 w-5 rounded-md bg-emerald-500/10 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 sm:hidden">
                <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
              </div>
            </div>
            <div className="text-[18px] sm:text-xl font-bold sm:font-extrabold tracking-tight text-emerald-600 dark:text-emerald-200 sm:dark:text-emerald-200 truncate" title={formatCurrency(totalPaid)}>{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-orange-500/20 shadow-xs dark:bg-orange-950/25 dark:border-orange-900/35 dark:shadow-none sm:dark:bg-orange-950/20 sm:dark:border-orange-900/30 min-w-0 rounded-xl">
          <CardContent className="p-2.5 sm:p-4 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold text-orange-600 dark:text-orange-300 sm:dark:text-orange-300 uppercase tracking-wider truncate">Total Due</span>
              <div className="h-5 w-5 rounded-md bg-orange-500/10 dark:bg-orange-950/50 flex items-center justify-center shrink-0 sm:hidden">
                <CircleAlert className="h-3.5 w-3.5 text-orange-600 dark:text-orange-300" />
              </div>
            </div>
            <div className="text-[18px] sm:text-xl font-bold sm:font-extrabold tracking-tight text-orange-600 dark:text-orange-200 sm:dark:text-orange-200 truncate" title={formatCurrency(totalDue)}>{formatCurrency(totalDue)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-blue-500/20 shadow-xs dark:bg-blue-950/25 dark:border-blue-900/35 dark:shadow-none sm:dark:bg-blue-950/20 sm:dark:border-blue-900/30 min-w-0 rounded-xl">
          <CardContent className="p-2.5 sm:p-4 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold text-blue-600 dark:text-blue-300 sm:dark:text-blue-300 uppercase tracking-wider truncate">Total Quantity</span>
              <div className="h-5 w-5 rounded-md bg-blue-500/10 dark:bg-blue-950/50 flex items-center justify-center shrink-0 sm:hidden">
                <Boxes className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
            <div className="text-[18px] sm:text-xl font-bold sm:font-extrabold tracking-tight text-blue-600 dark:text-blue-200 sm:dark:text-blue-200 truncate" title={formatNumber(totalQuantity)}>{formatNumber(totalQuantity)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reference or supplier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-background w-full"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
              className="flex h-10 w-full sm:w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="due">Due</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 align-middle font-medium w-[60px] text-center whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Ref No</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Supplier</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Grand Total</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Paid</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Due</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap w-[110px]">Status</th>
                <th className="px-3 py-2.5 align-middle font-medium text-right whitespace-nowrap w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-10">
                    <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-14" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                  </tr>
                ))
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No purchase orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                purchases.map((purchase, index) => {
                  const serialNumber = (page - 1) * pageSize + index + 1;
                  return (
                    <tr key={purchase.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">{serialNumber}</td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">{purchase.purchase_no}</td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">{formatDate(purchase.purchase_date)}</td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={purchase.supplier?.name || "Walk-in Vendor"}>{purchase.supplier?.name || "Walk-in Vendor"}</td>
                      <td className="px-3 py-2 align-middle font-semibold text-foreground whitespace-nowrap">{formatCurrency(purchase.grand_total)}</td>
                      <td className="px-3 py-2 align-middle font-semibold text-emerald-500 whitespace-nowrap">{formatCurrency(purchase.paid_amount)}</td>
                      <td className="px-3 py-2 align-middle font-semibold text-amber-500 whitespace-nowrap">{formatCurrency(purchase.due_amount)}</td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">{getStatusBadge(purchase.payment_status)}</td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingPurchase(purchase)} title="View Purchase Details">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <PurchaseViewModal purchase={viewingPurchase} isOpen={!!viewingPurchase} onClose={() => setViewingPurchase(null)} />
    </div>
  );
}
