'use client';

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Sprout,
  Plus,
  Trash2,
  Save,
  Loader2,
  Calendar,
  Layers,
  MapPin,
  RotateCcw,
  BarChart3,
  RefreshCw,
  Eye,
  Edit,
  Building2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { FarmBalanceItem, FarmDailyEntryItem } from "@/types";
import { AddFarmModal } from "@/components/farm/add-farm-modal";
import { FarmViewEntryModal } from "@/components/farm/farm-view-entry-modal";
import { FarmEditEntryModal } from "@/components/farm/farm-edit-entry-modal";
import { FarmDeleteModal } from "@/components/farm/farm-delete-modal";
import { toast } from "sonner";

interface LocalDeliveryRow {
  destination: string;
  tray_quantity: string;
  notes?: string;
}

export default function FarmManagementPage() {
  const todayStr = new Date().toISOString().split("T")[0];

  // Data states
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [entries, setEntries] = useState<FarmDailyEntryItem[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [productionTrays, setProductionTrays] = useState<string>("");
  const [deliveryRows, setDeliveryRows] = useState<LocalDeliveryRow[]>([]);
  const [note, setNote] = useState<string>("");

  // Modals
  const [isAddFarmOpen, setIsAddFarmOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<FarmDailyEntryItem | null>(null);
  const [editingEntry, setEditingEntry] = useState<FarmDailyEntryItem | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<FarmDailyEntryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Previous Tray adjustment modal
  const [isAdjustPrevOpen, setIsAdjustPrevOpen] = useState(false);
  const [adjustPrevQty, setAdjustPrevQty] = useState("");
  const [adjustingPrev, setAdjustingPrev] = useState(false);

  // Active farm data
  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  // Load farms
  const loadFarms = useCallback(async (preferredFarmId?: string) => {
    setLoadingFarms(true);
    try {
      const res = await farmService.getFarms();
      if (res.success && res.data) {
        setFarms(res.data);
        if (res.data.length > 0) {
          if (preferredFarmId && res.data.some((f) => f.id === preferredFarmId)) {
            setSelectedFarmId(preferredFarmId);
          } else if (!selectedFarmId || !res.data.some((f) => f.id === selectedFarmId)) {
            setSelectedFarmId(res.data[0].id);
          }
        } else {
          setSelectedFarmId("");
        }
      }
    } catch (err) {
      console.error("Failed to load farms:", err);
      toast.error("Failed to load farms");
    } finally {
      setLoadingFarms(false);
    }
  }, [selectedFarmId]);

  // Load daily entries
  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const res = await farmService.getEntries({ size: 30 });
      if (res.success && res.data) {
        setEntries(res.data.items || []);
      }
    } catch (err) {
      console.error("Failed to load farm entries:", err);
      toast.error("Failed to load farm entries");
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    loadFarms();
    loadEntries();
  }, [loadFarms, loadEntries]);

  // Add a delivery row
  const handleAddDeliveryRow = () => {
    setDeliveryRows((prev) => [...prev, { destination: "", tray_quantity: "", notes: "" }]);
  };

  // Remove a delivery row
  const handleRemoveDeliveryRow = (idx: number) => {
    setDeliveryRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Update a delivery row field
  const handleDeliveryRowChange = (idx: number, field: keyof LocalDeliveryRow, value: string) => {
    setDeliveryRows((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Calculations for live preview
  const prodNum = parseFloat(productionTrays) || 0;
  const delivTotal = deliveryRows.reduce((sum, r) => {
    const q = parseFloat(r.tray_quantity);
    return sum + (isNaN(q) ? 0 : q);
  }, 0);
  const netChange = prodNum - delivTotal;
  const currentAvailable = selectedFarm ? selectedFarm.available_tray : 0;
  const previewAvailable = currentAvailable + netChange;

  // Submit main Farm Management form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFarmId) {
      toast.error("Please select a Farm");
      return;
    }

    if (!selectedDate) {
      toast.error("Please select a transaction Date");
      return;
    }

    // Validate delivery rows if any
    for (let i = 0; i < deliveryRows.length; i++) {
      const row = deliveryRows[i];
      if (!row.destination.trim()) {
        toast.error(`Delivery Entry #${i + 1}: Destination / Name is required`);
        return;
      }
      const q = parseFloat(row.tray_quantity);
      if (isNaN(q) || q <= 0) {
        toast.error(`Delivery Entry #${i + 1}: Tray Quantity must be greater than 0`);
        return;
      }
    }

    // Validate if delivery exceeds stock
    if (previewAvailable < 0) {
      toast.error(
        `Insufficient trays! Farm has ${currentAvailable} trays. Requested net change (${netChange}) would result in ${previewAvailable} trays.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        farm_id: selectedFarmId,
        date: selectedDate,
        production_trays: prodNum,
        deliveries: deliveryRows.map((r) => ({
          destination: r.destination.trim(),
          tray_quantity: parseFloat(r.tray_quantity),
          notes: r.notes?.trim() || undefined,
        })),
        notes: note.trim() || undefined,
      };

      const res = await farmService.createEntry(payload);
      if (res.success) {
        toast.success("Farm entry saved successfully!");
        // Reset inputs
        setProductionTrays("");
        setDeliveryRows([]);
        setNote("");

        // Refresh live data from backend (source of truth)
        await loadFarms(selectedFarmId);
        await loadEntries();
      } else {
        toast.error(res.message || "Failed to save farm entry");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save farm entry";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;
    setIsDeleting(true);
    try {
      const res = await farmService.deleteEntry(deletingEntry.id);
      if (res.success) {
        toast.success("Farm entry deleted and balance recalculated!");
        setDeletingEntry(null);
        await loadFarms(selectedFarmId);
        await loadEntries();
      } else {
        toast.error(res.message || "Failed to delete entry");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete entry";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Adjust Previous Tray
  const handleSavePreviousTray = async () => {
    if (!selectedFarmId) return;
    const qty = parseFloat(adjustPrevQty);
    if (isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid non-negative tray balance");
      return;
    }
    setAdjustingPrev(true);
    try {
      const res = await farmService.updatePreviousTray(selectedFarmId, qty);
      if (res.success) {
        toast.success(`Opening balance updated to ${qty} trays!`);
        setIsAdjustPrevOpen(false);
        await loadFarms(selectedFarmId);
      } else {
        toast.error(res.message || "Failed to update previous tray");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update previous tray";
      toast.error(msg);
    } finally {
      setAdjustingPrev(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Farm Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Single-page physical tray tracking: Production + Deliveries (Pure Tray Inventory)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddFarmOpen(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Farm
          </Button>
          <Link href="/farm/report">
            <Button variant="outline" size="sm" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1 text-blue-500" />
              Farm Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Single-Page Workflow Form */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center space-x-2">
            <Sprout className="h-4 w-4 text-emerald-600" />
            <span>Daily Farm Entry</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Record date, production, and multiple delivery dispatches together on this single page.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Top Row: Date & Farm Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              {/* Farm Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    Farm <span className="text-destructive">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddFarmOpen(true)}
                    className="text-[11px] text-emerald-600 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Add Farm
                  </button>
                </div>

                {loadingFarms ? (
                  <Skeleton className="h-9 w-full" />
                ) : farms.length === 0 ? (
                  <div className="flex items-center gap-2 p-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400">
                    <span>No farms found.</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => setIsAddFarmOpen(true)}
                      className="p-0 h-auto text-xs font-semibold text-emerald-600"
                    >
                      + Add Farm Now
                    </Button>
                  </div>
                ) : (
                  <select
                    value={selectedFarmId}
                    onChange={(e) => setSelectedFarmId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.code}) — {f.available_tray.toLocaleString()} trays available
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Selected Farm Live Stats Bar */}
            {selectedFarm && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Farm:</span>
                    <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Sprout className="h-3.5 w-3.5 text-emerald-600" />
                      {selectedFarm.name}
                    </span>
                  </div>

                  <div className="border-l border-border pl-4">
                    <span className="text-muted-foreground block text-[11px] flex items-center gap-1">
                      <RotateCcw className="h-3 w-3 text-amber-500" /> Opening / Previous Tray:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
                        {selectedFarm.previous_tray.toLocaleString()} trays
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustPrevQty(String(selectedFarm.previous_tray || 0));
                          setIsAdjustPrevOpen(true);
                        }}
                        className="text-[10px] text-amber-600 hover:underline font-medium"
                      >
                        (Adjust)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Harvest:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      +{selectedFarm.total_production.toLocaleString()} trays
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Delivered:</span>
                    <span className="font-mono font-semibold text-blue-600">
                      -{selectedFarm.total_delivered.toLocaleString()} trays
                    </span>
                  </div>

                  <div className="border-l border-border pl-4">
                    <span className="text-muted-foreground block text-[11px] font-semibold text-primary">
                      Current Available:
                    </span>
                    <Badge variant="outline" className="font-mono font-bold text-sm bg-primary/10 text-primary border-primary/30">
                      {selectedFarm.available_tray.toLocaleString()} trays
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Production / Tray */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                Production / Tray
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 100"
                value={productionTrays}
                onChange={(e) => setProductionTrays(e.target.value)}
                className="text-xs font-mono font-semibold text-emerald-600 max-w-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Trays harvested on this date. Production is optional (leave empty or 0 if none).
              </p>
            </div>

            {/* Delivery Section */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    Delivery Dispatches
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Multiple destinations on this date. Quantity tracking only (no financial ledger).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddDeliveryRow}
                  className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  + Add Delivery
                </Button>
              </div>

              {deliveryRows.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center bg-muted/10">
                  <p className="text-xs text-muted-foreground">
                    No delivery entries for this date yet. Click{" "}
                    <button
                      type="button"
                      onClick={handleAddDeliveryRow}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      + Add Delivery
                    </button>{" "}
                    if trays were delivered or dispatched.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase">
                    <div className="col-span-5">Destination / Name</div>
                    <div className="col-span-3 text-right">Trays</div>
                    <div className="col-span-3">Note (Optional)</div>
                    <div className="col-span-1 text-center">Action</div>
                  </div>

                  {deliveryRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 rounded-lg bg-muted/20 border border-border items-center"
                    >
                      <div className="col-span-5">
                        <Input
                          type="text"
                          placeholder="e.g. Shop, Ayonal, Karim"
                          value={row.destination}
                          onChange={(e) => handleDeliveryRowChange(idx, "destination", e.target.value)}
                          className="text-xs h-8"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="Trays (e.g. 20)"
                          value={row.tray_quantity}
                          onChange={(e) => handleDeliveryRowChange(idx, "tray_quantity", e.target.value)}
                          className="text-xs h-8 text-right font-mono font-medium text-blue-600"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="text"
                          placeholder="Note"
                          value={row.notes || ""}
                          onChange={(e) => handleDeliveryRowChange(idx, "notes", e.target.value)}
                          className="text-xs h-8"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDeliveryRow(idx)}
                          className="h-7 w-7 text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddDeliveryRow}
                      className="text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 px-2 h-7"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      + Add another delivery
                    </Button>
                    <div className="text-xs font-mono font-bold text-blue-600">
                      Total Delivery: {delivTotal} trays
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Tray Balance Preview Bar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Live Available Tray Calculation
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Formula: Opening ({selectedFarm?.previous_tray || 0}) + Total Production - Total Delivery
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-2.5 rounded-lg bg-muted/40 text-center">
                  <span className="text-[10px] uppercase text-muted-foreground block">Current Balance</span>
                  <span className="text-base font-bold font-mono text-foreground">
                    {currentAvailable.toLocaleString()} trays
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-center">
                  <span className="text-[10px] uppercase text-emerald-600 block">+ Today's Prod</span>
                  <span className="text-base font-bold font-mono text-emerald-600">
                    +{prodNum.toLocaleString()}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-500/10 text-center">
                  <span className="text-[10px] uppercase text-blue-600 block">- Today's Deliv</span>
                  <span className="text-base font-bold font-mono text-blue-600">
                    -{delivTotal.toLocaleString()}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <span className="text-[10px] uppercase text-primary font-bold block">Preview Available</span>
                  <span
                    className={`text-base font-extrabold font-mono ${
                      previewAvailable < 0 ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {previewAvailable.toLocaleString()} trays
                  </span>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Note (Optional)</label>
              <Textarea
                rows={2}
                placeholder="Optional notes for this daily transaction..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-xs resize-none"
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={submitting || !selectedFarmId}
                className="min-w-[140px] text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Entry
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Farm List & Current Tray Balances View */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Farm List & Tray Inventory
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Current inventory balances: Previous Tray + Total Production - Total Delivery = Available
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadFarms()}
            disabled={loadingFarms}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingFarms ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">SL</th>
                  <th className="px-4 py-3">Farm Name</th>
                  <th className="px-4 py-3 text-right">Previous Tray</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Total Production</th>
                  <th className="px-4 py-3 text-right text-blue-600">Total Delivery</th>
                  <th className="px-4 py-3 text-right font-bold">Available Tray</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingFarms ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : farms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No farms registered yet. Click "Add Farm" above.
                    </td>
                  </tr>
                ) : (
                  farms.map((farm, idx) => (
                    <tr
                      key={farm.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        farm.id === selectedFarmId ? "bg-emerald-500/5 font-medium" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground">{farm.name}</span>
                          {farm.code && (
                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                              {farm.code}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground font-mono">
                        {farm.previous_tray.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 font-mono">
                        +{farm.total_production.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600 font-mono">
                        -{farm.total_delivered.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-extrabold text-foreground px-2 py-0.5 rounded bg-muted/40 font-mono">
                          {farm.available_tray.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            farm.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                              : "bg-muted text-muted-foreground text-[10px]"
                          }
                        >
                          {farm.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Farm Management Entries (Daily Transactions) */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Recent Farm Entries ({entries.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Manage recorded daily entries (View, Edit, Delete).
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadEntries}
            disabled={loadingEntries}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingEntries ? "animate-spin" : ""}`} />
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
                  <th className="px-4 py-3 text-right text-emerald-600">Production</th>
                  <th className="px-4 py-3">Deliveries Breakdown</th>
                  <th className="px-4 py-3 text-right text-blue-600">Total Delivery</th>
                  <th className="px-4 py-3 text-right font-bold">Net Trays</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingEntries ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No farm transactions recorded yet. Use the form above to record your first entry.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry, idx) => {
                    const net = entry.production_trays - entry.total_delivery_trays;
                    return (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          {format(new Date(entry.date), "dd MMM yyyy")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {entry.farm_name || "Farm"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono">
                          {entry.production_trays > 0 ? `+${entry.production_trays}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {entry.deliveries.length === 0 ? (
                            <span className="text-muted-foreground/60 italic">No delivery</span>
                          ) : (
                            <div className="space-y-0.5">
                              {entry.deliveries.map((d, dIdx) => (
                                <div key={dIdx} className="flex items-center gap-1.5 text-blue-600">
                                  <span className="font-medium">{d.destination}:</span>
                                  <span className="font-mono font-bold">{d.tray_quantity} trays</span>
                                  {d.notes && (
                                    <span className="text-[10px] text-muted-foreground italic">
                                      ({d.notes})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 font-mono">
                          {entry.total_delivery_trays > 0 ? `-${entry.total_delivery_trays}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold font-mono">
                          <span
                            className={
                              net > 0 ? "text-emerald-600" : net < 0 ? "text-rose-600" : "text-muted-foreground"
                            }
                          >
                            {net > 0 ? `+${net}` : net}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingEntry(entry)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingEntry(entry)}
                              className="h-7 w-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                              title="Edit Entry"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingEntry(entry)}
                              className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                              title="Delete Entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Inline Add Farm Modal */}
      <AddFarmModal
        isOpen={isAddFarmOpen}
        onClose={() => setIsAddFarmOpen(false)}
        onSuccess={async (newFarmId) => {
          await loadFarms(newFarmId);
        }}
      />

      {/* View Entry Modal */}
      <FarmViewEntryModal
        entry={viewingEntry}
        isOpen={Boolean(viewingEntry)}
        onClose={() => setViewingEntry(null)}
      />

      {/* Edit Entry Modal */}
      <FarmEditEntryModal
        entry={editingEntry}
        isOpen={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        onSuccess={async () => {
          await loadFarms(selectedFarmId);
          await loadEntries();
        }}
      />

      {/* Delete Entry Modal */}
      <FarmDeleteModal
        isOpen={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Farm Entry"
        description={`Are you sure you want to delete the entry for ${deletingEntry?.farm_name || "Farm"} on ${
          deletingEntry?.date ? format(new Date(deletingEntry.date), "dd MMM yyyy") : ""
        }? Available tray balance will be recalculated.`}
        isDeleting={isDeleting}
      />

      {/* Quick Adjust Previous Tray Dialog */}
      <Dialog open={isAdjustPrevOpen} onOpenChange={setIsAdjustPrevOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <RotateCcw className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-foreground">
                Adjust Opening / Previous Tray Balance
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Set initial tray stock on-hand for {selectedFarm?.name || "Farm"} (Non-financial opening balance).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Previous Tray Quantity</label>
              <Input
                type="number"
                step="any"
                min="0"
                value={adjustPrevQty}
                onChange={(e) => setAdjustPrevQty(e.target.value)}
                className="text-xs font-mono"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustPrevOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSavePreviousTray}
              disabled={adjustingPrev}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {adjustingPrev ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Balance"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
