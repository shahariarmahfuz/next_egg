"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  ShoppingCart,
  Eye,
  Edit,
  Trash2,
  Printer,
  Calendar,
  Filter,
} from "lucide-react";
import { saleService } from "@/services/api";
import { SaleItem } from "@/types";
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

import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function ManageSalesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [viewingSale, setViewingSale] = useState<SaleItem | null>(null);
  const [hardDeletingSale, setHardDeletingSale] = useState<SaleItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Compute ISO Start/End Dates based on preset selection
  const getDateRange = () => {
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { start_date: start, end_date: undefined };
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(now.setDate(now.getDate() - 1));
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
    } else if (dateFilter === "custom" && customStartDate) {
      return {
        start_date: new Date(customStartDate).toISOString(),
        end_date: customEndDate ? new Date(customEndDate).toISOString() : undefined,
      };
    }
    return { start_date: undefined, end_date: undefined };
  };

  const { start_date, end_date } = getDateRange();

  // Fetch Server-Side Paginated Sales
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["sales", page, debouncedSearch, paymentStatus, dateFilter, customStartDate, customEndDate],
    queryFn: () =>
      saleService.getSales({
        page,
        size: 15,
        search: debouncedSearch || undefined,
        payment_status: paymentStatus || undefined,
      }),
  });

  const sales: SaleItem[] = salesData?.data?.items || [];
  const totalPages = salesData?.data?.pages || 1;
  const pageSize = 15;

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (saleId: string) => saleService.deleteSale(saleId),
    onSuccess: () => {
      toast.success("Sale invoice deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete sale invoice.";
      toast.error(msg);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (saleId: string) => saleService.hardDeleteSale(saleId),
    onSuccess: () => {
      toast.success("Sale invoice and all linked returns/collections deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingSale(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete sale invoice.";
      toast.error(msg);
    },
  });

  const handleDelete = (sale: SaleItem) => {
    if (confirm("Are you sure you want to delete this sale?")) {
      deleteMutation.mutate(sale.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="success" className="capitalize text-[10px]">Paid</Badge>;
      case "partial":
        return <Badge variant="warning" className="capitalize text-[10px]">Partial</Badge>;
      default:
        return <Badge variant="destructive" className="capitalize text-[10px]">Unpaid</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Sales"
        description="Monitor sales orders, track payments and due balances, print invoices, and update transactions."
        action={
          <HasPermission code="sales.create">
            <Button asChild>
              <Link href="/sales/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Sale
              </Link>
            </Button>
          </HasPermission>
        }
      />

      {/* Filter and Server-Side Search Bar */}
      <Card className="glass-card">
        <CardContent className="p-4 space-y-4">
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
              {/* Payment Status Selector */}
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Payment Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>

              {/* Date Filter Selector */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Pickers if selected */}
          {dateFilter === "custom" && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Start Date:
              </span>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 w-40 text-xs"
              />
              <span className="text-xs font-medium text-muted-foreground">End Date:</span>
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

      {/* Sales Invoices Directory Table */}
      <Card className="glass-card overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Invoice #</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Total Amount</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Paid Amount</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Due Amount</th>
                <th className="px-3 py-2.5 align-middle w-[110px] whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 align-middle w-[140px] text-right whitespace-nowrap">Actions</th>
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
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No sales invoices found matching your query criteria.
                  </td>
                </tr>
              ) : (
                sales.map((sale, index) => {
                  const serialNumber = (page - 1) * pageSize + index + 1;

                  return (
                    <tr key={sale.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {sale.invoice_no}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                        {formatDate(sale.sale_date)}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={sale.customer?.name || "Walk-in Cash Customer"}>
                        {sale.customer?.name || "Walk-in Cash Customer"}
                      </td>
                      <td className="px-3 py-2 align-middle font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(sale.grand_total)}
                      </td>
                      <td className="px-3 py-2 align-middle font-semibold text-emerald-500 whitespace-nowrap">
                        {formatCurrency(sale.paid_amount)}
                      </td>
                      <td className="px-3 py-2 align-middle font-semibold text-amber-500 whitespace-nowrap">
                        {formatCurrency(sale.due_amount)}
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        {getStatusBadge(sale.payment_status)}
                      </td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewingSale(sale)}
                          title="View Sale Invoice Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Print Invoice (A4/A5/POS 80mm)">
                          <Link href={`/sales/${sale.id}/print`}>
                            <Printer className="h-3.5 w-3.5 text-primary" />
                          </Link>
                        </Button>

                        <HasPermission code="sales.edit">
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Edit Sale Invoice">
                            <Link href={`/sales/${sale.id}/edit`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </HasPermission>

                        <HasPermission code="sales.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(sale.id)}
                            title="Normal Delete (Restores stock & customer balance)"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHardDeletingSale(sale)}
                            title="Hard Delete (Permanently remove invoice & all dependent returns/collections)"
                            className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5 fill-rose-600/20" />
                          </Button>
                        </HasPermission>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
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

      {/* Controlled Hard Delete Confirmation Modal */}
      <HardDeleteModal
        isOpen={!!hardDeletingSale}
        onClose={() => setHardDeletingSale(null)}
        onConfirm={async () => {
          if (hardDeletingSale) {
            await hardDeleteMutation.mutateAsync(hardDeletingSale.id);
          }
        }}
        entityType="Sale Invoice"
        entityName={`Invoice #${hardDeletingSale?.invoice_no || ""} (${hardDeletingSale?.customer?.name || "Walk-in Customer"})`}
        affectedItems={[
          "All items in this sales invoice",
          "Linked customer collection vouchers",
          "Sale return vouchers & returned item logs",
          "Customer ledger balance history",
        ]}
        isDeleting={hardDeleteMutation.isPending}
      />

      {/* Sale View Modal */}
      <SaleViewModal
        sale={viewingSale}
        isOpen={!!viewingSale}
        onClose={() => setViewingSale(null)}
      />
    </div>
  );
}
