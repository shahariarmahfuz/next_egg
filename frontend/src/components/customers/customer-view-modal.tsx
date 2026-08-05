"use client";

import { X, Users, Phone, MapPin, FileText, ShieldCheck } from "lucide-react";
import { CustomerItem } from "@/types";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface CustomerViewModalProps {
  customer: CustomerItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerViewModal({ customer, isOpen, onClose }: CustomerViewModalProps) {
  if (!isOpen || !customer) return null;

  const hasDue = customer.current_balance > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{customer.name}</h2>
              <span className="text-xs text-muted-foreground">{customer.customer_code}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Contact Attributes */}
        <div className="grid grid-cols-1 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-primary" /> Phone
            </span>
            <span className="font-semibold text-foreground block">{customer.phone || "N/A"}</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Address
            </span>
            <span className="font-medium text-foreground block">{customer.address || "No address on file."}</span>
          </div>

          {customer.nid && (
            <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> NID / Tax ID
              </span>
              <span className="text-foreground block">{customer.nid}</span>
            </div>
          )}
        </div>

        {/* Financial Due Statement */}
        <div className="p-4 rounded-xl bg-muted/20 border space-y-3 text-xs">
          <div className="flex justify-between items-center pb-2 border-b">
            <span className="text-muted-foreground font-medium">Opening Due Balance:</span>
            <span className="">{formatCurrency(customer.opening_balance)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Current Outstanding Due:</span>
            <span className={`font-bold text-sm ${hasDue ? "text-amber-500" : "text-emerald-500"}`}>
              {formatCurrency(customer.current_balance)}
            </span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground font-medium">Credit Limit:</span>
            <span className="text-foreground">
              {(customer.credit_limit ?? 0) > 0 ? formatCurrency(customer.credit_limit!) : "N/A"}
            </span>
          </div>
        </div>

        {customer.notes && (
          <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Notes
            </span>
            <p className="text-foreground">{customer.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t flex justify-between items-center text-[11px] text-muted-foreground">
          <span>Registered: {formatDate(customer.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
