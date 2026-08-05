"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Coins,
  History,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  User,
} from "lucide-react";
import { customerService, supplierService } from "@/services/api";
import { BalanceAdjustmentItem, BalanceAdjustmentPayload } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface BalanceAdjustmentModalProps {
  entityType: "customer" | "supplier";
  entityId: string;
  entityName: string;
  currentBalance: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASON_OPTIONS = [
  "Physical account reconciliation",
  "Opening balance correction",
  "Data migration",
  "Manual adjustment",
  "Audit correction",
  "Other",
];

export function BalanceAdjustmentModal({
  entityType,
  entityId,
  entityName,
  currentBalance,
  isOpen,
  onClose,
  onSuccess,
}: BalanceAdjustmentModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"adjust" | "history">("adjust");

  // Form State
  const defaultBalanceType =
    entityType === "customer" ? "customer_due" : "supplier_payable";
  const [newBalance, setNewBalance] = useState<string>(currentBalance.toString());
  const [balanceType, setBalanceType] = useState<string>(defaultBalanceType);
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState<string>(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Adjustment History
  const { data: historyData, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["balance-adjustments", entityType, entityId],
    queryFn: () =>
      entityType === "customer"
        ? customerService.getBalanceAdjustments(entityId)
        : supplierService.getBalanceAdjustments(entityId),
    enabled: isOpen,
  });

  const adjustments: BalanceAdjustmentItem[] = historyData?.data || [];

  // Adjustment Mutation
  const adjustMutation = useMutation({
    mutationFn: (payload: BalanceAdjustmentPayload) =>
      entityType === "customer"
        ? customerService.adjustBalance(entityId, payload)
        : supplierService.adjustBalance(entityId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["balance-adjustments", entityType, entityId] });
      if (onSuccess) onSuccess();
      refetchHistory();
      alert("Current balance updated successfully.");
      onClose();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update current balance.");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedVal = parseFloat(newBalance);
    if (isNaN(parsedVal)) {
      setFormError("Please enter a valid numeric balance.");
      return;
    }

    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) {
      setFormError("Reason is required.");
      return;
    }

    adjustMutation.mutate({
      new_balance: parsedVal,
      balance_type: balanceType,
      effective_date: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
      reason: finalReason,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50 duration-200">
      <div className="bg-card text-card-foreground border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Set Current Balance</h2>
              <p className="text-xs text-muted-foreground">
                {entityType === "customer" ? "Customer" : "Supplier"}:{" "}
                <span className="font-semibold text-foreground">{entityName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b bg-muted/10 px-6 pt-2">
          <button
            onClick={() => setActiveTab("adjust")}
            className={`pb-2 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "adjust"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Coins className="h-3.5 w-3.5" />
            <span>Set New Balance</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Adjustment History ({adjustments.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "adjust" ? (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center space-x-2 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Current Running Balance Callout */}
              <div className="p-3.5 rounded-lg bg-muted/40 border flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Previous / Existing Balance:</span>
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(currentBalance)}
                </span>
              </div>

              {/* New Current Balance Input */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Current Balance ($) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder="Enter new target balance (e.g. 500.00)"
                  className="h-10 text-sm font-medium"
                  required
                />
              </div>

              {/* Balance Type Select */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Balance Type</label>
                <select
                  value={balanceType}
                  onChange={(e) => setBalanceType(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {entityType === "customer" ? (
                    <>
                      <option value="customer_due">Customer Due (Receivable)</option>
                      <option value="customer_advance">Customer Advance (Credit)</option>
                    </>
                  ) : (
                    <>
                      <option value="supplier_payable">Supplier Payable (Due)</option>
                      <option value="supplier_advance">Supplier Advance (Prepayment)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Effective Date */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Effective Date</label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              {/* Reason Select */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Reason <span className="text-destructive">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {reason === "Other" && (
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Specify Custom Reason</label>
                  <Input
                    placeholder="Provide detailed custom reason..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="h-10 text-xs"
                    required
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Audit Notes (Optional)</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter extra reconciliation or audit notes..."
                  className="w-full rounded-md border border-input bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={adjustMutation.isPending} className="h-9 text-xs">
                  {adjustMutation.isPending ? "Saving Adjustment..." : "Save Balance Adjustment"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Immutable Audit History Log
              </h3>

              {isLoadingHistory ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : adjustments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs border rounded-lg bg-muted/10">
                  No balance adjustments recorded yet for this profile.
                </div>
              ) : (
                <div className="space-y-3">
                  {adjustments.map((adj) => {
                    const isDiffPositive = adj.difference >= 0;
                    return (
                      <div
                        key={adj.id}
                        className="p-3.5 rounded-lg border bg-card/60 space-y-2 text-xs hover:border-primary/40 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-foreground">{adj.reason}</span>
                            <div className="text-[11px] text-muted-foreground flex items-center space-x-3 mt-0.5">
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {formatDate(adj.effective_date || adj.created_at)}
                              </span>
                              <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {adj.created_by_user_name}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`font-bold ${
                                isDiffPositive ? "text-amber-500" : "text-emerald-500"
                              }`}
                            >
                              {isDiffPositive ? "+" : ""}
                              {formatCurrency(adj.difference)}
                            </span>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {adj.balance_type.replace("_", " ")}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/30 text-[11px]">
                          <div>
                            <span className="text-muted-foreground">Previous: </span>
                            <span className="font-medium">{formatCurrency(adj.previous_balance)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">New Target: </span>
                            <span className="font-bold text-primary">{formatCurrency(adj.new_balance)}</span>
                          </div>
                        </div>

                        {adj.notes && (
                          <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded flex items-start space-x-1.5">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                            <span>{adj.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
