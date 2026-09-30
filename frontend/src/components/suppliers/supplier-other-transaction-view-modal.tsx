"use client";

import { X, ArrowDownLeft, Calendar, User, Phone, Hash, FileText, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupplierOtherTransactionItem } from "@/types/supplier_other_transaction";
import { formatCurrency, formatDateTime } from "@/utils/formatters";

interface SupplierOtherTransactionViewModalProps {
  transaction: SupplierOtherTransactionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SupplierOtherTransactionViewModal({
  transaction,
  isOpen,
  onClose,
}: SupplierOtherTransactionViewModalProps) {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono">
                {transaction.voucher_no}
              </Badge>
              <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                Other Payable
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">Supplier Other Transaction</h2>
            <span className="text-xs text-muted-foreground">
              Recorded on {formatDateTime(transaction.transaction_date)}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-4 py-1">
          {/* Amount Box */}
          <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/30 text-center space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Other Payable Amount (Received)
            </span>
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {formatCurrency(transaction.amount)}
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Increased supplier payable ledger balance
            </span>
          </div>

          {/* Supplier Info */}
          <div className="p-3 rounded-xl bg-accent/40 border space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
              <User className="h-3.5 w-3.5 text-primary" /> Supplier Account
            </span>
            <span className="font-bold text-foreground block">{transaction.supplier?.name || "N/A"}</span>
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              {transaction.supplier?.supplier_code && (
                <span className="font-mono">{transaction.supplier.supplier_code}</span>
              )}
              {transaction.supplier?.supplier_code && transaction.supplier?.phone && <span>•</span>}
              {transaction.supplier?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {transaction.supplier.phone}
                </span>
              )}
            </div>
          </div>

          {/* Meta Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <ArrowDownLeft className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Transaction Type
              </span>
              <span className="font-bold text-foreground capitalize">
                {transaction.transaction_type.replace(/_/g, " ")}
              </span>
            </div>

            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Reference #
              </span>
              <span className="font-bold text-foreground">{transaction.reference_no || "N/A"}</span>
            </div>
          </div>

          {/* Transaction Date */}
          <div className="p-3 rounded-lg border bg-card/60 text-xs space-y-1">
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Effective Ledger Date
            </span>
            <span className="font-semibold text-foreground">
              {formatDateTime(transaction.transaction_date)}
            </span>
          </div>

          {/* Description / Notes */}
          {Boolean(transaction.notes) && (
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> Description / Notes
              </span>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
                {transaction.notes}
              </p>
            </div>
          )}

          {/* Recorded By */}
          <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-3">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Recorded By:
            </span>
            <span className="font-semibold text-foreground">
              {transaction.user?.full_name || transaction.user?.username || "System"}
            </span>
          </div>

          {/* Timestamps */}
          <div className="text-[11px] text-muted-foreground flex justify-between items-center pt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Created: {formatDateTime(transaction.created_at)}
            </span>
            {transaction.updated_at && transaction.updated_at !== transaction.created_at && (
              <span>Updated: {formatDateTime(transaction.updated_at)}</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
