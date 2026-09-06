"use client";

import { X, Calendar, Layers, Package, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FarmTransactionItem } from "@/types";
import { format } from "date-fns";

interface FarmViewModalProps {
  transaction: FarmTransactionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FarmViewModal({ transaction, isOpen, onClose }: FarmViewModalProps) {
  if (!isOpen || !transaction) return null;

  const typeConfig = {
    PRODUCTION: {
      label: "Farm Production",
      variant: "outline" as const,
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      sign: "+",
      color: "text-emerald-600",
    },
    DELIVERY: {
      label: "Farm Delivery",
      variant: "outline" as const,
      className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      sign: "-",
      color: "text-blue-600",
    },
    WASTE: {
      label: "Farm Waste / Loss",
      variant: "outline" as const,
      className: "bg-rose-500/10 text-rose-600 border-rose-500/30",
      sign: "-",
      color: "text-rose-600",
    },
  }[transaction.transaction_type] || {
    label: transaction.transaction_type,
    variant: "outline" as const,
    className: "",
    sign: "",
    color: "text-foreground",
  };

  const noteText = transaction.notes || (transaction as any).note;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={typeConfig.variant} className={`text-xs font-semibold ${typeConfig.className}`}>
                {typeConfig.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500/30 text-amber-600 bg-amber-500/10">
                FARM
              </Badge>
            </div>
            <h2 className="text-base font-bold text-foreground mt-1.5">Farm Transaction Details</h2>
            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="h-3.5 w-3.5" />
              {transaction.transaction_date ? format(new Date(transaction.transaction_date), "dd MMMM yyyy") : "N/A"}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Transaction Content */}
        <div className="space-y-4">
          {/* Product & Quantity Box */}
          <div className="p-4 rounded-xl bg-muted/20 border space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Product Details
                </span>
                <div className="font-bold text-base text-foreground flex items-center gap-2 mt-0.5">
                  <Package className="h-4 w-4 text-primary" />
                  {transaction.product_name || "Farm Product"}
                </div>
                {transaction.product_code && (
                  <span className="text-xs font-mono text-muted-foreground block mt-0.5">
                    Code: {transaction.product_code}
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Quantity
                </span>
                <div className={`text-xl font-extrabold ${typeConfig.color} mt-0.5`}>
                  {typeConfig.sign}{transaction.quantity} {transaction.unit || "units"}
                </div>
              </div>
            </div>

            {/* Tray Calculation Details if available */}
            {Boolean(transaction.tray_count || transaction.units_per_tray) && (
              <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Tray Packaging:
                </span>
                <span className="font-semibold text-foreground">
                  {transaction.tray_count || 0} trays × {transaction.units_per_tray || 0} / tray
                </span>
              </div>
            )}

            {/* Destination if available */}
            {transaction.destination && (
              <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" /> Destination / Branch:
                </span>
                <span className="font-semibold text-blue-600">
                  {transaction.destination}
                </span>
              </div>
            )}
          </div>

          {/* Clean Multi-line Notes Section (Hidden when empty) */}
          {Boolean(noteText) && (
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> Note & Remarks
              </span>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
                {noteText}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Logged: {format(new Date(transaction.created_at), "dd MMM yyyy, HH:mm")}</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
