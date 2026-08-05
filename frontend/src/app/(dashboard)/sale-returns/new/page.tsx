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
import { SaleReturnForm, SaleReturnFormValues } from "@/components/sale-returns/sale-return-form";
import { saleReturnService } from "@/services/api";
import { SaleReturnCreatePayload } from "@/types";

export default function NewSaleReturnPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: SaleReturnFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const selectedItems = values.items
        .filter((i) => i.selected && i.return_qty > 0)
        .map((i) => ({
          product_id: i.product_id,
          quantity: i.return_qty,
          unit_price: i.unit_price,
        }));

      const payload: SaleReturnCreatePayload = {
        sale_id: values.sale_id || null,
        customer_id: values.customer_id,
        return_date: new Date(values.return_date).toISOString(),
        refund_amount: values.refund_amount,
        reason: values.reason || null,
        items: selectedItems,
      };

      await saleReturnService.createSaleReturn(payload);
      queryClient.invalidateQueries({ queryKey: ["sale-returns-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Sale Return added successfully.");
      router.push("/sale-returns");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred while creating sale return.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HasPermission code="sale_return.create">
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Add Customer Sale Return"
          description="Process customer product returns against original sale invoices, restock product inventory, and adjust customer due balance."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/sale-returns">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Manage Sale Returns
              </Link>
            </Button>
          }
        />

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30">
            {errorMessage}
          </div>
        )}

        <SaleReturnForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </HasPermission>
  );
}
