"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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

interface HardDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  entityType: string; // e.g. "Customer", "Supplier", "Product", "Sale Invoice"
  entityName: string; // e.g. "CUST-00001 - Acme Retailers", "SL-00001"
  affectedItems?: string[];
  isDeleting?: boolean;
}

export const HardDeleteModal: React.FC<HardDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entityType,
  entityName,
  affectedItems = [
    "All related transactions",
    "Ledger history",
    "Collections & payment vouchers",
    "Returns & line items",
    "Balance adjustments",
  ],
  isDeleting = false,
}) => {
  const [confirmInput, setConfirmInput] = useState("");

  // Reset input when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setConfirmInput("");
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (confirmInput.trim() !== "DELETE" || isDeleting) return;
    await onConfirm();
  };

  const isConfirmed = confirmInput.trim() === "DELETE";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent className="sm:max-w-md border-rose-500/20 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500 mb-1">
            <div className="p-2.5 rounded-full bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-rose-600 dark:text-rose-400">
                ⚠ Permanently Delete {entityType}
              </DialogTitle>
              <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 mt-0.5">
                {entityName}
              </p>
            </div>
          </div>
          <DialogDescription className="text-muted-foreground text-sm pt-2">
            This action <strong className="text-rose-500 dark:text-rose-400 font-semibold">cannot be undone</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-600 dark:text-amber-400 space-y-2">
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              The following data will be permanently removed:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground dark:text-amber-200/80">
              <li className="font-medium text-foreground">{entityType} profile & catalog entry</li>
              {affectedItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
              <li>Other linked dependent records</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">
              Type <span className="font-mono font-bold text-rose-600 dark:text-rose-400">DELETE</span> to confirm this action:
            </label>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type DELETE"
              disabled={isDeleting}
              className="border-rose-500/30 focus-visible:ring-rose-500 uppercase tracking-widest font-bold text-center"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium gap-2 shadow-sm"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Permanently (Danger)"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
