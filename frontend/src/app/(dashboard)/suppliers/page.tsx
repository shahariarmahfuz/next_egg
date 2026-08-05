"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  Coins,
} from "lucide-react";
import { supplierService } from "@/services/api";
import { SupplierItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { SupplierViewModal } from "@/components/suppliers/supplier-view-modal";
import { BalanceAdjustmentModal } from "@/components/common/balance-adjustment-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";

import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [viewingSupplier, setViewingSupplier] = useState<SupplierItem | null>(null);
  const [adjustingSupplier, setAdjustingSupplier] = useState<SupplierItem | null>(null);
  const [hardDeletingSupplier, setHardDeletingSupplier] = useState<SupplierItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const pageSize = 10;

  // Fetch Server-Side Paginated & Filtered Suppliers
  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ["suppliers", page, debouncedSearch, selectedStatus],
    queryFn: () =>
      supplierService.getSuppliers({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
        status: selectedStatus || undefined,
      }),
  });

  const suppliers: SupplierItem[] = suppliersData?.data?.items || [];
  const totalPages = suppliersData?.data?.pages || 1;

  // Toggle status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      supplierService.updateSupplierStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (supplierId: string) => supplierService.deleteSupplier(supplierId),
    onSuccess: () => {
      toast.success("Supplier deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete supplier.";
      toast.error(msg);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (supplierId: string) => supplierService.hardDeleteSupplier(supplierId),
    onSuccess: () => {
      toast.success("Supplier and all related records deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingSupplier(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete supplier.";
      toast.error(msg);
    },
  });

  const handleDelete = (supplier: SupplierItem) => {
    deleteMutation.mutate(supplier.id);
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Supplier Directory"
        description="Manage vendor accounts, contact profiles, trade payables, and outstanding balances."
        action={
          <div className="flex space-x-2">
            <HasPermission code="supplier.due.view">
              <Button asChild variant="outline">
                <Link href="/suppliers/dues">
                  <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                  Supplier Payable Dues
                </Link>
              </Button>
            </HasPermission>
            <HasPermission code="supplier.create">
              <Button asChild>
                <Link href="/suppliers/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Supplier
                </Link>
              </Button>
            </HasPermission>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="glass-card w-full">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-10"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Compact Suppliers Directory Table */}
      <Card className="glass-card overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs table-auto">
            <thead className="bg-muted/50 border-b font-semibold uppercase text-muted-foreground text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 align-middle w-[60px] text-center whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 align-middle w-[140px] whitespace-nowrap">Supplier Code</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier Name</th>
                <th className="px-3 py-2.5 align-middle w-[170px] whitespace-nowrap">Phone Number</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier Address</th>
                <th className="px-3 py-2.5 align-middle w-[130px] whitespace-nowrap">Current Due</th>
                <th className="px-3 py-2.5 align-middle w-[110px] whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 align-middle w-[140px] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-10">
                    <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-44" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-14" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No suppliers found matching your query filters.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier, index) => {
                  const hasDue = supplier.current_balance > 0;
                  const serialNumber = (page - 1) * pageSize + index + 1;

                  return (
                    <tr key={supplier.id} className="hover:bg-accent/40 transition-colors h-10">
                      {/* 1. SL */}
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {serialNumber}
                      </td>

                      {/* 2. Supplier Code */}
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {supplier.supplier_code}
                      </td>

                      {/* 3. Supplier Name */}
                      <td className="px-3 py-2 align-middle font-medium text-foreground">
                        <div className="truncate max-w-[200px] lg:max-w-[300px] xl:max-w-none" title={supplier.name}>
                          {supplier.name}
                        </div>
                      </td>

                      {/* 4. Phone Number */}
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                        {supplier.phone || "-"}
                      </td>

                      {/* 5. Supplier Address */}
                      <td className="px-3 py-2 align-middle text-muted-foreground">
                        <div className="truncate max-w-[220px] lg:max-w-[350px] xl:max-w-none" title={supplier.address || "-"}>
                          {supplier.address || "-"}
                        </div>
                      </td>

                      {/* 6. Current Due */}
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <span className={`font-semibold ${hasDue ? "text-amber-500" : "text-emerald-500"}`}>
                          {formatCurrency(supplier.current_balance)}
                        </span>
                      </td>

                      {/* 7. Status */}
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <select
                          value={supplier.status}
                          onChange={(e) => statusMutation.mutate({ id: supplier.id, status: e.target.value })}
                          className={`text-[11px] font-semibold rounded-md border px-2 py-0.5 bg-background capitalize ${
                            supplier.status === "active"
                              ? "text-emerald-500 border-emerald-500/30"
                              : "text-muted-foreground border-border"
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>

                      {/* 8. Actions */}
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewingSupplier(supplier)}
                          title="View Supplier Profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <HasPermission code={["supplier.balance.adjust", "supplier.edit"]}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-500 hover:bg-amber-500/10"
                            onClick={() => setAdjustingSupplier(supplier)}
                            title="Set Current Balance"
                          >
                            <Coins className="h-3.5 w-3.5" />
                          </Button>
                        </HasPermission>

                        <HasPermission code="supplier.edit">
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Edit Supplier">
                            <Link href={`/suppliers/${supplier.id}/edit`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </HasPermission>

                        <HasPermission code="supplier.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(supplier)}
                            title="Normal Delete (Blocked if transactions exist)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                            onClick={() => setHardDeletingSupplier(supplier)}
                            title="Hard Delete (Permanently remove supplier & all related transactions)"
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
          <div className="flex items-center justify-between p-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Quick View Modal */}
      <SupplierViewModal
        supplier={viewingSupplier}
        isOpen={!!viewingSupplier}
        onClose={() => setViewingSupplier(null)}
      />

      {/* Balance Adjustment Modal */}
      {adjustingSupplier && (
        <BalanceAdjustmentModal
          entityType="supplier"
          entityId={adjustingSupplier.id}
          entityName={adjustingSupplier.name}
          currentBalance={adjustingSupplier.current_balance}
          isOpen={!!adjustingSupplier}
          onClose={() => setAdjustingSupplier(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
          }}
        />
      )}

      {/* Controlled Hard Delete Confirmation Modal */}
      <HardDeleteModal
        isOpen={!!hardDeletingSupplier}
        onClose={() => setHardDeletingSupplier(null)}
        onConfirm={async () => {
          if (hardDeletingSupplier) {
            await hardDeleteMutation.mutateAsync(hardDeletingSupplier.id);
          }
        }}
        entityType="Supplier"
        entityName={`${hardDeletingSupplier?.supplier_code || ""} - ${hardDeletingSupplier?.name || ""}`}
        affectedItems={[
          "All purchase orders & line items",
          "Supplier payment vouchers",
          "Product return vouchers & returned item logs",
          "Supplier balance adjustments",
        ]}
        isDeleting={hardDeleteMutation.isPending}
      />
    </div>
  );
}
