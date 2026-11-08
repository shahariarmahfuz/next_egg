"use client";

import { useState } from "react";
import { X, Printer, User, Phone, MapPin, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerCollectionItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { printVoucherWindow } from "./collection-export-utils";

interface CollectionViewModalProps {
  collection: CustomerCollectionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

function getCleanField(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === "N/A" || upper === "NA" || upper === "-" || upper === "NONE" || upper === "NULL") {
    return null;
  }
  return trimmed;
}

export function CollectionViewModal({ collection, isOpen, onClose }: CollectionViewModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !collection) return null;

  const discountAmount = Number(collection.discount_amount || 0);
  const customerName = getCleanField(collection.customer?.name) || "Customer";
  const customerPhone = getCleanField(collection.customer?.phone);
  const customerAddress = getCleanField(collection.customer?.address);
  const noteText = getCleanField(collection.notes || (collection as any).note);

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printVoucherWindow(collection);
    } catch (err) {
      console.error("Failed to print collection receipt:", err);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Compact Receipt Modal */}
      <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* 1. Compact Header */}
        <div className="flex items-start justify-between px-4 py-3.5 sm:px-5 sm:py-4 border-b shrink-0 bg-card">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="font-mono text-[11px] font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              >
                {collection.collection_no}
              </Badge>
              <Badge variant="secondary" className="uppercase text-[10px] font-semibold px-2 py-0.5">
                {collection.payment_method?.replace(/_/g, " ") || "CASH"}
              </Badge>
            </div>
            <h2 className="text-base font-bold text-foreground leading-tight pt-0.5">
              Collection Receipt
            </h2>
            <span className="text-[11px] text-muted-foreground block">
              Recorded on {formatDateTime(collection.collection_date)}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full shrink-0 -mr-1 -mt-0.5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 2. Compact Body */}
        <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto space-y-3 flex-1">
          {/* Slim Collected Amount Box — Right Below Header */}
          <div className="py-3 px-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">
              Total Amount Collected
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-snug">
              {formatCurrency(collection.amount)}
            </div>
            {discountAmount > 0 && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block pt-0.5">
                Discount Waived: {formatCurrency(discountAmount)}
              </span>
            )}
          </div>

          {/* Simplified 2-Line Customer Info (Hides N/A & Empty Fields) */}
          <div className="px-3.5 py-2.5 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/60 space-y-1">
            <div className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-1.5 leading-snug">
              <User className="h-4 w-4 text-primary shrink-0" />
              <span className="break-words">{customerName}</span>
            </div>

            {(customerPhone || customerAddress) && (
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 pl-0.5">
                {customerPhone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{customerPhone}</span>
                  </span>
                )}
                {customerPhone && customerAddress && (
                  <span className="text-muted-foreground/50">•</span>
                )}
                {customerAddress && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="break-words">{customerAddress}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Optional Note */}
          {noteText && (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <FileText className="h-3 w-3 text-primary shrink-0" /> Note
              </span>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed break-words text-[11px]">
                {noteText}
              </p>
            </div>
          )}
        </div>

        {/* 3. Balanced Sticky Footer */}
        <div className="px-4 py-3 sm:px-5 border-t bg-muted/15 shrink-0 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isPrinting}
            className="gap-1.5 h-8 px-3 text-xs"
          >
            {isPrinting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Print Receipt</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="h-8 px-4 text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
