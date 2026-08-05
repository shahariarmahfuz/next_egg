"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  ShoppingBag,
  Edit,
  Trash2,
  Eye,
  FileText,
  Truck,
  BarChart3,
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
import { PurchaseViewModal } from "@/components/purchases/purchase-view-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate } from "@/utils/formatters";

import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseItem | null>(null);
  const [hardDeletingPurchase, setHardDeletingPurchase] = useState<PurchaseItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch Server-Side Paginated Purchases
  const { data: purchasesData, isLoading } = useQuery({
    queryKey: ["purchases", page, debouncedSearch, paymentStatus],
    queryFn: () =>
      purchaseService.getPurchases({
        page,
        size: 10,
        search: debouncedSearch || undefined,
        payment_status: paymentStatus || undefined,
      }),
  });

  const purchases: PurchaseItem[] = purchasesData?.data?.items || [];
  const totalPages = purchasesData?.data?.pages || 1;
  const pageSize = 10;

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (purchaseId: string) => purchaseService.deletePurchase(purchaseId),
    onSuccess: () => {
      toast.success("Purchase order deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete purchase order.";
      toast.error(msg);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (purchaseId: string) => purchaseService.hardDeletePurchase(purchaseId),
    onSuccess: () => {
      toast.success("Purchase order and all linked payments/returns deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingPurchase(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete purchase order.";
      toast.error(msg);
    },
  });

  const handleDelete = (purchase: PurchaseItem) => {
    deleteMutation.mutate(purchase.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Management"
        description="Manage incoming inventory orders, supplier bills, and automatic stock level additions."
        action={
          <div className="flex space-x-2">
            <HasPermission code="purchase.report">
              <Button asChild variant="outline">
                <Link href="/purchases/reports">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Purchase Report
                </Link>
              </Button>
            </HasPermission>
            <HasPermission code="purchase.create">
              <Button asChild>
                <Link href="/purchases/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Purchase
                </Link>
              </Button>
            </HasPermission>
          </div>
        }
      />

      {/* Filter and Server-Side Search Bar */}
      <Card className="glass-card">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO number, invoice, supplier name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Purchases Directory Table */}
      <Card className="glass-card overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">PO Number</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Items</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Grand Total</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Paid</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Due</th>
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
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-14" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No purchase orders found matching your query filters.
                  </td>
                </tr>
              ) : (
                purchases.map((purchase, index) => {
                  const serialNumber = (page - 1) * pageSize + index + 1;

                  return (
                    <tr key={purchase.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {purchase.purchase_no}
                        {purchase.invoice_no && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            Inv: {purchase.invoice_no}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap">
                        {purchase.supplier?.name || "Supplier"}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(purchase.purchase_date)}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs whitespace-nowrap">
                        {purchase.items.length} item(s)
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
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewingPurchase(purchase)}
                          title="View Purchase Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <HasPermission code="purchase.edit">
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Edit Purchase">
                            <Link href={`/purchases/${purchase.id}/edit`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </HasPermission>
                        <HasPermission code="purchase.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(purchase.id)}
                            title="Normal Delete (Reduces stock & adjusts supplier balance)"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHardDeletingPurchase(purchase)}
                            title="Hard Delete (Permanently remove purchase order & all dependent payments/returns)"
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
        isOpen={!!hardDeletingPurchase}
        onClose={() => setHardDeletingPurchase(null)}
        onConfirm={async () => {
          if (hardDeletingPurchase) {
            await hardDeleteMutation.mutateAsync(hardDeletingPurchase.id);
          }
        }}
        entityType="Purchase Order"
        entityName={`PO #${hardDeletingPurchase?.purchase_no || ""} (${hardDeletingPurchase?.supplier?.name || "Supplier"})`}
        affectedItems={[
          "All items in this purchase order",
          "Linked supplier payment vouchers",
          "Product return vouchers & returned item logs",
          "Supplier ledger balance history",
        ]}
        isDeleting={hardDeleteMutation.isPending}
      />

      {/* Quick View Modal */}
      <PurchaseViewModal
        purchase={viewingPurchase}
        isOpen={!!viewingPurchase}
        onClose={() => setViewingPurchase(null)}
      />
    </div>
  );
}
