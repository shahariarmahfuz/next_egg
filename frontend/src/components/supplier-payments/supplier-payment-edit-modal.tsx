"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierPaymentForm, SupplierPaymentFormValues } from "./supplier-payment-form";
import { SupplierPaymentItem, SupplierPaymentUpdatePayload } from "@/types";
import { supplierPaymentService } from "@/services/api";

interface SupplierPaymentEditModalProps {
  payment: SupplierPaymentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupplierPaymentEditModal({ payment, isOpen, onClose, onSuccess }: SupplierPaymentEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !payment) return null;

  const handleSubmit = async (values: SupplierPaymentFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: SupplierPaymentUpdatePayload = {
        amount: values.amount,
        payment_method: values.payment_method,
        reference_no: values.reference_no || null,
        payment_date: new Date(values.payment_date).toISOString(),
        notes: values.notes || null,
      };

      await supplierPaymentService.updateSupplierPayment(payment.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to update supplier payment voucher");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold text-foreground">Edit Supplier Payment Voucher - {payment.payment_no}</h2>
            <span className="text-xs text-muted-foreground">
              Update payment voucher details. Supplier due balance will be recalculated automatically.
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

        <SupplierPaymentForm
          initialData={payment}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
