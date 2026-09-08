'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Building2,
  PlusCircle,
  Truck,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { farmService } from "@/services/api";
import { FarmBalanceItem } from "@/types";
import { useAuth, HasPermission } from "@/providers/auth-provider";

export default function ManageFarmPage() {
  const { hasPermission } = useAuth();
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Farm Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<FarmBalanceItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editPreviousTray, setEditPreviousTray] = useState<number | string>(0);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Farm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingFarm, setDeletingFarm] = useState<FarmBalanceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFarms = async () => {
    setLoading(true);
    try {
      const res = await farmService.getFarms();
      if (res.success && res.data) {
        setFarms(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load farms:", err);
      toast.error("Failed to load farms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarms();
  }, []);

  const openEditModal = (farm: FarmBalanceItem) => {
    setEditingFarm(farm);
    setEditName(farm.name);
    setEditPreviousTray(farm.previous_tray ?? 0);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFarm) return;

    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Farm Name cannot be empty");
      return;
    }

    const prevQty = parseFloat(String(editPreviousTray));
    if (isNaN(prevQty) || prevQty < 0) {
      toast.error("Opening / Previous Tray must be a positive number or 0");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await farmService.updateFarm(editingFarm.id, {
        name: trimmed,
        previous_tray: prevQty,
      });

      if (res.success) {
        toast.success(`Farm "${trimmed}" updated successfully`);
        setEditModalOpen(false);
        setEditingFarm(null);
        fetchFarms();
      } else {
        toast.error(res.message || "Failed to update farm");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update farm";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteModal = (farm: FarmBalanceItem) => {
    setDeletingFarm(farm);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingFarm) return;

    setDeleting(true);
    try {
      const res = await farmService.deleteFarm(deletingFarm.id);
      if (res.success) {
        toast.success(`Farm "${deletingFarm.name}" deleted successfully`);
        setDeleteModalOpen(false);
        setDeletingFarm(null);
        fetchFarms();
      } else {
        toast.error(res.message || "Failed to delete farm");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete farm";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <HasPermission
      code={["farm.view", "farm.create", "farm.edit", "farm.delete"]}
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Farms.
        </div>
      }
    >
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 border-b border-border pb-3 sm:pb-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg sm:rounded-xl shrink-0">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Manage Farm</h1>
              <p className="text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Manage existing farms and view current live available tray quantities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission("farm.create") && (
              <Link href="/farm/add">
                <Button size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Farm
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFarms}
              disabled={loading}
              className="h-8 px-2.5 text-xs sm:h-9 sm:px-3"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Farms Table Card */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="py-2.5 px-3 sm:py-4 sm:px-6 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                Farms List ({farms.length})
              </CardTitle>
            </div>
            <CardDescription className="hidden sm:block text-xs text-muted-foreground">
              Current available trays are calculated as: Opening Tray + Total Production - Total Delivery
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold text-[11px] sm:text-xs">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 w-8 sm:w-12 text-center">SL</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3">Farm Name</th>
                    <th className="hidden md:table-cell px-4 py-2 sm:py-3 text-right whitespace-nowrap">Opening Tray</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-foreground whitespace-nowrap">
                      <span className="hidden sm:inline">Available Tray</span>
                      <span className="sm:hidden">Available</span>
                    </th>
                    {hasPermission(["farm.edit", "farm.delete"]) && (
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-20 sm:w-36">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="h-10 sm:h-12">
                        <td colSpan={hasPermission(["farm.edit", "farm.delete"]) ? 5 : 4} className="p-3">
                          <Skeleton className="h-5 sm:h-7 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : farms.length === 0 ? (
                    <tr>
                      <td colSpan={hasPermission(["farm.edit", "farm.delete"]) ? 5 : 4} className="px-4 py-8 sm:py-12 text-center text-muted-foreground">
                        <Building2 className="h-8 w-8 sm:h-9 sm:w-9 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="font-semibold text-xs sm:text-sm">No farms found</p>
                        <p className="text-xs mt-0.5">Get started by creating your first farm.</p>
                        {hasPermission("farm.create") && (
                          <Link href="/farm/add" className="inline-block mt-2.5">
                            <Button size="sm" variant="outline" className="text-xs h-8">
                              <Plus className="h-3.5 w-3.5 mr-1" /> Add Farm
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : (
                    farms.map((farm, idx) => (
                      <tr key={farm.id} className="hover:bg-muted/30 transition-colors h-11 sm:h-12">
                        <td className="px-2 sm:px-4 py-2 align-middle text-center font-mono text-muted-foreground text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-2 sm:px-4 py-2 align-middle">
                          <div className="font-semibold text-xs sm:text-sm text-foreground truncate max-w-[130px] sm:max-w-none" title={farm.name}>
                            {farm.name}
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                            {farm.code && <span className="truncate max-w-[100px]">{farm.code}</span>}
                            <span className="md:hidden text-muted-foreground/75">· Open: {Number(farm.previous_tray || 0).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-2 align-middle text-right font-medium text-muted-foreground">
                          {Number(farm.previous_tray || 0).toLocaleString()}
                        </td>
                        <td className="px-2 sm:px-4 py-2 align-middle text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                            {Number(farm.available_tray || 0).toLocaleString()}
                          </span>
                          <span className="block text-[9px] text-muted-foreground sm:hidden">trays</span>
                        </td>
                        {hasPermission(["farm.edit", "farm.delete"]) && (
                          <td className="px-2 sm:px-4 py-2 align-middle text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {hasPermission("farm.edit") && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openEditModal(farm)}
                                  className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary sm:w-auto sm:h-7 sm:px-2.5 sm:text-xs"
                                  title="Edit Farm"
                                >
                                  <Edit2 className="h-3.5 w-3.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>
                              )}
                              {hasPermission("farm.delete") && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openDeleteModal(farm)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:h-7 sm:px-2.5 sm:text-xs"
                                  title="Delete Farm"
                                >
                                  <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1 sm:pt-2">
          {hasPermission("farm.create") && (
            <Link href="/farm/add" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <Plus className="h-4 w-4 text-emerald-600 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Add Farm</span>
                </div>
              </Card>
            </Link>
          )}
          {hasPermission(["farm.production.view", "farm.production.create"]) && (
            <Link href="/farm/production" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <PlusCircle className="h-4 w-4 text-amber-500 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Production</span>
                </div>
              </Card>
            </Link>
          )}
          {hasPermission(["farm.delivery.view", "farm.delivery.create"]) && (
            <Link href="/farm/delivery" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <Truck className="h-4 w-4 text-blue-500 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Delivery</span>
                </div>
              </Card>
            </Link>
          )}
          {hasPermission("farm.report") && (
            <Link href="/farm/report" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <BarChart3 className="h-4 w-4 text-indigo-500 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Report</span>
                </div>
              </Card>
            </Link>
          )}
        </div>

      {/* Edit Farm Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Edit Farm</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify the farm name and opening / previous tray starting balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="editName" className="text-xs font-semibold text-foreground">
                Farm Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="editName"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={savingEdit}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="editPreviousTray" className="text-xs font-semibold text-foreground">
                Opening / Previous Tray
              </label>
              <Input
                id="editPreviousTray"
                type="number"
                step="any"
                min="0"
                value={editPreviousTray}
                onChange={(e) => setEditPreviousTray(e.target.value)}
                disabled={savingEdit}
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                This is the starting stock balance when tracking begins. Changing it updates the current available tray.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(false)}
                disabled={savingEdit}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEdit} className="text-xs min-w-[90px]">
                {savingEdit ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Farm In-App Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">Delete Farm</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-2">
              Are you sure you want to delete <strong className="text-foreground">{deletingFarm?.name}</strong>?
              This action cannot be undone and will delete associated history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="text-xs min-w-[90px]"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Confirm Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </HasPermission>
);
}
