"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { HasPermission } from "@/providers/auth-provider";
import {
  SupplierOtherTransactionForm,
  SupplierOtherTransactionFormValues,
} from "@/components/suppliers/supplier-other-transaction-form";
import { supplierOtherTransactionService } from "@/services/api";
import { SupplierOtherTransactionCreatePayload } from "@/types";

export default function SupplierOtherTransactionPage() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: SupplierOtherTransactionFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: SupplierOtherTransactionCreatePayload = {
        supplier_id: values.supplier_id,
        transaction_type: values.transaction_type,
        amount: values.amount,
        transaction_date: new Date(values.transaction_date).toISOString(),
        reference_no: values.reference_no?.trim() ? values.reference_no.trim() : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      };

      await supplierOtherTransactionService.createTransaction(payload);

      // Invalidate relevant queries so balances and lists update instantly
      queryClient.invalidateQueries({ queryKey: ["supplier-other-transactions-list"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });

      toast.success("Other Payable transaction recorded successfully. Supplier balance updated.");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred while recording transaction.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HasPermission code="supplier.create">
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <PageHeader
          title="Supplier Other Transaction"
          description="Record funds received from suppliers outside normal purchases (Other Payable). Automatically integrates with the Supplier Ledger and updates outstanding dues."
          action={
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/suppliers/other-transaction/manage">
                  <ClipboardList className="mr-1.5 h-4 w-4" />
                  Manage Other Transactions
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/suppliers">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Suppliers
                </Link>
              </Button>
            </div>
          }
        />

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30">
            {errorMessage}
          </div>
        )}

        {/* Transaction Entry Form */}
        <SupplierOtherTransactionForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </HasPermission>
  );
}
