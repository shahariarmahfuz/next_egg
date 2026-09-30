"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  PlusCircle,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ArrowDownLeft,
  Filter,
  X,
  ArrowLeft,
  Building,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { supplierOtherTransactionService, supplierService } from "@/services/api";
import { SupplierOtherTransactionItem } from "@/types/supplier_other_transaction";
import { SupplierItem } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { SupplierOtherTransactionViewModal } from "@/components/suppliers/supplier-other-transaction-view-modal";
import { SupplierOtherTransactionEditModal } from "@/components/suppliers/supplier-other-transaction-edit-modal";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function SupplierOtherTransactionManagePage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [transactionType, setTransactionType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Modals state
  const [viewingItem, setViewingItem] = useState<SupplierOtherTransactionItem | null>(null);
  const [editingItem, setEditingItem] = useState<SupplierOtherTransactionItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<SupplierOtherTransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query suppliers for filter dropdown
  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-dropdown-filter"],
    queryFn: () => supplierService.getSuppliers({ size: 100 }),
  });
  const suppliers: SupplierItem[] = suppliersData?.data?.items || [];

  // Query paginated supplier other transactions
  const {
    data: responseData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "supplier-other-transactions-list",
      page,
      pageSize,
      debouncedSearch,
      selectedSupplierId,
      transactionType,
      startDate,
      endDate,
    ],
    queryFn: () =>
      supplierOtherTransactionService.getTransactions({
        page,
        size: pageSize,
        search: debouncedSearch.trim() || undefined,
        supplier_id: selectedSupplierId || undefined,
        transaction_type: transactionType || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
      }),
  });

  const transactions: SupplierOtherTransactionItem[] = responseData?.data?.items || [];
  const totalItems = responseData?.data?.total || 0;
  const totalPages = responseData?.data?.pages || 1;

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => supplierOtherTransactionService.deleteTransaction(id),
    onSuccess: () => {
      toast.success("Other Payable transaction deleted. Supplier ledger and balance reversed.");
      queryClient.invalidateQueries({ queryKey: ["supplier-other-transactions-list"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDeletingItem(null);
      setIsDeleting(false);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to delete transaction";
      toast.error(msg);
      setIsDeleting(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    deleteMutation.mutate(deletingItem.id);
  };

  const hasActiveFilters = Boolean(
    search || selectedSupplierId || transactionType || startDate || endDate
  );

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedSupplierId("");
    setTransactionType("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const startIdx = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, totalItems);

  return (
    <HasPermission code="supplier.view">
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Supplier Other Transactions Manage"
          description="View, filter, edit, and delete operational transactions recorded outside normal purchases. All edits and deletions automatically synchronize supplier balances and ledgers."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/suppliers">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Suppliers
                </Link>
              </Button>
              <HasPermission code="supplier.create">
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
                  <Link href="/suppliers/other-transaction">
                    <PlusCircle className="mr-1.5 h-4 w-4" />
                    Record Other Payable
                  </Link>
                </Button>
              </HasPermission>
            </div>
          }
        />

        {/* Filter Bar */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Voucher # (SOT-00001), Ref #, Notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Supplier Filter */}
              <div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.supplier_code ? `(${s.supplier_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transaction Type Filter */}
              <div>
                <select
                  value={transactionType}
                  onChange={(e) => {
                    setTransactionType(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">All Types</option>
                  <option value="other_payable">Other Payable</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs h-9 px-2"
                  title="Start Date"
                />
                <span className="text-muted-foreground text-xs">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs h-9 px-2"
                  title="End Date"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-1 border-t text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Filters applied
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3 mr-1" /> Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="glass-card">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Other Transactions List ({totalItems})</span>
              {isFetching && !isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </CardTitle>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Voucher #</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Type</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Amount</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Reference #</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Recorded By</th>
                  <th className="px-3 py-2.5 align-middle w-[110px] text-right whitespace-nowrap">Actions</th>
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
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ArrowDownLeft className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-medium text-sm">No transactions found</p>
                        <p className="text-xs text-muted-foreground/80 max-w-sm">
                          {hasActiveFilters
                            ? "Try adjusting your search query, supplier, or date range filters."
                            : "No other transactions have been recorded with suppliers yet."}
                        </p>
                        {!hasActiveFilters && hasPermission("supplier.create") && (
                          <Button asChild size="sm" variant="outline" className="mt-2 text-xs">
                            <Link href="/suppliers/other-transaction">
                              <PlusCircle className="h-3.5 w-3.5 mr-1" />
                              Record First Other Payable
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, index) => {
                    const serialNumber = (page - 1) * pageSize + index + 1;

                    return (
                      <tr key={tx.id} className="hover:bg-accent/40 transition-colors h-10">
                        <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                          {serialNumber}
                        </td>
                        <td className="px-3 py-2 align-middle font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {tx.voucher_no}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.transaction_date)}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={tx.supplier?.name || "N/A"}>
                          <span>{tx.supplier?.name || "N/A"}</span>
                          {tx.supplier?.supplier_code && (
                            <span className="text-[10px] text-muted-foreground font-mono ml-1.5">
                              ({tx.supplier.supplier_code})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] uppercase py-0 px-2 h-5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                            Other Payable
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          +{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap max-w-[150px] truncate" title={tx.reference_no || "-"}>
                          {tx.reference_no || "-"}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {tx.user?.full_name || tx.user?.username || "System"}
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                          {/* View */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="View Transaction"
                            onClick={() => setViewingItem(tx)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {/* Edit */}
                          <HasPermission code="supplier.edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                              title="Edit Transaction"
                              onClick={() => setEditingItem(tx)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </HasPermission>

                          {/* Delete */}
                          <HasPermission code="supplier.delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Delete Transaction"
                              onClick={() => setDeletingItem(tx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
                Showing <span className="font-semibold text-foreground">{startIdx}</span>–
                <span className="font-semibold text-foreground">{endIdx}</span> of{" "}
                <span className="font-semibold text-foreground">{totalItems}</span> records
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const showEllipsis = prevPage && p - prevPage > 1;

                      return (
                        <div key={p} className="flex items-center">
                          {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                          <Button
                            variant={p === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(p)}
                            className="h-8 w-8 p-0 text-xs"
                          >
                            {p}
                          </Button>
                        </div>
                      );
                    })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* View Modal */}
        <SupplierOtherTransactionViewModal
          transaction={viewingItem}
          isOpen={!!viewingItem}
          onClose={() => setViewingItem(null)}
        />

        {/* Edit Modal */}
        <SupplierOtherTransactionEditModal
          transaction={editingItem}
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["supplier-other-transactions-list"] });
            queryClient.invalidateQueries({ queryKey: ["supplier-financial-summary"] });
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["supplier-ledger"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
          }}
        />

        {/* Delete Confirmation Modal */}
        {deletingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
              onClick={() => !isDeleting && setDeletingItem(null)}
            />
            <div className="relative w-full max-w-md bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Delete Other Payable?
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => !isDeleting && setDeletingItem(null)}
                  disabled={isDeleting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">
                  Are you sure you want to delete transaction{" "}
                  <span className="font-mono font-bold text-foreground">{deletingItem.voucher_no}</span>?
                </p>

                <div className="p-3.5 rounded-xl border bg-destructive/10 border-destructive/20 space-y-1 text-foreground">
                  <span className="font-semibold text-destructive block">Accounting Reversal Impact:</span>
                  <p className="text-muted-foreground">
                    This will reverse the recorded Other Payable of{" "}
                    <span className="font-bold text-foreground">{formatCurrency(deletingItem.amount)}</span>.
                    The supplier <span className="font-semibold text-foreground">{deletingItem.supplier?.name}</span>'s
                    current balance will decrease accordingly and the entry will be removed from the Supplier Ledger.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingItem(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="min-w-[130px]"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Confirm Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </HasPermission>
  );
}
