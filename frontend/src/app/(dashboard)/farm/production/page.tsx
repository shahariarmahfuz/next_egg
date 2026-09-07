'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  PlusCircle,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Layers,
  Truck,
  BarChart3,
  Calendar,
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
import { FarmBalanceItem, FarmProductionItem } from "@/types";
import { useAuth } from "@/providers/auth-provider";

export default function ProductionPage() {
  const { hasPermission } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];

  // Farms Dropdown State
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  // Form State
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [productionDate, setProductionDate] = useState(todayStr);
  const [trayQuantity, setTrayQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Records Table State
  const [productions, setProductions] = useState<FarmProductionItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FarmProductionItem | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTray, setEditTray] = useState<number | string>("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<FarmProductionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFarms = async () => {
    setLoadingFarms(true);
    try {
      const res = await farmService.getFarms();
      if (res.success && res.data) {
        setFarms(res.data);
        if (res.data.length > 0 && !selectedFarmId) {
          setSelectedFarmId(res.data[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load farms:", err);
    } finally {
      setLoadingFarms(false);
    }
  };

  const fetchProductions = async () => {
    setLoadingRecords(true);
    try {
      const res = await farmService.getProductions({ page: 1, size: 50 });
      if (res.success && res.data) {
        setProductions(res.data.items || []);
      }
    } catch (err: any) {
      console.error("Failed to load production records:", err);
      toast.error("Failed to load production records");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchFarms();
    fetchProductions();
  }, []);

  const handleAddProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) {
      toast.error("Please select a Farm");
      return;
    }

    if (!productionDate) {
      toast.error("Please select a Date");
      return;
    }

    const qty = parseFloat(trayQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Tray Quantity must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await farmService.createProduction({
        farm_id: selectedFarmId,
        production_date: productionDate,
        tray_quantity: qty,
      });

      if (res.success) {
        toast.success("Production recorded successfully");
        setTrayQuantity(""); // Clear tray input
        // Refresh records and farms (to update live balances)
        fetchProductions();
        fetchFarms();
        // Stay on page, no redirect
      } else {
        toast.error(res.message || "Failed to record production");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to record production";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (rec: FarmProductionItem) => {
    setEditingRecord(rec);
    setEditDate(rec.production_date);
    setEditTray(rec.tray_quantity);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const qty = parseFloat(String(editTray));
    if (isNaN(qty) || qty <= 0) {
      toast.error("Tray Quantity must be greater than 0");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await farmService.updateProduction(editingRecord.id, {
        production_date: editDate,
        tray_quantity: qty,
      });

      if (res.success) {
        toast.success("Production record updated successfully");
        setEditModalOpen(false);
        setEditingRecord(null);
        fetchProductions();
        fetchFarms();
      } else {
        toast.error(res.message || "Failed to update production");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update production";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteModal = (rec: FarmProductionItem) => {
    setDeletingRecord(rec);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;

    setDeleting(true);
    try {
      const res = await farmService.deleteProduction(deletingRecord.id);
      if (res.success) {
        toast.success("Production record deleted successfully");
        setDeleteModalOpen(false);
        setDeletingRecord(null);
        fetchProductions();
        fetchFarms();
      } else {
        toast.error(res.message || "Failed to delete production");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete production";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
            <PlusCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Production</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Add produced trays to increase available stock for the selected farm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/farm">
            <Button variant="outline" size="sm" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              Manage Farm
            </Button>
          </Link>
          <Link href="/farm/delivery">
            <Button variant="outline" size="sm" className="text-xs">
              <Truck className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
              Delivery
            </Button>
          </Link>
          <Link href="/farm/report">
            <Button variant="outline" size="sm" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
              Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Form Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-border">
          <CardTitle className="text-base font-semibold text-foreground">
            Add Production
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Record harvested or produced egg trays for the selected farm.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleAddProduction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Farm Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Farm <span className="text-destructive">*</span>
                </label>
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  disabled={loadingFarms || submitting}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {loadingFarms ? (
                    <option value="">Loading farms...</option>
                  ) : farms.length === 0 ? (
                    <option value="">No farms available</option>
                  ) : (
                    farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (Available: {f.available_tray} trays)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  disabled={submitting}
                  className="text-xs h-9"
                />
              </div>

              {/* Tray Quantity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tray Quantity <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder="e.g. 100"
                  value={trayQuantity}
                  onChange={(e) => setTrayQuantity(e.target.value)}
                  disabled={submitting}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={submitting || !selectedFarmId || !trayQuantity}
                className="min-w-[140px] text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Production
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Production Records Table */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Recent Production Records ({productions.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              History of recorded production entries. You can edit or delete entries below.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchProductions}
            disabled={loadingRecords}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingRecords ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">SL</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Farm</th>
                  <th className="px-4 py-3 text-right font-bold text-amber-600">Tray Quantity</th>
                  <th className="px-4 py-3 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingRecords ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : productions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      <PlusCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="font-medium">No production records found.</p>
                      <p className="text-[11px] mt-1">Use the form above to add a production record.</p>
                    </td>
                  </tr>
                ) : (
                  productions.map((rec, idx) => (
                    <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {rec.production_date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {rec.farm_name || "Unknown Farm"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600">
                        +{Number(rec.tray_quantity).toLocaleString()} Trays
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasPermission(["farm.manage", "farm.create", "farm.production"]) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(rec)}
                              className="h-7 px-2.5 text-xs"
                            >
                              <Edit2 className="h-3 w-3 mr-1 text-primary" />
                              Edit
                            </Button>
                          )}
                          {hasPermission(["farm.manage", "farm.create", "farm.production"]) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteModal(rec)}
                              className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
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
        </CardContent>
      </Card>

      {/* Edit Production Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Edit Production</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Farm: <strong className="text-foreground">{editingRecord?.farm_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Date</label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                disabled={savingEdit}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tray Quantity</label>
              <Input
                type="number"
                step="any"
                min="0.1"
                value={editTray}
                onChange={(e) => setEditTray(e.target.value)}
                disabled={savingEdit}
                className="text-xs h-9 font-mono"
              />
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

      {/* Delete Production In-App Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">Delete Production Record</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-2">
              Are you sure you want to delete this production record of{" "}
              <strong className="text-foreground">{editingRecord?.tray_quantity || deletingRecord?.tray_quantity} trays</strong> from{" "}
              <strong className="text-foreground">{deletingRecord?.farm_name}</strong> on{" "}
              <strong className="text-foreground">{deletingRecord?.production_date}</strong>?
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
  );
}
