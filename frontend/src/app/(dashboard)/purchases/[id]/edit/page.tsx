"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService, purchaseService, supplierService } from "@/services/api";
import { PurchaseForm, PurchaseFormValues } from "@/components/purchases/purchase-form";
import { HasPermission } from "@/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch target purchase
  const { data: purchaseData, isLoading: loadingPurchase } = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => purchaseService.getPurchaseById(id),
  });

  // Fetch Suppliers & Products
  const { data: suppliersData } = useQuery({
    queryKey: ["all-suppliers-dropdown"],
    queryFn: () => supplierService.getSuppliers({ size: 200 }),
  });

  const { data: productsData } = useQuery({
    queryKey: ["all-products-dropdown"],
    queryFn: () => productService.getProducts({ size: 500 }),
  });

  const suppliers = suppliersData?.data?.items || [];
  const products = productsData?.data?.items || [];

  const updateMutation = useMutation({
    mutationFn: (values: PurchaseFormValues) =>
      purchaseService.updatePurchase(id, {
        supplier_id: values.supplier_id,
        invoice_no: values.invoice_no || undefined,
        discount_amount: values.discount_amount,
        tax_amount: values.tax_amount,
        paid_amount: values.paid_amount,
        notes: values.notes || undefined,
        items: values.items,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push("/purchases");
    },
  });

  const handleSubmit = async (values: PurchaseFormValues) => {
    await updateMutation.mutateAsync(values);
  };

  if (loadingPurchase) {
    return (
      <div className="w-full py-4 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  const purchase = purchaseData?.data;
  if (!purchase) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Purchase order not found or has been removed.
      </div>
    );
  }

  return (
    <HasPermission code="purchase.edit">
      <div className="py-4">
        <PurchaseForm
          initialData={purchase}
          suppliers={suppliers}
          products={products}
          isEdit={true}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/purchases")}
        />
      </div>
    </HasPermission>
  );
}
