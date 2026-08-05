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
import { ProductReturnForm, ProductReturnFormValues } from "@/components/product-returns/product-return-form";
import { productReturnService } from "@/services/api";
import { ProductReturnCreatePayload } from "@/types";

export default function NewProductReturnPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: ProductReturnFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const selectedItems = values.items
        .filter((i) => i.selected && i.return_qty > 0)
        .map((i) => ({
          product_id: i.product_id,
          quantity: i.return_qty,
          unit_price: i.unit_price,
          notes: i.notes || undefined,
        }));

      const payload: ProductReturnCreatePayload = {
        purchase_id: values.purchase_id || null,
        supplier_id: values.supplier_id,
        return_date: new Date(values.return_date).toISOString(),
        refund_received: values.refund_received,
        reason: values.reason || null,
        items: selectedItems,
      };

      await productReturnService.createProductReturn(payload);
      queryClient.invalidateQueries({ queryKey: ["product-returns-list"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product Return added successfully.");
      router.push("/product-returns");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred while creating product return.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HasPermission code="product_return.create">
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Add Supplier Product Return"
          description="Process product returns back to suppliers against original purchase orders, automatically reduce product stock, and adjust supplier due balance."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/product-returns">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Manage Product Returns
              </Link>
            </Button>
          }
        />

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30">
            {errorMessage}
          </div>
        )}

        <ProductReturnForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </HasPermission>
  );
}
