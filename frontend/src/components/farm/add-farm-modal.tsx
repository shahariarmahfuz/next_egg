'use client';

import React, { useState } from "react";
import { Loader2, Sprout, Plus, RotateCcw } from "lucide-react";
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
import { farmService } from "@/services/api";
import { FarmBalanceItem } from "@/types";
import { toast } from "sonner";

interface AddFarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newFarmId?: string) => void;
}

export function AddFarmModal({ isOpen, onClose, onSuccess }: AddFarmModalProps) {
  const [name, setName] = useState("");
  const [previousTray, setPreviousTray] = useState("0");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Farm Name is required");
      return;
    }

    const prevQty = parseFloat(previousTray || "0");
    setSubmitting(true);
    try {
      const res = await farmService.createFarm({
        name: name.trim(),
        previous_tray: isNaN(prevQty) ? 0 : Math.max(0, prevQty),
        address: address.trim() || undefined,
        contact_number: contactNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success(`Farm "${res.data.name}" added successfully!`);
        setName("");
        setPreviousTray("0");
        setAddress("");
        setContactNumber("");
        setNotes("");
        onSuccess(res.data.id);
        onClose();
      } else {
        toast.error(res.message || "Failed to create farm");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to create farm";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Sprout className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold text-foreground">
              Add New Farm
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Register a new farm location with an opening tray balance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Farm Name <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Akota Poultry Farm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <RotateCcw className="h-3 w-3 text-amber-500" /> Opening / Previous Tray Balance
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 500"
              value={previousTray}
              onChange={(e) => setPreviousTray(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Contact Number</label>
              <Input
                type="text"
                placeholder="e.g. +880 1711..."
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Address / Area</label>
              <Input
                type="text"
                placeholder="e.g. Gazipur"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Notes (Optional)</label>
            <Textarea
              rows={2}
              placeholder="Operational details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Adding Farm...
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Farm
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
