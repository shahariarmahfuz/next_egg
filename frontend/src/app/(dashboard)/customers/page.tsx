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
import { customerService } from "@/services/api";
import { CustomerItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { CustomerViewModal } from "@/components/customers/customer-view-modal";
import { BalanceAdjustmentModal } from "@/components/common/balance-adjustment-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";

import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);
  const [adjustingCustomer, setAdjustingCustomer] = useState<CustomerItem | null>(null);
  const [hardDeletingCustomer, setHardDeletingCustomer] = useState<CustomerItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const pageSize = 10;

  // Fetch Server-Side Paginated & Filtered Customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ["customers", page, debouncedSearch, selectedStatus],
    queryFn: () =>
      customerService.getCustomers({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
        status: selectedStatus || undefined,
      }),
  });

  const customers: CustomerItem[] = customersData?.data?.items || [];
  const totalPages = customersData?.data?.pages || 1;

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => customerService.deleteCustomer(customerId),
    onSuccess: () => {
      toast.success("Customer profile deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete customer.";
      toast.error(msg);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (customerId: string) => customerService.hardDeleteCustomer(customerId),
    onSuccess: () => {
      toast.success("Customer and all related records deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingCustomer(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete customer.";
      toast.error(msg);
    },
  });

  const handleDelete = (customer: CustomerItem) => {
    deleteMutation.mutate(customer.id);
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Customer Directory"
        description="Manage customer accounts, contact profiles, credit limits, and outstanding receivable dues."
        action={
          <div className="flex space-x-2">
            <HasPermission code="customer.due.view">
              <Button asChild variant="outline">
                <Link href="/customers/dues">
                  <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                  Customer Due List
                </Link>
              </Button>
            </HasPermission>
            <HasPermission code="customer.create">
              <Button asChild>
                <Link href="/customers/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Link>
              </Button>
            </HasPermission>
          </div>
        }
      />

      {/* Filter and Server-Side Search Bar */}
      <Card className="glass-card w-full">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, or phone..."
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

      {/* Compact Customers Directory Table */}
      <Card className="glass-card overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs table-auto">
            <thead className="bg-muted/50 border-b font-semibold uppercase text-muted-foreground text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 align-middle w-[60px] text-center whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 align-middle w-[140px] whitespace-nowrap">Customer Code</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Name</th>
                <th className="px-3 py-2.5 align-middle w-[170px] whitespace-nowrap">Phone Number</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Address</th>
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
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No customers found matching your query filter.
                  </td>
                </tr>
              ) : (
                customers.map((customer, index) => {
                  const hasDue = customer.current_balance > 0;
                  const serialNumber = (page - 1) * pageSize + index + 1;

                  return (
                    <tr key={customer.id} className="hover:bg-accent/40 transition-colors h-10">
                      {/* 1. SL */}
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {serialNumber}
                      </td>

                      {/* 2. Customer Code */}
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {customer.customer_code}
                      </td>

                      {/* 3. Customer Name */}
                      <td className="px-3 py-2 align-middle font-medium text-foreground">
                        <div className="truncate max-w-[200px] lg:max-w-[300px] xl:max-w-none" title={customer.name}>
                          {customer.name}
                        </div>
                      </td>

                      {/* 4. Phone Number */}
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                        {customer.phone || "-"}
                      </td>

                      {/* 5. Customer Address */}
                      <td className="px-3 py-2 align-middle text-muted-foreground">
                        <div className="truncate max-w-[220px] lg:max-w-[350px] xl:max-w-none" title={customer.address || "-"}>
                          {customer.address || "-"}
                        </div>
                      </td>

                      {/* 6. Current Due */}
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <span className={`font-semibold ${hasDue ? "text-amber-500" : "text-emerald-500"}`}>
                          {formatCurrency(customer.current_balance)}
                        </span>
                      </td>

                      {/* 7. Status */}
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <Badge
                          variant={customer.status === "active" ? "success" : "secondary"}
                          className="capitalize text-[10px] py-0 px-2 h-5"
                        >
                          {customer.status}
                        </Badge>
                      </td>

                      {/* 8. Actions */}
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewingCustomer(customer)}
                          title="View Customer Profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <HasPermission code={["customer.balance.adjust", "customer.edit"]}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-500 hover:bg-amber-500/10"
                            onClick={() => setAdjustingCustomer(customer)}
                            title="Set Current Balance"
                          >
                            <Coins className="h-3.5 w-3.5" />
                          </Button>
                        </HasPermission>

                        <HasPermission code="customer.edit">
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Edit Customer">
                            <Link href={`/customers/${customer.id}/edit`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </HasPermission>

                        <HasPermission code="customer.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(customer)}
                            title="Normal Delete (Blocked if transactions exist)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                            onClick={() => setHardDeletingCustomer(customer)}
                            title="Hard Delete (Permanently remove customer & all related transactions)"
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
      <CustomerViewModal
        customer={viewingCustomer}
        isOpen={!!viewingCustomer}
        onClose={() => setViewingCustomer(null)}
      />



      {/* Controlled Hard Delete Confirmation Modal */}
      <HardDeleteModal
        isOpen={!!hardDeletingCustomer}
        onClose={() => setHardDeletingCustomer(null)}
        onConfirm={async () => {
          if (hardDeletingCustomer) {
            await hardDeleteMutation.mutateAsync(hardDeletingCustomer.id);
          }
        }}
        entityType="Customer"
        entityName={`${hardDeletingCustomer?.customer_code || ""} - ${hardDeletingCustomer?.name || ""}`}
        affectedItems={[
          "All customer sales invoices & line items",
          "Customer collection payment vouchers",
          "Sale return vouchers & returned item logs",
          "Ledger balance adjustment entries",
        ]}
        isDeleting={hardDeleteMutation.isPending}
      />
      {adjustingCustomer && (
        <BalanceAdjustmentModal
          entityType="customer"
          entityId={adjustingCustomer.id}
          entityName={adjustingCustomer.name}
          currentBalance={adjustingCustomer.current_balance}
          isOpen={!!adjustingCustomer}
          onClose={() => setAdjustingCustomer(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["customers"] });
          }}
        />
      )}
    </div>
  );
}
