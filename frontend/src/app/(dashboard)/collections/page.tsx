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
  Wallet,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { HasPermission } from "@/providers/auth-provider";
import { collectionService } from "@/services/api";
import { CustomerCollectionItem } from "@/types";
import {
  formatCurrency,
  formatDate,
  exportCollectionsCSV,
  exportCollectionsExcel,
  printVoucherWindow,
} from "@/components/collections/collection-export-utils";
import { CollectionViewModal } from "@/components/collections/collection-view-modal";
import { CollectionEditModal } from "@/components/collections/collection-edit-modal";
import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function ManageCollectionsPage() {
  const queryClient = useQueryClient();

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Modals state
  const [selectedViewCollection, setSelectedViewCollection] = useState<CustomerCollectionItem | null>(null);
  const [selectedEditCollection, setSelectedEditCollection] = useState<CustomerCollectionItem | null>(null);
  const [selectedDeleteCollection, setSelectedDeleteCollection] = useState<CustomerCollectionItem | null>(null);
  const [hardDeletingCollection, setHardDeletingCollection] = useState<CustomerCollectionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query paginated collections
  const { data: collectionsData, isLoading } = useQuery({
    queryKey: [
      "collections-list",
      page,
      pageSize,
      debouncedSearch,
      paymentMethod,
      sortBy,
      startDate,
      endDate,
    ],
    queryFn: () =>
      collectionService.getCollections({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
        payment_method: paymentMethod !== "all" ? paymentMethod : undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        sort_by: sortBy,
      }),
  });

  const collections: CustomerCollectionItem[] = collectionsData?.data?.items || [];
  const totalItems = collectionsData?.data?.total || 0;
  const totalPages = collectionsData?.data?.pages || 1;

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => collectionService.deleteCollection(id),
    onSuccess: () => {
      toast.success("Collection voucher deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["collections-list"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setSelectedDeleteCollection(null);
      setIsDeleting(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete collection voucher.";
      toast.error(msg);
      setIsDeleting(false);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => collectionService.hardDeleteCollection(id),
    onSuccess: () => {
      toast.success("Collection voucher deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["collections-list"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingCollection(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete collection voucher.";
      toast.error(msg);
    },
  });

  const handleDeleteConfirm = () => {
    if (!selectedDeleteCollection) return;
    setIsDeleting(true);
    deleteMutation.mutate(selectedDeleteCollection.id);
  };

  return (
    <HasPermission code="collection.view">
      <div className="space-y-6">
        <PageHeader
          title="Customer Dues Collection"
          description="Manage customer payment vouchers, search collections, view details, edit payments, and generate reports."
          action={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => exportCollectionsCSV(collections)}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-500" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCollectionsExcel(collections)}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-blue-500" />
                Export Excel
              </Button>
              <HasPermission code="collection.create">
                <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20">
                  <Link href="/collections/new">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Collection
                  </Link>
                </Button>
              </HasPermission>
            </div>
          }
        />

        {/* Filter Controls Bar */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Voucher #, Customer Name, Phone, Address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Payment Method Filter */}
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="mobile_banking">Mobile Banking</option>
              </select>

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
              <Wallet className="h-4 w-4 text-emerald-500" />
              Collection Vouchers ({totalItems})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/collections/reports">
                <Button variant="ghost" size="sm" className="text-xs text-primary font-semibold">
                  View Collection Reports &rarr;
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Voucher No</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Name</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Contact Number</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Address</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Collection Date</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Collection Amount</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Payment Method</th>
                  <th className="px-3 py-2.5 align-middle w-[140px] text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="h-10">
                      <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No collection vouchers found matching specified criteria.
                    </td>
                  </tr>
                ) : (
                  collections.map((col, index) => {
                    const serialNumber = (page - 1) * pageSize + index + 1;

                    return (
                      <tr key={col.id} className="hover:bg-accent/40 transition-colors h-10">
                        <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                          {serialNumber}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                          {col.collection_no}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={col.customer?.name || "N/A"}>
                          {col.customer?.name || "N/A"}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {col.customer?.phone || "-"}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap max-w-[220px] truncate" title={col.customer?.address || "-"}>
                          {col.customer?.address || "-"}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {formatDate(col.collection_date)}
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-semibold text-emerald-500 whitespace-nowrap">
                          {formatCurrency(col.amount)}
                        </td>
                        <td className="px-3 py-2 align-middle whitespace-nowrap">
                          <Badge variant="outline" className="capitalize text-[10px] py-0 px-2 h-5">
                            {col.payment_method.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="View Voucher"
                            onClick={() => setSelectedViewCollection(col)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Print Voucher"
                            onClick={() => printVoucherWindow(col)}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <HasPermission code="collection.edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Edit Voucher"
                              onClick={() => setSelectedEditCollection(col)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </HasPermission>
                          <HasPermission code="collection.delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Normal Delete Voucher"
                              onClick={() => setSelectedDeleteCollection(col)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                              title="Hard Delete Voucher"
                              onClick={() => setHardDeletingCollection(col)}
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
        <CollectionViewModal
          collection={selectedViewCollection}
          isOpen={!!selectedViewCollection}
          onClose={() => setSelectedViewCollection(null)}
        />

        {/* Edit Modal */}
        <CollectionEditModal
          collection={selectedEditCollection}
          isOpen={!!selectedEditCollection}
          onClose={() => setSelectedEditCollection(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["collections-list"] });
          }}
        />

        {/* Delete Confirmation Modal */}
        {selectedDeleteCollection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
              onClick={() => setSelectedDeleteCollection(null)}
            />
            <div className="relative w-full max-w-md bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Delete Collection Voucher?
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDeleteCollection(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Deleting voucher <span className="font-bold text-foreground ">{selectedDeleteCollection.collection_no}</span> (${selectedDeleteCollection.amount.toFixed(2)}) will automatically restore the customer's due balance.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setSelectedDeleteCollection(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Confirm & Restore Due
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Controlled Hard Delete Confirmation Modal */}
        <HardDeleteModal
          isOpen={!!hardDeletingCollection}
          onClose={() => setHardDeletingCollection(null)}
          onConfirm={async () => {
            if (hardDeletingCollection) {
              await hardDeleteMutation.mutateAsync(hardDeletingCollection.id);
            }
          }}
          entityType="Customer Collection"
          entityName={`Voucher #${hardDeletingCollection?.collection_no || ""} (${hardDeletingCollection?.customer?.name || "Customer"})`}
          affectedItems={[
            "Customer collection payment voucher",
            "Customer ledger history & due balance recalculation",
          ]}
          isDeleting={hardDeleteMutation.isPending}
        />
      </div>
    </HasPermission>
  );
}
