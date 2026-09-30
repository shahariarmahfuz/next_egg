"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Calendar,
  FileText,
  User,
  ArrowDownLeft,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SupplierOtherTransactionItem, SupplierOtherTransactionUpdatePayload } from "@/types/supplier_other_transaction";
import { supplierOtherTransactionService, supplierPaymentService } from "@/services/api";
import { formatCurrency } from "@/utils/formatters";

interface SupplierOtherTransactionEditModalProps {
  transaction: SupplierOtherTransactionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupplierOtherTransactionEditModal({
  transaction,
  isOpen,
  onClose,
  onSuccess,
}: SupplierOtherTransactionEditModalProps) {
  const [amount, setAmount] = useState<number | "">("");
  const [transactionDate, setTransactionDate] = useState<string>("");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch current live balance of the supplier
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["supplier-financial-summary", transaction?.supplier_id],
    queryFn: () => supplierPaymentService.getSupplierFinancialSummary(transaction!.supplier_id),
    enabled: isOpen && !!transaction?.supplier_id,
  });

  const currentDue = summaryData?.data?.current_due ?? transaction?.supplier?.current_balance ?? 0;

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount);
      try {
        const d = new Date(transaction.transaction_date);
        const iso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        setTransactionDate(iso.slice(0, 16));
      } catch {
        setTransactionDate(new Date().toISOString().slice(0, 16));
      }
      setReferenceNo(transaction.reference_no || "");
      setNotes(transaction.notes || "");
      setErrorMessage(null);
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const oldAmount = transaction.amount;
  const numAmount = typeof amount === "number" ? amount : 0;
  const diff = numAmount - oldAmount;
  const projectedBalance = currentDue + diff;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof amount !== "number" || amount <= 0) {
      setErrorMessage("Transaction amount must be greater than zero.");
      return;
    }
    if (!transactionDate) {
      setErrorMessage("Transaction date is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: SupplierOtherTransactionUpdatePayload = {
        amount: amount,
        transaction_date: new Date(transactionDate).toISOString(),
        reference_no: referenceNo.trim() ? referenceNo.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      };

      await supplierOtherTransactionService.updateTransaction(transaction.id, payload);
      toast.success("Other Payable transaction updated successfully. Ledger balance adjusted.");
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update transaction";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono">
                {transaction.voucher_no}
              </Badge>
              <h2 className="text-lg font-bold text-foreground">Edit Other Payable</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Modifying this transaction will automatically adjust the supplier ledger and current balance.
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-destructive/15 text-destructive text-xs sm:text-sm font-medium border border-destructive/30 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Supplier Info */}
        <div className="p-3 rounded-xl bg-accent/40 border space-y-1 text-xs">
          <span className="text-muted-foreground flex items-center gap-1 font-semibold">
            <User className="h-3.5 w-3.5 text-primary" /> Supplier
          </span>
          <span className="font-bold text-foreground block text-sm">
            {transaction.supplier?.name || "N/A"}
          </span>
          {transaction.supplier?.supplier_code && (
            <span className="text-muted-foreground font-mono">
              Code: {transaction.supplier.supplier_code}
            </span>
          )}
        </div>

        {/* Live Accounting Balance Impact Preview Box */}
        <div className="p-3.5 rounded-xl border bg-muted/30 border-border/70 space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Ledger Balance Recalculation Preview</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground block text-[11px]">Current Due</span>
              {isSummaryLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <span className="font-bold text-foreground text-sm block">
                  {formatCurrency(currentDue)}
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <span className="text-muted-foreground block text-[11px]">Amount Change</span>
              <div className="flex items-center gap-1 font-semibold">
                <span className="text-muted-foreground line-through">{formatCurrency(oldAmount)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className={diff > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : diff < 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-foreground font-bold"}>
                  {formatCurrency(numAmount)}
                </span>
              </div>
            </div>

            <div className="space-y-0.5 sm:border-l sm:pl-2.5 border-border/70">
              <span className="text-muted-foreground block text-[11px]">New Projected Due</span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm block">
                {formatCurrency(projectedBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Amount (৳) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val === "" ? "" : parseFloat(val));
                }}
                className="h-10 text-xs sm:text-sm bg-background/50"
                required
              />
            </div>

            {/* Transaction Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Transaction Date <span className="text-destructive">*</span>
              </label>
              <Input
                type="datetime-local"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="h-10 text-xs sm:text-sm bg-background/50"
                required
              />
            </div>

            {/* Note / Reference */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Note / Reference (Optional)
              </label>
              <Input
                placeholder="e.g. Bank slip, voucher note"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="h-10 text-xs sm:text-sm bg-background/50"
              />
            </div>

            {/* Description / Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Description / Notes (Optional)
              </label>
              <Input
                placeholder="Extra details for ledger entry..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 text-xs sm:text-sm bg-background/50"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || typeof amount !== "number" || amount <= 0}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[130px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
