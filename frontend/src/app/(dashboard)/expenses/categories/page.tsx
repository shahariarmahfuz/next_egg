"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  AlertOctagon,
  Eye,
  EyeOff,
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
import { ExpenseCategory, ExpenseCategoryInput } from "@/types";
import { toast } from "sonner";

export default function ExpenseCategoriesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategory | null>(null);
  const [hidingCategory, setHidingCategory] = useState<ExpenseCategory | null>(null);
  const [hardDeletingCategory, setHardDeletingCategory] = useState<ExpenseCategory | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  // Form State
  const [formData, setFormData] = useState<ExpenseCategoryInput>({
    name: "",
    description: "",
    status: "active",
  });
  const [formError, setFormError] = useState("");

  // Fetch Categories
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseService.getCategories(false),
  });

  const categories: ExpenseCategory[] = categoriesData?.data || [];

  // Filtered categories
  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: ExpenseCategoryInput) => expenseService.createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories-active"] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create category");
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExpenseCategoryInput> }) =>
      expenseService.updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories-active"] });
      setEditingCategory(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update category");
    },
  });

  // Soft Delete / Hide Mutation (Safe Deactivation)
  const hideMutation = useMutation({
    mutationFn: (id: string) => expenseService.hideCategory(id),
    onSuccess: (res) => {
      toast.success(
        `Category "${res.data?.name || "Category"}" has been deactivated and hidden from new expense entries.`
      );
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories-active"] });
      setHidingCategory(null);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        err?.message ||
        "Failed to hide category";
      toast.error(msg);
    },
  });

  // Hard Delete Mutation (Category + All Associated Expense Transactions)
  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => expenseService.hardDeleteCategory(id),
    onSuccess: (res) => {
      const data = res.data;
      toast.success(
        data?.category_name
          ? `Category "${data.category_name}" and ${data.deleted_expenses_count} associated expense(s) permanently deleted.`
          : "Category and all associated expense transactions permanently deleted."
      );
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories-active"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-reports"] });
      queryClient.invalidateQueries({ queryKey: ["expense-report-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-book"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingCategory(null);
      setConfirmDeleteText("");
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        err?.message ||
        "Failed to hard delete category";
      toast.error(msg);
    },
  });

  // Delete Mutation (Standard)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseService.deleteCategory(id),
    onSuccess: () => {
      toast.success("Category deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories-active"] });
      setDeletingCategory(null);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        err?.message ||
        "Cannot delete category";
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", status: "active" });
    setFormError("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (cat: ExpenseCategory) => {
    resetForm();
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || "",
      status: cat.status,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (cat: ExpenseCategory) => {
    const nextStatus = cat.status === "active" ? "inactive" : "active";
    updateMutation.mutate({ id: cat.id, payload: { status: nextStatus } });
  };

  return (
    <HasPermission code="expense.category.view">
      <div className="space-y-6">
        <PageHeader
          title="Expense Categories"
          description="Manage business expense categories (Office Rent, Electricity Bill, Salaries, etc.)."
          action={
            hasPermission("expense.category.create") ? (
              <Button onClick={handleOpenAdd} className="gap-2 text-xs font-semibold">
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            ) : null
          }
        />

        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {filteredCategories.length} of {categories.length} categories
              </div>
            </div>

            {/* Standardized Thin Table */}
            <div className="rounded-md border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                      <th className="p-3 w-12 text-center">SL</th>
                      <th className="p-3">Category Name</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Usage</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="p-3 text-center"><div className="h-4 w-4 bg-muted animate-pulse rounded mx-auto" /></td>
                          <td className="p-3"><div className="h-4 w-32 bg-muted animate-pulse rounded" /></td>
                          <td className="p-3"><div className="h-4 w-48 bg-muted animate-pulse rounded" /></td>
                          <td className="p-3 text-center"><div className="h-4 w-16 bg-muted animate-pulse rounded mx-auto" /></td>
                          <td className="p-3 text-center"><div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" /></td>
                          <td className="p-3 text-right"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No expense categories found.
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat, idx) => (
                        <tr key={cat.id} className="hover:bg-accent/40 transition-colors">
                          <td className="p-3 text-center font-medium text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-primary shrink-0" />
                              <span>{cat.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {cat.description || "—"}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleStatus(cat)}
                              title="Click to toggle status"
                              className="cursor-pointer"
                            >
                              <Badge
                                variant={cat.status === "active" ? "default" : "outline"}
                                className={`text-[10px] px-2 py-0.5 font-semibold ${
                                  cat.status === "active"
                                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {cat.status === "active" ? (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Active
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> Inactive
                                  </span>
                                )}
                              </Badge>
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <div className="font-medium text-foreground">
                              {cat.expense_count || 0} vouchers
                            </div>
                            {Number(cat.total_amount || 0) > 0 && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                ৳{Number(cat.total_amount || 0).toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasPermission("expense.category.edit") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEdit(cat)}
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Edit Category"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {/* Safe Deletion: Hide / Deactivate */}
                              {cat.status === "active" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setHidingCategory(cat)}
                                  className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                  title="Hide / Deactivate Category (Safe - keeps all expenses)"
                                >
                                  <EyeOff className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    updateMutation.mutate({ id: cat.id, payload: { status: "active" } })
                                  }
                                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                  title="Activate Category"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {/* Destructive: Permanent Hard Delete */}
                              {hasPermission("expense.category.delete") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setConfirmDeleteText("");
                                    setHardDeletingCategory(cat);
                                  }}
                                  className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                  title="Hard Delete Category & All Expenses (Permanent)"
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
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Modal */}
        <Dialog
          open={isAddOpen || !!editingCategory}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddOpen(false);
              setEditingCategory(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                {editingCategory ? "Edit Expense Category" : "Add Expense Category"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create or update category titles for tracking operational expenses.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category Name *</Label>
                <Input
                  placeholder="e.g. Office Rent, Employee Salary"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description (Optional)</Label>
                <Textarea
                  placeholder="Brief summary of what expenses fall under this category..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="text-xs min-h-[80px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <div className="flex items-center gap-4 text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === "active"}
                      onChange={() => setFormData({ ...formData, status: "active" })}
                      className="accent-primary"
                    />
                    <span>Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={formData.status === "inactive"}
                      onChange={() => setFormData({ ...formData, status: "inactive" })}
                      className="accent-primary"
                    />
                    <span>Inactive</span>
                  </label>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingCategory(null);
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="text-xs font-semibold gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {editingCategory ? "Save Changes" : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Soft Delete / Hide Confirmation Modal (Safe) */}
        <Dialog open={!!hidingCategory} onOpenChange={() => setHidingCategory(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-amber-600 flex items-center gap-2">
                <EyeOff className="h-5 w-5" />
                Hide / Deactivate Category
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground pt-1">
                Are you sure you want to deactivate and hide category{" "}
                <span className="font-bold text-foreground">"{hidingCategory?.name}"</span>?
              </DialogDescription>
            </DialogHeader>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-xs space-y-2 text-muted-foreground">
              <p className="font-semibold text-amber-700 dark:text-amber-400">Safe Deactivation:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Category will be hidden from new expense entry dropdowns.</li>
                <li>
                  All <span className="font-bold text-foreground">{hidingCategory?.expense_count || 0} existing expense transactions</span> remain untouched in the database.
                </li>
                <li>Historical reports, ledgers, and cash book calculations remain completely preserved.</li>
                <li>You can reactivate this category at any time.</li>
              </ul>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHidingCategory(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={hideMutation.isPending}
                onClick={() => hidingCategory && hideMutation.mutate(hidingCategory.id)}
                className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                {hideMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Hide / Deactivate Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hard Delete Confirmation Modal (Destructive) */}
        <Dialog
          open={!!hardDeletingCategory}
          onOpenChange={() => {
            setHardDeletingCategory(null);
            setConfirmDeleteText("");
          }}
        >
          <DialogContent className="sm:max-w-md border-rose-500/40">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Permanent Hard Delete
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground pt-1">
                Destructive Action: Permanently removes the category and ALL of its transactions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-1">
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-md p-3 text-xs space-y-2">
                <p className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertOctagon className="h-4 w-4" />
                  Irreversible Deletion Warning
                </p>
                <div className="text-[11px] text-muted-foreground space-y-1">
                  <div>
                    Category: <span className="font-bold text-foreground">{hardDeletingCategory?.name}</span>
                  </div>
                  <div>
                    Associated Transactions:{" "}
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {hardDeletingCategory?.expense_count || 0} vouchers
                    </span>
                  </div>
                  <div>
                    Total Expense Amount:{" "}
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      ৳{Number(hardDeletingCategory?.total_amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  This operation will permanently delete this category AND ALL {hardDeletingCategory?.expense_count || 0} associated expense transactions from the database.
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Cash Book daily expenses, expense reports, and ledgers will immediately update and exclude these records.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Type <span className="text-rose-600 font-bold">DELETE</span> to confirm permanent deletion:
                </Label>
                <Input
                  placeholder="DELETE"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  className="text-xs font-mono border-rose-500/30 focus-visible:ring-rose-500"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHardDeletingCategory(null);
                  setConfirmDeleteText("");
                }}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={confirmDeleteText !== "DELETE" || hardDeleteMutation.isPending}
                onClick={() =>
                  hardDeletingCategory && hardDeleteMutation.mutate(hardDeletingCategory.id)
                }
                className="text-xs font-semibold gap-2 bg-rose-600 hover:bg-rose-700"
              >
                {hardDeleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Permanently Delete Category & All Expenses
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal (Standard) */}
        <Dialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Delete Category
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to delete category{" "}
                <span className="font-bold text-foreground">"{deletingCategory?.name}"</span>?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingCategory(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}
                className="text-xs font-semibold gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </HasPermission>
  );
}
