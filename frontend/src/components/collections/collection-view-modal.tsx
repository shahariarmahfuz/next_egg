"use client";

import { X, Printer, Calendar, User, Phone, CreditCard, Hash, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerCollectionItem } from "@/types";
import { formatCurrency, formatDateTime, printVoucherWindow } from "./collection-export-utils";

interface CollectionViewModalProps {
  collection: CustomerCollectionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CollectionViewModal({ collection, isOpen, onClose }: CollectionViewModalProps) {
  if (!isOpen || !collection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                {collection.collection_no}
              </Badge>
              <Badge variant="secondary" className="uppercase text-[10px]">
                {collection.payment_method}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">Collection Voucher Details</h2>
            <span className="text-xs text-muted-foreground ">
              Recorded on {formatDateTime(collection.collection_date)}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 py-2">
          {/* Customer Summary Card */}
          <div className="p-4 rounded-xl bg-accent/40 border space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Customer Information
            </span>
            <div className="space-y-1">
              <div className="font-bold text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                {collection.customer?.name || "N/A"}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                <span>Contact Number: {collection.customer?.phone || "N/A"}</span>
              </div>
              {collection.customer?.address && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-medium text-foreground">Address:</span> {collection.customer.address}
                </div>
              )}
            </div>
          </div>

          {/* Collected Amount Banner */}
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block">
              Total Amount Collected
            </span>
            <span className="text-3xl font-extrabold text-emerald-500">
              {formatCurrency(collection.amount)}
            </span>
          </div>

          {/* Transaction Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg border bg-card/60">
              <span className="text-xs text-muted-foreground block mb-0.5 flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5 text-primary" /> Payment Method
              </span>
              <span className="font-semibold capitalize">{collection.payment_method.replace("_", " ")}</span>
            </div>

            <div className="p-3 rounded-lg border bg-card/60">
              <span className="text-xs text-muted-foreground block mb-0.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Collection Date
              </span>
              <span className="font-semibold text-xs">{formatDateTime(collection.collection_date)}</span>
            </div>
          </div>

          {/* Notes */}
          {collection.notes && (
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground block font-semibold flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-primary" /> Notes & Remarks
              </span>
              <p className="text-xs text-foreground leading-relaxed">{collection.notes}</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => printVoucherWindow(collection)}>
            <Printer className="mr-1.5 h-4 w-4 text-primary" />
            Print Official Voucher
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
