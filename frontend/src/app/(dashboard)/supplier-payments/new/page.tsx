"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { HasPermission } from "@/providers/auth-provider";
import { SupplierPaymentForm, SupplierPaymentFormValues } from "@/components/supplier-payments/supplier-payment-form";
import { supplierPaymentService } from "@/services/api";
import { SupplierPaymentCreatePayload } from "@/types";

export default function NewSupplierPaymentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: SupplierPaymentFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: SupplierPaymentCreatePayload = {
        supplier_id: values.supplier_id,
        amount: values.amount,
        payment_method: values.payment_method,
        reference_no: values.reference_no || null,
        payment_date: new Date(values.payment_date).toISOString(),
        notes: values.notes || null,
      };

      await supplierPaymentService.createSupplierPayment(payload);
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier Payment added successfully.");
      // router.push("/supplier-payments");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred while creating supplier payment.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HasPermission code="supplier_payment.create">
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Add Supplier Payment"
          description="Record payments made to suppliers, view live balance metrics, and automatically decrease outstanding supplier dues."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/supplier-payments">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Manage Payments
              </Link>
            </Button>
          }
        />

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30">
            {errorMessage}
          </div>
        )}

        <SupplierPaymentForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </HasPermission>
  );
}
