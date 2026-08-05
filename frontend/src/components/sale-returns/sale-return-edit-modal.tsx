"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaleReturnForm, SaleReturnFormValues } from "./sale-return-form";
import { SaleReturnItem, SaleReturnUpdatePayload } from "@/types";
import { saleReturnService } from "@/services/api";

interface SaleReturnEditModalProps {
  saleReturn: SaleReturnItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SaleReturnEditModal({ saleReturn, isOpen, onClose, onSuccess }: SaleReturnEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !saleReturn) return null;

  const handleSubmit = async (values: SaleReturnFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const selectedItems = values.items
        .filter((i) => i.selected && i.return_qty > 0)
        .map((i) => ({
          product_id: i.product_id,
          quantity: i.return_qty,
          unit_price: i.unit_price,
        }));

      const payload: SaleReturnUpdatePayload = {
        refund_amount: values.refund_amount,
        reason: values.reason || null,
        items: selectedItems,
      };

      await saleReturnService.updateSaleReturn(saleReturn.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to update sale return voucher");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold text-foreground">Edit Sale Return Voucher - {saleReturn.return_no}</h2>
            <span className="text-xs text-muted-foreground">
              Modify returned items or refund amount. Product stock and customer due will be recalculated automatically.
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30">
            {errorMsg}
          </div>
        )}

        <SaleReturnForm
          initialData={saleReturn}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
