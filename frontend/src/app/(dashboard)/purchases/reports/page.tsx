"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye } from "lucide-react";
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
import { formatCurrency, formatDate } from "@/utils/formatters";

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
  const aggregate = purchasesData?.data?.aggregate || { total_amount: 0, paid_amount: 0, due_amount: 0 };

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
        <div className="flex items-center space-x-3 bg-card p-2 rounded-lg border shadow-sm">
          <div className="flex items-center space-x-2">
            <Label htmlFor="start_date" className="text-xs">From</Label>
            <Input type="date" id="start_date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto h-8 text-xs" />
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="end_date" className="text-xs">To</Label>
            <Input type="date" id="end_date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="glass-card border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Total Purchases</div>
            <div className="text-xl font-extrabold text-purple-500">{formatCurrency(aggregate.total_amount)}</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Paid</div>
            <div className="text-xl font-extrabold text-emerald-500">{formatCurrency(aggregate.paid_amount)}</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Total Due</div>
            <div className="text-xl font-extrabold text-orange-500">{formatCurrency(aggregate.due_amount)}</div>
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
