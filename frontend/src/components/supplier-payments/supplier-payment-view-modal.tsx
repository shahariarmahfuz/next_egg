"use client";

import { X, Printer, Calendar, User, Phone, CreditCard, Hash, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupplierPaymentItem } from "@/types";
import { formatCurrency, formatDateTime, printSupplierPaymentVoucher } from "./supplier-payment-export-utils";

interface SupplierPaymentViewModalProps {
  payment: SupplierPaymentItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SupplierPaymentViewModal({ payment, isOpen, onClose }: SupplierPaymentViewModalProps) {
  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                {payment.payment_no}
              </Badge>
              <Badge variant="secondary" className="text-[10px] uppercase">
                {payment.payment_method}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">Supplier Payment Voucher</h2>
            <span className="text-xs text-muted-foreground ">
              Recorded on {formatDateTime(payment.payment_date)}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 py-2">
          {/* Amount Paid Box */}
          <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-center space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Payment Amount Paid</span>
            <div className="text-3xl font-extrabold text-emerald-500">
              {formatCurrency(payment.amount)}
            </div>
          </div>

          {/* Supplier Info */}
          <div className="p-3 rounded-xl bg-accent/40 border space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
              <User className="h-3.5 w-3.5 text-primary" /> Supplier Account
            </span>
            <span className="font-bold text-foreground block">{payment.supplier?.name || "N/A"}</span>
            <div className="text-xs text-muted-foreground flex items-center gap-3 ">
              <span>{payment.supplier?.supplier_code}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {payment.supplier?.phone || "No Phone"}
              </span>
            </div>
          </div>

          {/* Payment Meta Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5 text-primary" /> Method
              </span>
              <span className="font-bold text-foreground uppercase">{payment.payment_method}</span>
            </div>

            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Reference #
              </span>
              <span className="font-bold text-foreground">{payment.reference_no || "N/A"}</span>
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground block font-semibold flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-primary" /> Notes
              </span>
              <p className="text-xs text-foreground leading-relaxed">{payment.notes}</p>
            </div>
          )}

          {/* Processed By */}
          <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-3">
            <span>Processed By User:</span>
            <span className="font-semibold text-foreground">
              {payment.user?.full_name || payment.user?.username || "System Admin"}
            </span>
          </div>
        </div>

        <div className="border-t pt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => printSupplierPaymentVoucher(payment)}>
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
