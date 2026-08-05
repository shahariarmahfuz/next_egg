"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Calendar,
  CreditCard,
  Layers,
  Loader2,
  FileText,
  DollarSign,
  User,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { expenseService } from "@/services/api";
import { Expense, ExpenseCategory, ExpenseInput } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function ManageExpensesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Filters State
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Modals
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  // Edit Form State
  const [editData, setEditData] = useState<Partial<ExpenseInput>>({});
  const [editError, setEditError] = useState("");

  // Fetch Categories for Filter & Edit
  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseService.getCategories(false),
  });
  const categories: ExpenseCategory[] = categoriesData?.data || [];

  // Fetch Expenses List
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ["expenses-list", search, categoryId, paymentMethod, startDate, endDate, page],
    queryFn: () =>
      expenseService.getExpenses({
        search: search.trim() || undefined,
        category_id: categoryId || undefined,
        payment_method: paymentMethod || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
        page,
        page_size: 20,
      }),
  });

  const expenses: Expense[] = expensesData?.data?.items || [];
  const totalPages = expensesData?.data?.pages || 1;
  const totalItems = expensesData?.data?.total || 0;

  const [hardDeletingExpense, setHardDeletingExpense] = useState<Expense | null>(null);

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseService.deleteExpense(id),
    onSuccess: () => {
      toast.success("Expense voucher deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["expense-report-summary"] });
      setDeletingExpense(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete expense";
      toast.error(msg);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => expenseService.hardDeleteExpense(id),
    onSuccess: () => {
      toast.success("Expense voucher deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["expense-report-summary"] });
      setHardDeletingExpense(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete expense";
      toast.error(msg);
    },
  });

  // Edit Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExpenseInput> }) =>
      expenseService.updateExpense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expense-report-summary"] });
      setEditingExpense(null);
    },
    onError: (err: any) => {
      setEditError(err.message || "Failed to update expense");
    },
  });

  const handleOpenEdit = (exp: Expense) => {
    setEditError("");
    setEditingExpense(exp);
    setEditData({
      category_id: exp.category_id,
      amount: exp.amount,
      expense_date: exp.expense_date.split("T")[0],
      payment_method: exp.payment_method,
      reference_no: exp.reference_no || "",
      description: exp.description || "",
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (editData.amount !== undefined && editData.amount <= 0) {
      setEditError("Amount must be greater than 0");
      return;
    }

    updateMutation.mutate({
      id: editingExpense.id,
      payload: {
        ...editData,
        expense_date: editData.expense_date ? new Date(editData.expense_date).toISOString() : undefined,
      },
    });
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryId("");
    setPaymentMethod("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handlePrintVoucher = () => {
    window.print();
  };

  return (
    <HasPermission code="expense.view">
      <div className="space-y-6">
        <PageHeader
          title="Manage Expenses"
          description="View, search, edit, print vouchers, and track operational expenses."
          action={
            hasPermission("expense.create") ? (
              <Link href="/expenses/new">
                <Button className="gap-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white">
                  <Plus className="h-4 w-4" />
                  Add Expense
                </Button>
              </Link>
            ) : null
          }
        />

        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            {/* Filters Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Voucher #, Ref #, Notes..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 text-xs h-9"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 px-2.5 py-1 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 px-2.5 py-1 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Payment Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Mobile Banking">Mobile Banking</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs h-9"
                  title="From Date"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs h-9"
                  title="To Date"
                />
                {(search || categoryId || paymentMethod || startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Standardized Thin Table */}
            <div className="rounded-md border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                      <th className="p-3 w-12 text-center">SL</th>
                      <th className="p-3">Voucher No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount ($)</th>
                      <th className="p-3">Payment Method</th>
                      <th className="p-3">Created By</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="p-3 text-center"><div className="h-4 w-4 bg-muted animate-pulse rounded mx-auto" /></td>
                          <td className="p-3"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                          <td className="p-3"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                          <td className="p-3"><div className="h-4 w-28 bg-muted animate-pulse rounded" /></td>
                          <td className="p-3"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                          <td className="p-3"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                          <td className="p-3"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                          <td className="p-3 text-right"><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : expenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No expense vouchers found matching the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      expenses.map((exp, idx) => (
                        <tr key={exp.id} className="hover:bg-accent/40 transition-colors">
                          <td className="p-3 text-center font-medium text-muted-foreground">
                            {(page - 1) * 20 + idx + 1}
                          </td>
                          <td className="p-3 font-bold text-rose-500">
                            {exp.voucher_no}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {formatDate(exp.expense_date)}
                          </td>
                          <td className="p-3 font-medium text-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                              {exp.category_name}
                            </span>
                          </td>
                          <td className="p-3 text-right font-extrabold text-foreground">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                              {exp.payment_method}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {exp.created_by_name}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Voucher Modal */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingExpense(exp)}
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                title="View Voucher"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {/* Edit Voucher */}
                              {hasPermission("expense.edit") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEdit(exp)}
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Edit Expense"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {/* Delete Voucher */}
                              {hasPermission("expense.delete") && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingExpense(exp)}
                                    className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                                    title="Delete Expense Voucher"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setHardDeletingExpense(exp)}
                                    className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                                    title="Hard Delete Expense Voucher"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 fill-rose-600/20" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Showing {expenses.length} of {totalItems} expenses
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="text-xs h-8"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-semibold px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="text-xs h-8"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Voucher Modal */}
        <Dialog open={!!viewingExpense} onOpenChange={() => setViewingExpense(null)}>
          <DialogContent className="sm:max-w-md print:max-w-full">
            <DialogHeader className="print:hidden">
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-rose-500" />
                  Expense Voucher Details
                </span>
                <Button variant="outline" size="sm" onClick={handlePrintVoucher} className="gap-1.5 text-xs">
                  <Printer className="h-3.5 w-3.5" />
                  Print Voucher
                </Button>
              </DialogTitle>
            </DialogHeader>

            {viewingExpense && (
              <div className="space-y-4 py-2 border rounded-lg p-5 bg-card text-card-foreground shadow-sm">
                <div className="text-center border-b pb-3 space-y-1">
                  <h2 className="text-lg font-bold text-primary">BUSINESS ENTERPRISE HUB</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                    Expense Payment Voucher
                  </p>
                  <p className="text-xs font-extrabold text-rose-500 mt-1">
                    {viewingExpense.voucher_no}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Category:</span>
                    <span className="font-bold text-foreground">{viewingExpense.category_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Expense Date:</span>
                    <span className="font-bold text-foreground">{formatDate(viewingExpense.expense_date)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Payment Method:</span>
                    <span className="font-semibold text-foreground">{viewingExpense.payment_method}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Reference No:</span>
                    <span className="font-semibold text-foreground">{viewingExpense.reference_no || "N/A"}</span>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Total Amount Paid</span>
                  <span className="text-xl font-extrabold text-rose-600">
                    {formatCurrency(viewingExpense.amount)}
                  </span>
                </div>

                {viewingExpense.description && (
                  <div className="text-xs space-y-1">
                    <span className="text-muted-foreground block font-semibold">Notes / Description:</span>
                    <p className="p-2.5 rounded bg-muted/30 text-foreground italic border">
                      {viewingExpense.description}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-4 border-t">
                  <span>Recorded By: <strong className="text-foreground">{viewingExpense.created_by_name}</strong></span>
                  <span>System Authorized</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Voucher Modal */}
        <Dialog open={!!editingExpense} onOpenChange={() => setEditingExpense(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-primary" />
                Edit Expense Voucher
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update fields for voucher <span className="font-bold text-primary">{editingExpense?.voucher_no}</span>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <select
                  value={editData.category_id || ""}
                  onChange={(e) => setEditData({ ...editData, category_id: e.target.value })}
                  className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editData.amount || ""}
                  onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) })}
                  className="text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Expense Date</Label>
                <Input
                  type="date"
                  value={editData.expense_date || ""}
                  onChange={(e) => setEditData({ ...editData, expense_date: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Method</Label>
                <select
                  value={editData.payment_method || "Cash"}
                  onChange={(e) => setEditData({ ...editData, payment_method: e.target.value })}
                  className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Mobile Banking">Mobile Banking</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reference No</Label>
                <Input
                  type="text"
                  value={editData.reference_no || ""}
                  onChange={(e) => setEditData({ ...editData, reference_no: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes / Description</Label>
                <Textarea
                  value={editData.description || ""}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="text-xs min-h-[70px]"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingExpense(null)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={updateMutation.isPending} className="text-xs font-semibold gap-2">
                  {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={!!deletingExpense} onOpenChange={() => setDeletingExpense(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Delete Expense Entry
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to delete voucher{" "}
                <span className="font-bold text-foreground">{deletingExpense?.voucher_no}</span>?
                This will automatically reduce total business expenses and update profit calculation.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingExpense(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deletingExpense && deleteMutation.mutate(deletingExpense.id)}
                className="text-xs font-semibold gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Voucher
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Controlled Hard Delete Confirmation Modal */}
        <HardDeleteModal
          isOpen={!!hardDeletingExpense}
          onClose={() => setHardDeletingExpense(null)}
          onConfirm={async () => {
            if (hardDeletingExpense) {
              await hardDeleteMutation.mutateAsync(hardDeletingExpense.id);
            }
          }}
          entityType="Expense Voucher"
          entityName={`Voucher #${hardDeletingExpense?.voucher_no || ""} ($${hardDeletingExpense?.amount || 0})`}
          affectedItems={[
            "Expense payment voucher record",
            "Category transaction log",
          ]}
          isDeleting={hardDeleteMutation.isPending}
        />
      </div>
    </HasPermission>
  );
}
