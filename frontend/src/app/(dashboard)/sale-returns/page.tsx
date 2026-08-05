"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Printer,
  FileSpreadsheet,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
  Undo2,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { HasPermission } from "@/providers/auth-provider";
import { saleReturnService } from "@/services/api";
import { SaleReturnItem } from "@/types";
import {
  formatCurrency,
  formatDate,
  exportSaleReturnsCSV,
  exportSaleReturnsExcel,
  printSaleReturnVoucher,
} from "@/components/sale-returns/sale-return-export-utils";
import { SaleReturnViewModal } from "@/components/sale-returns/sale-return-view-modal";
import { SaleReturnEditModal } from "@/components/sale-returns/sale-return-edit-modal";
import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function ManageSaleReturnsPage() {
  const queryClient = useQueryClient();

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Modals state
  const [selectedViewReturn, setSelectedViewReturn] = useState<SaleReturnItem | null>(null);
  const [selectedEditReturn, setSelectedEditReturn] = useState<SaleReturnItem | null>(null);
  const [selectedDeleteReturn, setSelectedDeleteReturn] = useState<SaleReturnItem | null>(null);
  const [hardDeletingReturn, setHardDeletingReturn] = useState<SaleReturnItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query paginated sale returns
  const { data: returnsData, isLoading } = useQuery({
    queryKey: [
      "sale-returns-list",
      page,
      pageSize,
      debouncedSearch,
      sortBy,
      startDate,
      endDate,
    ],
    queryFn: () =>
      saleReturnService.getSaleReturns({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        sort_by: sortBy,
      }),
  });

  const saleReturns: SaleReturnItem[] = returnsData?.data?.items || [];
  const totalItems = returnsData?.data?.total || 0;
  const totalPages = returnsData?.data?.pages || 1;

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => saleReturnService.deleteSaleReturn(id),
    onSuccess: () => {
      toast.success("Sale return voucher deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["sale-returns-list"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setSelectedDeleteReturn(null);
      setIsDeleting(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete return voucher.";
      toast.error(msg);
      setIsDeleting(false);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => saleReturnService.hardDeleteSaleReturn(id),
    onSuccess: () => {
      toast.success("Sale return voucher deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["sale-returns-list"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingReturn(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete return voucher.";
      toast.error(msg);
    },
  });

  const handleDeleteConfirm = () => {
    if (!selectedDeleteReturn) return;
    setIsDeleting(true);
    deleteMutation.mutate(selectedDeleteReturn.id);
  };

  return (
    <HasPermission code="sale_return.view">
      <div className="space-y-6">
        <PageHeader
          title="Customer Sales Return"
          description="Process product returns from customers, track returned quantities, automatically restock inventory, and adjust customer dues."
          action={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => exportSaleReturnsCSV(saleReturns)}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-500" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportSaleReturnsExcel(saleReturns)}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-blue-500" />
                Export Excel
              </Button>
              <HasPermission code="sale_return.create">
                <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20">
                  <Link href="/sale-returns/new">
                    <Undo2 className="mr-1.5 h-4 w-4" />
                    Add Sale Return
                  </Link>
                </Button>
              </HasPermission>
            </div>
          }
        />

        {/* Filter Controls Bar */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Voucher # (SR-00001), Customer Name, Phone, Code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount_desc">Highest Amount</option>
                <option value="amount_asc">Lowest Amount</option>
              </select>

              {/* Date Filters */}
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs"
                  placeholder="Start Date"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs"
                  placeholder="End Date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="glass-card">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-500" />
              Sale Return Vouchers ({totalItems})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/sale-returns/reports">
                <Button variant="ghost" size="sm" className="text-xs text-primary font-semibold">
                  View Sale Return Reports &rarr;
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Return Voucher No</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Original Invoice</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Return Date</th>
                  <th className="px-3 py-2.5 align-middle text-center whitespace-nowrap">Items Count</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Return Total</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Refund Paid</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Collector</th>
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
                      <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : saleReturns.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      No sale return vouchers found matching specified criteria.
                    </td>
                  </tr>
                ) : (
                  saleReturns.map((ret, index) => {
                    const serialNumber = (page - 1) * pageSize + index + 1;

                    return (
                      <tr key={ret.id} className="hover:bg-accent/40 transition-colors h-10">
                        <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                          {serialNumber}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-amber-500 whitespace-nowrap">
                          {ret.return_no}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                          {ret.sale?.invoice_no || "-"}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={ret.customer?.name || "N/A"}>
                          {ret.customer?.name || "N/A"}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {formatDate(ret.return_date)}
                        </td>
                        <td className="px-3 py-2 align-middle text-center font-semibold whitespace-nowrap">
                          {ret.items?.length || 0}
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-semibold text-foreground whitespace-nowrap">
                          {formatCurrency(ret.grand_total)}
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-semibold text-amber-600 whitespace-nowrap">
                          {formatCurrency(ret.refund_amount)}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {ret.user?.full_name || ret.user?.username || "System"}
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="View Voucher"
                            onClick={() => setSelectedViewReturn(ret)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Print Voucher"
                            onClick={() => printSaleReturnVoucher(ret)}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <HasPermission code="sale_return.edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Edit Return"
                              onClick={() => setSelectedEditReturn(ret)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </HasPermission>
                          <HasPermission code="sale_return.delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Normal Delete Return"
                              onClick={() => setSelectedDeleteReturn(ret)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                              title="Hard Delete Return"
                              onClick={() => setHardDeletingReturn(ret)}
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
          </CardContent>

          {/* Server-Side Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground">
                Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
                <span className="font-semibold text-foreground">{totalPages}</span> ({totalItems} total items)
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* View Modal */}
        <SaleReturnViewModal
          saleReturn={selectedViewReturn}
          isOpen={!!selectedViewReturn}
          onClose={() => setSelectedViewReturn(null)}
        />

        {/* Edit Modal */}
        <SaleReturnEditModal
          saleReturn={selectedEditReturn}
          isOpen={!!selectedEditReturn}
          onClose={() => setSelectedEditReturn(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["sale-returns-list"] });
          }}
        />

        {/* Delete Confirmation Modal */}
        {selectedDeleteReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
              onClick={() => setSelectedDeleteReturn(null)}
            />
            <div className="relative w-full max-w-md bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Delete Sale Return Voucher?
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDeleteReturn(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Deleting return voucher <span className="font-bold text-foreground ">{selectedDeleteReturn.return_no}</span> (${selectedDeleteReturn.grand_total.toFixed(2)}) will automatically decrease inventory stock back and restore the customer's original due balance.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setSelectedDeleteReturn(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Confirm & Revert Return
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Controlled Hard Delete Confirmation Modal */}
        <HardDeleteModal
          isOpen={!!hardDeletingReturn}
          onClose={() => setHardDeletingReturn(null)}
          onConfirm={async () => {
            if (hardDeletingReturn) {
              await hardDeleteMutation.mutateAsync(hardDeletingReturn.id);
            }
          }}
          entityType="Sale Return"
          entityName={`Voucher #${hardDeletingReturn?.return_no || ""} (${hardDeletingReturn?.customer?.name || "Customer"})`}
          affectedItems={[
            "Sale return voucher & returned line items",
            "Customer ledger history & balance adjustments",
          ]}
          isDeleting={hardDeleteMutation.isPending}
        />
      </div>
    </HasPermission>
  );
}
