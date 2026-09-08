'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Layers,
  PlusCircle,
  BarChart3,
  Calendar,
  Store,
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
import { FarmBalanceItem, FarmDeliveryItem } from "@/types";
import { useAuth, HasPermission } from "@/providers/auth-provider";

export default function DeliveryPage() {
  const { hasPermission } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];

  // Farms Dropdown State
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  // Form State
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayStr);
  const [trayQuantity, setTrayQuantity] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Records Table State
  const [deliveries, setDeliveries] = useState<FarmDeliveryItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FarmDeliveryItem | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTray, setEditTray] = useState<number | string>("");
  const [editDestination, setEditDestination] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<FarmDeliveryItem | null>(null);
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

  const fetchDeliveries = async () => {
    setLoadingRecords(true);
    try {
      const res = await farmService.getDeliveries({ page: 1, size: 50 });
      if (res.success && res.data) {
        setDeliveries(res.data.items || []);
      }
    } catch (err: any) {
      console.error("Failed to load delivery records:", err);
      toast.error("Failed to load delivery records");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchFarms();
    fetchDeliveries();
  }, []);

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) {
      toast.error("Please select a Farm");
      return;
    }

    if (!deliveryDate) {
      toast.error("Please select a Date");
      return;
    }

    const qty = parseFloat(trayQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Tray Quantity must be greater than 0");
      return;
    }

    const destTrimmed = destination.trim();
    if (!destTrimmed) {
      toast.error("Store / Destination Name is required");
      return;
    }

    // Check against current selected farm balance
    const currentFarm = farms.find((f) => f.id === selectedFarmId);
    if (currentFarm && qty > currentFarm.available_tray) {
      toast.error(
        `Insufficient trays. Farm "${currentFarm.name}" only has ${currentFarm.available_tray} available trays.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await farmService.createDelivery({
        farm_id: selectedFarmId,
        delivery_date: deliveryDate,
        tray_quantity: qty,
        destination: destTrimmed,
      });

      if (res.success) {
        toast.success(`Delivery of ${qty} trays to "${destTrimmed}" recorded successfully`);
        setTrayQuantity(""); // Clear quantity
        setDestination(""); // Clear destination
        // Refresh records and farms
        fetchDeliveries();
        fetchFarms();
        // Stay on page, no redirect
      } else {
        toast.error(res.message || "Failed to record delivery");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to record delivery";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (rec: FarmDeliveryItem) => {
    setEditingRecord(rec);
    setEditDate(rec.delivery_date);
    setEditTray(rec.tray_quantity);
    setEditDestination(rec.destination);
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

    const dest = editDestination.trim();
    if (!dest) {
      toast.error("Store / Destination Name cannot be empty");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await farmService.updateDelivery(editingRecord.id, {
        delivery_date: editDate,
        tray_quantity: qty,
        destination: dest,
      });

      if (res.success) {
        toast.success("Delivery record updated successfully");
        setEditModalOpen(false);
        setEditingRecord(null);
        fetchDeliveries();
        fetchFarms();
      } else {
        toast.error(res.message || "Failed to update delivery");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update delivery";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteModal = (rec: FarmDeliveryItem) => {
    setDeletingRecord(rec);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;

    setDeleting(true);
    try {
      const res = await farmService.deleteDelivery(deletingRecord.id);
      if (res.success) {
        toast.success("Delivery record deleted successfully");
        setDeleteModalOpen(false);
        setDeletingRecord(null);
        fetchDeliveries();
        fetchFarms();
      } else {
        toast.error(res.message || "Failed to delete delivery");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete delivery";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const currentFarm = farms.find((f) => f.id === selectedFarmId);

  return (
    <HasPermission
      code={["farm.delivery.view", "farm.delivery.create", "farm.delivery.edit", "farm.delivery.delete", "farm.report"]}
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Delivery.
        </div>
      }
    >
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Delivery</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Record delivered trays to subtract stock from the selected farm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission(["farm.view", "farm.create", "farm.edit", "farm.delete"]) && (
              <Link href="/farm">
                <Button variant="outline" size="sm" className="text-xs">
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Manage Farm
                </Button>
              </Link>
            )}
            {hasPermission(["farm.production.view", "farm.production.create"]) && (
              <Link href="/farm/production">
                <Button variant="outline" size="sm" className="text-xs">
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                  Production
                </Button>
              </Link>
            )}
            {hasPermission("farm.report") && (
              <Link href="/farm/report">
                <Button variant="outline" size="sm" className="text-xs">
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                  Report
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Form Card */}
        {hasPermission("farm.delivery.create") && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="py-4 px-6 border-b border-border">
              <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
                <span>Add Delivery</span>
                {currentFarm && (
                  <Badge variant="outline" className="text-xs font-mono font-medium text-blue-600 border-blue-500/30">
                    Available: {currentFarm.available_tray} Trays
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Record trays delivered from a farm. The store or destination name is entered manually (e.g. Shop, Ayonal, Karim).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleAddDelivery} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                  {/* Date Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      Date <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
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
                      placeholder="e.g. 50"
                      value={trayQuantity}
                      onChange={(e) => setTrayQuantity(e.target.value)}
                      disabled={submitting}
                      className="text-xs h-9 font-mono"
                    />
                  </div>

                  {/* Store / Destination */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Store className="h-3 w-3 text-muted-foreground" />
                      Store / Destination <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Shop, Ayonal, Karim"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      disabled={submitting}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-muted-foreground">
                    You can record multiple deliveries consecutively. Each submission creates one delivery record.
                  </p>
                  <Button
                    type="submit"
                    disabled={submitting || !selectedFarmId || !trayQuantity || !destination.trim()}
                    className="min-w-[140px] text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Delivery
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

      {/* Recent Delivery Records Table */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Recent Delivery Records ({deliveries.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              History of recorded deliveries. You can edit or delete entries below.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDeliveries}
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
                  <th className="px-4 py-3 text-right font-bold text-blue-600">Tray</th>
                  <th className="px-4 py-3">Store / Destination</th>
                  {hasPermission(["farm.delivery.edit", "farm.delivery.delete"]) && (
                    <th className="px-4 py-3 text-center w-36">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingRecords ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={hasPermission(["farm.delivery.edit", "farm.delivery.delete"]) ? 6 : 5} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={hasPermission(["farm.delivery.edit", "farm.delivery.delete"]) ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                      <Truck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="font-medium">No delivery records found.</p>
                      <p className="text-[11px] mt-1">Use the form above to add a delivery record.</p>
                    </td>
                  </tr>
                ) : (
                  deliveries.map((rec, idx) => (
                    <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {rec.delivery_date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {rec.farm_name || "Unknown Farm"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">
                        -{Number(rec.tray_quantity).toLocaleString()} Trays
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-medium text-xs">
                          {rec.destination}
                        </Badge>
                      </td>
                      {hasPermission(["farm.delivery.edit", "farm.delivery.delete"]) && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {hasPermission("farm.delivery.edit") && (
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
                            {hasPermission("farm.delivery.delete") && (
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
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Delivery Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Edit Delivery</DialogTitle>
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Store / Destination</label>
              <Input
                type="text"
                value={editDestination}
                onChange={(e) => setEditDestination(e.target.value)}
                disabled={savingEdit}
                className="text-xs h-9"
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

      {/* Delete Delivery In-App Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">Delete Delivery Record</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-2">
              Are you sure you want to delete this delivery record of{" "}
              <strong className="text-foreground">{deletingRecord?.tray_quantity} trays</strong> to{" "}
              <strong className="text-foreground">{deletingRecord?.destination}</strong> from{" "}
              <strong className="text-foreground">{deletingRecord?.farm_name}</strong> on{" "}
              <strong className="text-foreground">{deletingRecord?.delivery_date}</strong>?
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
