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
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
  PlusCircle,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { HasPermission } from "@/providers/auth-provider";
import { supplierPaymentService } from "@/services/api";
import { SupplierPaymentItem } from "@/types";
import {
  formatCurrency,
  formatDate,
  exportSupplierPaymentsCSV,
  exportSupplierPaymentsExcel,
  printSupplierPaymentVoucher,
} from "@/components/supplier-payments/supplier-payment-export-utils";
import { SupplierPaymentViewModal } from "@/components/supplier-payments/supplier-payment-view-modal";
import { SupplierPaymentEditModal } from "@/components/supplier-payments/supplier-payment-edit-modal";
import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function ManageSupplierPaymentsPage() {
  const queryClient = useQueryClient();

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Modals state
  const [selectedViewPayment, setSelectedViewPayment] = useState<SupplierPaymentItem | null>(null);
  const [selectedEditPayment, setSelectedEditPayment] = useState<SupplierPaymentItem | null>(null);
  const [selectedDeletePayment, setSelectedDeletePayment] = useState<SupplierPaymentItem | null>(null);
  const [hardDeletingPayment, setHardDeletingPayment] = useState<SupplierPaymentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query paginated supplier payments
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: [
      "supplier-payments-list",
      page,
      pageSize,
      debouncedSearch,
      paymentMethod,
      sortBy,
      startDate,
      endDate,
    ],
    queryFn: () =>
      supplierPaymentService.getSupplierPayments({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
        payment_method: paymentMethod || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        sort_by: sortBy,
      }),
  });

  const supplierPayments: SupplierPaymentItem[] = paymentsData?.data?.items || [];
  const totalItems = paymentsData?.data?.total || 0;
  const totalPages = paymentsData?.data?.pages || 1;

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => supplierPaymentService.deleteSupplierPayment(id),
    onSuccess: () => {
      toast.success("Supplier payment voucher deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setSelectedDeletePayment(null);
      setIsDeleting(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete payment voucher.";
      toast.error(msg);
      setIsDeleting(false);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => supplierPaymentService.hardDeleteSupplierPayment(id),
    onSuccess: () => {
      toast.success("Supplier payment voucher deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingPayment(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete payment voucher.";
      toast.error(msg);
    },
  });

  const handleDeleteConfirm = () => {
    if (!selectedDeletePayment) return;
    setIsDeleting(true);
    deleteMutation.mutate(selectedDeletePayment.id);
  };

  return (
    <HasPermission code="supplier_payment.view">
      <div className="space-y-6">
        <PageHeader
          title="Supplier Payments"
          description="Record payments made to suppliers, track voucher transaction history, and automatically update outstanding supplier dues."
          action={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => exportSupplierPaymentsCSV(supplierPayments)}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-500" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportSupplierPaymentsExcel(supplierPayments)}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4 text-blue-500" />
                Export Excel
              </Button>
              <HasPermission code="supplier_payment.create">
                <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20">
                  <Link href="/supplier-payments/new">
                    <PlusCircle className="mr-1.5 h-4 w-4" />
                    Add Supplier Payment
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
                  placeholder="Search Voucher # (SP-00001), Supplier Name, Phone, Ref #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Payment Method */}
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="mobile_wallet">Mobile Wallet</option>
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

              {/* Date Range */}
              <div className="flex gap-2 col-span-1 sm:col-span-2 lg:col-span-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="glass-card">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              Supplier Payment Vouchers ({totalItems})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/supplier-payments/reports">
                <Button variant="ghost" size="sm" className="text-xs text-primary font-semibold">
                  View Payment Reports &rarr;
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Payment Voucher #</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Payment Date</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier</th>
                  <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Amount Paid</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Method</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Reference #</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Processed By</th>
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
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : supplierPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No supplier payment vouchers found matching specified criteria.
                    </td>
                  </tr>
                ) : (
                  supplierPayments.map((pay, index) => {
                    const serialNumber = (page - 1) * pageSize + index + 1;

                    return (
                      <tr key={pay.id} className="hover:bg-accent/40 transition-colors h-10">
                        <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                          {serialNumber}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                          {pay.payment_no}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {formatDate(pay.payment_date)}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={pay.supplier?.name || "N/A"}>
                          {pay.supplier?.name || "N/A"}
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-semibold text-emerald-500 whitespace-nowrap">
                          {formatCurrency(pay.amount)}
                        </td>
                        <td className="px-3 py-2 align-middle whitespace-nowrap">
                          <Badge variant="secondary" className="text-[10px] uppercase py-0 px-2 h-5">
                            {pay.payment_method}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {pay.reference_no || "-"}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {pay.user?.full_name || pay.user?.username || "System"}
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="View Voucher"
                            onClick={() => setSelectedViewPayment(pay)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Print Voucher"
                            onClick={() => printSupplierPaymentVoucher(pay)}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <HasPermission code="supplier_payment.edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Edit Voucher"
                              onClick={() => setSelectedEditPayment(pay)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </HasPermission>
                          <HasPermission code="supplier_payment.delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Normal Delete Voucher"
                              onClick={() => setSelectedDeletePayment(pay)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                              title="Hard Delete Voucher"
                              onClick={() => setHardDeletingPayment(pay)}
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
        <SupplierPaymentViewModal
          payment={selectedViewPayment}
          isOpen={!!selectedViewPayment}
          onClose={() => setSelectedViewPayment(null)}
        />

        {/* Edit Modal */}
        <SupplierPaymentEditModal
          payment={selectedEditPayment}
          isOpen={!!selectedEditPayment}
          onClose={() => setSelectedEditPayment(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["supplier-payments-list"] });
          }}
        />

        {/* Delete Confirmation Modal */}
        {selectedDeletePayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
              onClick={() => setSelectedDeletePayment(null)}
            />
            <div className="relative w-full max-w-md bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Delete Supplier Payment Voucher?
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDeletePayment(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Deleting payment voucher <span className="font-bold text-foreground ">{selectedDeletePayment.payment_no}</span> (${selectedDeletePayment.amount.toFixed(2)}) will automatically restore the supplier's due balance by ${selectedDeletePayment.amount.toFixed(2)}.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setSelectedDeletePayment(null)}>
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
          isOpen={!!hardDeletingPayment}
          onClose={() => setHardDeletingPayment(null)}
          onConfirm={async () => {
            if (hardDeletingPayment) {
              await hardDeleteMutation.mutateAsync(hardDeletingPayment.id);
            }
          }}
          entityType="Supplier Payment"
          entityName={`Voucher #${hardDeletingPayment?.payment_no || ""} (${hardDeletingPayment?.supplier?.name || "Supplier"})`}
          affectedItems={[
            "Supplier payment voucher",
            "Supplier ledger history & payable balance recalculation",
          ]}
          isDeleting={hardDeleteMutation.isPending}
        />
      </div>
    </HasPermission>
  );
}
