"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Plus,
  Search,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  Loader2,
  BookOpen,
  RotateCw,
  X,
  FileText,
  DollarSign,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { cashOutService } from "@/services/api";
import { CashOutItem, CashOutUpdateInput } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { sanitizeNumericInput } from "@/utils/numeric-sanitizer";

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];

export default function CashOutManagePage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals state
  const [viewingItem, setViewingItem] = useState<CashOutItem | null>(null);
  const [editingItem, setEditingItem] = useState<CashOutItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CashOutItem | null>(null);

  // Edit form state
  const [editAmount, setEditAmount] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editError, setEditError] = useState<string>("");

  // Query: Server-side paginated Cash Out list
  const {
    data: responseData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["cash-outs-manage", page, pageSize, search, startDate, endDate],
    queryFn: () =>
      cashOutService.getCashOuts({
        page,
        size: pageSize,
        search: search.trim() || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
      }),
    enabled: hasPermission(["cash_out.view", "accounts.cash_out.view"]),
  });

  const cashOuts: CashOutItem[] = responseData?.data?.items || [];
  const totalItems = responseData?.data?.total || 0;
  const totalPages = responseData?.data?.pages || 1;

  // Open edit modal
  const handleOpenEdit = (item: CashOutItem) => {
    if (!hasPermission(["cash_out.edit", "accounts.cash_out.edit"])) {
      toast.error("You do not have permission to edit cash out vouchers.");
      return;
    }
    setEditingItem(item);
    setEditAmount(String(item.amount));
    setEditReason(item.reason);
    setEditNote(item.notes || item.note || "");
    const d = new Date(item.cash_out_date);
    const dateStr = isNaN(d.getTime()) ? item.cash_out_date.split("T")[0] : d.toISOString().split("T")[0];
    setEditDate(dateStr);
    setEditError("");
  };

  // Edit mutation
  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: CashOutUpdateInput }) =>
      cashOutService.updateCashOut(payload.id, payload.data),
    onSuccess: () => {
      toast.success("Cash out voucher updated successfully.");
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ["cash-outs-manage"] });
      queryClient.invalidateQueries({ queryKey: ["cash-outs-recent"] });
      queryClient.invalidateQueries({ queryKey: ["cash-book"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to update cash out voucher.";
      setEditError(msg);
      toast.error(msg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => cashOutService.deleteCashOut(id),
    onSuccess: () => {
      toast.success("Cash out voucher deleted successfully.");
      setDeletingItem(null);
      queryClient.invalidateQueries({ queryKey: ["cash-outs-manage"] });
      queryClient.invalidateQueries({ queryKey: ["cash-outs-recent"] });
      queryClient.invalidateQueries({ queryKey: ["cash-book"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to delete cash out voucher.";
      toast.error(msg);
    },
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!hasPermission(["cash_out.edit", "accounts.cash_out.edit"])) {
      toast.error("You do not have permission to edit cash out vouchers.");
      return;
    }

    const numAmount = parseFloat(sanitizeNumericInput(editAmount));
    if (isNaN(numAmount) || numAmount <= 0) {
      setEditError("Amount must be greater than 0.");
      return;
    }
    if (!editReason.trim()) {
      setEditError("Reason for cash out is required.");
      return;
    }

    const isoDateTime = editDate ? new Date(`${editDate}T12:00:00Z`).toISOString() : undefined;

    updateMutation.mutate({
      id: editingItem.id,
      data: {
        amount: numAmount,
        reason: editReason.trim(),
        cash_out_date: isoDateTime,
        notes: editNote.trim() || undefined,
      },
    });
  };

  const handleClearFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || startDate || endDate);

  // Pagination calculation
  const startItemIdx = totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItemIdx = Math.min(page * pageSize, totalItems);

  return (
    <HasPermission
      code={["cash_out.view", "accounts.cash_out.view"]}
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Cash Out Management.
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader
            title="Cash Out Manage"
            description="View, search, edit, and audit non-expense cash out vouchers."
          />

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs shadow-sm">
              <Link href="/cash/cash-book">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span>Cash Book</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 gap-1.5 text-xs shadow-sm">
              <Link href="/cash/cash-out">
                <Plus className="h-3.5 w-3.5" />
                <span>Record Cash Out</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="glass-card shadow-sm border">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
              {/* Search */}
              <div className="sm:col-span-2 md:col-span-5 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by voucher no, reason, or notes..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 text-xs"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Start Date */}
              <div className="sm:col-span-1 md:col-span-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 h-9 text-xs"
                    title="From Date"
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="sm:col-span-1 md:col-span-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 h-9 text-xs"
                    title="To Date"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="sm:col-span-2 md:col-span-1 flex items-center gap-1.5 justify-end">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="h-9 w-9"
                  title="Refresh"
                >
                  <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card className="glass-card shadow-sm border overflow-hidden">
          <CardHeader className="py-3.5 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Cash Out Records</span>
              <Badge variant="secondary" className="text-xs font-normal">
                {totalItems} total
              </Badge>
            </CardTitle>

            {/* Page Size Selector in Card Header */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground hidden sm:inline">Per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[72px] text-xs">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={String(opt)} className="text-xs">
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">SL</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Voucher No</th>
                    <th className="py-3 px-4">Reason / Description</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span>Loading cash out records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : cashOuts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ArrowUpRight className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-medium text-sm">No cash out records found</p>
                          <p className="text-xs text-muted-foreground/80 max-w-sm">
                            {hasActiveFilters
                              ? "Try adjusting your search query or date range filters."
                              : "No cash out vouchers have been recorded yet."}
                          </p>
                          {!hasActiveFilters && (
                            <Button asChild size="sm" variant="outline" className="mt-2 text-xs">
                              <Link href="/cash/cash-out">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Record First Cash Out
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cashOuts.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="py-3 px-4 text-center text-muted-foreground font-mono">
                          {startItemIdx + idx}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium">
                          {formatDate(item.cash_out_date)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[11px]">
                            {item.cash_out_no}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground max-w-xs truncate" title={item.reason}>
                          {item.reason}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={item.notes || item.note || ""}>
                          {item.notes || item.note || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-purple-700 dark:text-purple-300">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* View Details */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingItem(item)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {/* Edit Action */}
                            {hasPermission(["cash_out.edit", "accounts.cash_out.edit"]) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(item)}
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                title="Edit voucher"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Delete Action */}
                            {hasPermission(["cash_out.delete", "accounts.cash_out.delete"]) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (!hasPermission(["cash_out.delete", "accounts.cash_out.delete"])) {
                                    toast.error("You do not have permission to delete cash out vouchers.");
                                    return;
                                  }
                                  setDeletingItem(item);
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Delete voucher"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-muted/10 text-xs">
              <div className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{startItemIdx}</span>–
                <span className="font-semibold text-foreground">{endItemIdx}</span> of{" "}
                <span className="font-semibold text-foreground">{totalItems}</span> records
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      return (
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - page) <= 1
                      );
                    })
                    .map((p, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const showEllipsis = prevPage && p - prevPage > 1;

                      return (
                        <div key={p} className="flex items-center">
                          {showEllipsis && (
                            <span className="px-1 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={p === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(p)}
                            className="h-8 w-8 p-0 text-xs font-semibold"
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
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Details Modal */}
        <Dialog open={Boolean(viewingItem)} onOpenChange={(open) => !open && setViewingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <ArrowUpRight className="h-5 w-5 text-purple-600" />
                <span>Cash Out Voucher Details</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Complete transaction details for audit reference.
              </DialogDescription>
            </DialogHeader>

            {viewingItem && (
              <div className="space-y-3 py-2 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Voucher No</span>
                    <span className="font-mono font-bold text-sm text-purple-700 dark:text-purple-300">
                      {viewingItem.cash_out_no}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Amount</span>
                    <span className="font-bold text-sm text-purple-700 dark:text-purple-300">
                      {formatCurrency(viewingItem.amount)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Withdrawal Date</span>
                    <span className="font-medium">{formatDate(viewingItem.cash_out_date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reason / Description</span>
                    <span className="font-medium text-right max-w-[200px]">{viewingItem.reason}</span>
                  </div>
                  {viewingItem.created_by_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Recorded By</span>
                      <span className="font-medium">{viewingItem.created_by_name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">System Recorded Time</span>
                    <span className="font-mono text-[11px]">
                      {new Date(viewingItem.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {(viewingItem.notes || viewingItem.note) && (
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                    <span className="text-muted-foreground font-semibold text-[11px] block">Notes:</span>
                    <p className="text-foreground">{viewingItem.notes || viewingItem.note}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setViewingItem(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                <span>Edit Cash Out Voucher</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update voucher {editingItem?.cash_out_no}. Changes will update the Cash Book closing balance.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              {editError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="text"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reason / Description</Label>
                <Input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Owner Withdrawal"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes (Optional)</Label>
                <Textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Additional remarks..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingItem(null)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateMutation.isPending}
                  className="gap-1.5"
                >
                  {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal (In-app, no native confirm) */}
        <Dialog open={Boolean(deletingItem)} onOpenChange={(open) => !open && setDeletingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base text-destructive flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>Delete Cash Out Voucher</span>
              </DialogTitle>
              <DialogDescription className="text-xs pt-1">
                Are you sure you want to delete Cash Out voucher{" "}
                <strong className="font-mono text-foreground font-semibold">{deletingItem?.cash_out_no}</strong> for{" "}
                <strong className="text-foreground">{formatCurrency(deletingItem?.amount || 0)}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              Deleting this voucher will restore the cash balance in the Cash Book for this date. This action cannot be undone.
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingItem(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (!hasPermission(["cash_out.delete", "accounts.cash_out.delete"])) {
                    toast.error("You do not have permission to delete cash out vouchers.");
                    return;
                  }
                  if (deletingItem) deleteMutation.mutate(deletingItem.id);
                }}
                disabled={deleteMutation.isPending}
                className="gap-1.5"
              >
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Delete Voucher</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </HasPermission>
  );
}
