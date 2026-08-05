"use client";

import { X, Truck, Phone, Mail, MapPin, Building, CreditCard, DollarSign, Calendar, FileText } from "lucide-react";
import { SupplierItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface SupplierViewModalProps {
  supplier: SupplierItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SupplierViewModal({ supplier, isOpen, onClose }: SupplierViewModalProps) {
  if (!isOpen || !supplier) return null;

  const hasDue = supplier.current_balance > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{supplier.name}</h2>
              <div className="text-xs text-muted-foreground">{supplier.supplier_code}</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-primary" /> Phone
            </span>
            <span className="font-semibold text-foreground block">{supplier.phone || "N/A"}</span>
          </div>
        </div>

        {/* Due Balance Status Card */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          hasDue ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Current Outstanding Due</div>
            <div className={`text-2xl font-extrabold ${hasDue ? 'text-amber-500' : 'text-emerald-500'}`}>
              {formatCurrency(supplier.current_balance)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Opening Due: {formatCurrency(supplier.opening_balance)}
            </div>
          </div>

          <Badge variant={hasDue ? "warning" : "success"} className="capitalize">
            {hasDue ? "Outstanding Due" : "Settled Account"}
          </Badge>
        </div>

        {supplier.address && (
          <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Address
            </span>
            <p className="text-foreground">{supplier.address}</p>
          </div>
        )}

        {supplier.notes && (
          <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Notes
            </span>
            <p className="text-foreground">{supplier.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t flex justify-between items-center text-[11px] text-muted-foreground">
          <span>Registered: {formatDate(supplier.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
