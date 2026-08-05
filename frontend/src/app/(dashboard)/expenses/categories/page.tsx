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

export default function ExpenseCategoriesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategory | null>(null);

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
      setEditingCategory(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update category");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setDeletingCategory(null);
    },
    onError: (err: any) => {
      alert(err.message || "Cannot delete category");
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
                          <td className="p-3 text-center font-medium text-foreground">
                            {cat.expense_count || 0} vouchers
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
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
                              {hasPermission("expense.category.delete") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingCategory(cat)}
                                  className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                                  title="Delete Category"
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

        {/* Delete Confirmation Modal */}
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
