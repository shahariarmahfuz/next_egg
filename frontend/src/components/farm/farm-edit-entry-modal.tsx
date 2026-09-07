'use client';

import React, { useState, useEffect } from "react";
import { Loader2, Layers, Calendar, Plus, Trash2, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FarmDailyEntryItem, DeliveryItem } from "@/types";
import { farmService } from "@/services/api";
import { toast } from "sonner";

interface FarmEditEntryModalProps {
  entry: FarmDailyEntryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FarmEditEntryModal({
  entry,
  isOpen,
  onClose,
  onSuccess,
}: FarmEditEntryModalProps) {
  const [date, setDate] = useState("");
  const [productionTrays, setProductionTrays] = useState("");
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry && isOpen) {
      setDate(entry.date ? entry.date.split("T")[0] : "");
      setProductionTrays(entry.production_trays !== undefined ? String(entry.production_trays) : "0");
      setDeliveries(
        entry.deliveries && entry.deliveries.length > 0
          ? entry.deliveries.map((d) => ({ ...d }))
          : []
      );
      setNotes(entry.notes || "");
    }
  }, [entry, isOpen]);

  const handleAddDeliveryRow = () => {
    setDeliveries((prev) => [
      ...prev,
      { destination: "", tray_quantity: 0, notes: "" },
    ]);
  };

  const handleRemoveDeliveryRow = (idx: number) => {
    setDeliveries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDeliveryChange = (
    idx: number,
    field: keyof DeliveryItem,
    value: any
  ) => {
    setDeliveries((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const prodNum = parseFloat(productionTrays) || 0;
  const delivTotal = deliveries.reduce((sum, d) => sum + (parseFloat(String(d.tray_quantity)) || 0), 0);
  const netChange = prodNum - delivTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    if (!date) {
      toast.error("Transaction date is required");
      return;
    }

    // Validate delivery rows if any
    for (let i = 0; i < deliveries.length; i++) {
      const d = deliveries[i];
      if (!d.destination.trim()) {
        toast.error(`Delivery #${i + 1}: Destination is required`);
        return;
      }
      const q = parseFloat(String(d.tray_quantity));
      if (isNaN(q) || q <= 0) {
        toast.error(`Delivery #${i + 1}: Tray quantity must be greater than 0`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await farmService.updateEntry(entry.id, {
        date,
        production_trays: prodNum,
        deliveries: deliveries.map((d) => ({
          destination: d.destination.trim(),
          tray_quantity: parseFloat(String(d.tray_quantity)),
          notes: d.notes?.trim() || undefined,
        })),
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        toast.success("Farm transaction updated successfully");
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Failed to update entry");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update entry";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Layers className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold text-foreground">
              Edit Farm Entry
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Update production and delivery details for {entry.farm_name || "Farm"} ({entry.farm_code || ""})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Date <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs"
                required
              />
            </div>

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
                placeholder="0"
                value={productionTrays}
                onChange={(e) => setProductionTrays(e.target.value)}
                className="text-xs font-semibold text-emerald-600"
              />
            </div>
          </div>

          {/* Delivery Section */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                Deliveries ({deliveries.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddDeliveryRow}
                className="h-7 text-xs px-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Delivery
              </Button>
            </div>

            {deliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No deliveries in this entry. Click "+ Add Delivery" if eggs were dispatched.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {deliveries.map((deliv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border"
                  >
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Destination (e.g. Shop, Karim)"
                        value={deliv.destination}
                        onChange={(e) => handleDeliveryChange(idx, "destination", e.target.value)}
                        className="text-xs h-8"
                        required
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="Trays"
                        value={deliv.tray_quantity || ""}
                        onChange={(e) => handleDeliveryChange(idx, "tray_quantity", e.target.value)}
                        className="text-xs h-8 text-right font-medium text-blue-600"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Note (optional)"
                        value={deliv.notes || ""}
                        onChange={(e) => handleDeliveryChange(idx, "notes", e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDeliveryRow(idx)}
                      className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Net Change Summary Box */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground block text-[11px]">Calculated Entry Net</span>
              <span className="font-mono font-medium text-foreground">
                +{prodNum} Prod &nbsp;|&nbsp; -{delivTotal} Deliv
              </span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block text-[11px]">Net Change</span>
              <Badge
                variant="outline"
                className={
                  netChange > 0
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-mono font-bold"
                    : netChange < 0
                    ? "bg-rose-500/10 text-rose-600 border-rose-500/30 font-mono font-bold"
                    : "font-mono"
                }
              >
                {netChange > 0 ? `+${netChange}` : netChange} trays
              </Badge>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Notes (Optional)</label>
            <Textarea
              rows={2}
              placeholder="Daily transaction notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? (
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
  );
}
